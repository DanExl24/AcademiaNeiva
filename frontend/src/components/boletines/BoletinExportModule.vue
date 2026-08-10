<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { FileDown, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import BoletinPreview from './BoletinPreview.vue'
import html2pdf from 'html2pdf.js'

const props = defineProps<{
  studentId: number | string
  periodId: number | string
  studentName?: string
}>()

const auth = useAuthStore()
const isLoading = ref(false)
const isExporting = ref(false)
const error = ref('')
const boletinData = ref<any>(null)
const boletinPreviewRef = ref<any>(null)

const resolveColorToRgb = (colorStr: string): string => {
  if (typeof colorStr !== 'string') return colorStr
  if (
    colorStr.includes('color(') ||
    colorStr.includes('oklch(') ||
    colorStr.includes('oklab(') ||
    colorStr.includes('color-mix(')
  ) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = colorStr
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        if (a === 255) {
          return `rgb(${r}, ${g}, ${b})`
        } else {
          return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
        }
      }
    } catch (e) {
      console.warn('Failed to resolve color to rgb via canvas:', e)
    }
  }
  return colorStr
}

const resolveComplexStyle = (styleVal: string): string => {
  if (typeof styleVal !== 'string') return styleVal
  
  let parsed = styleVal.replace(/color\([^)]+\)/g, (match) => {
    return resolveColorToRgb(match)
  })
  
  parsed = parsed.replace(/oklch\([^)]+\)/g, (match) => {
    return resolveColorToRgb(match)
  })

  parsed = parsed.replace(/oklab\([^)]+\)/g, (match) => {
    return resolveColorToRgb(match)
  })

  parsed = parsed.replace(/color-mix\([^)]+\)/g, (match) => {
    return resolveColorToRgb(match)
  })

  return parsed
}

const handleExport = async () => {
  if (!props.studentId || !props.periodId) {
    error.value = 'Faltan datos para la exportación'
    return
  }

  error.value = ''
  isLoading.value = true
  
  const originalGetComputedStyle = window.getComputedStyle
  window.getComputedStyle = function (el, pseudoElt) {
    const style = originalGetComputedStyle.call(window, el, pseudoElt)
    return new Proxy(style, {
      get(target, prop) {
        const val = Reflect.get(target, prop)
        if (typeof val === 'string') {
          return resolveComplexStyle(val)
        }
        if (typeof val === 'function') {
          return function (...args: any[]) {
            const res = val.apply(target, args)
            if (typeof res === 'string') {
              return resolveComplexStyle(res)
            }
            return res
          }
        }
        return val
      }
    })
  }
  
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await fetch(`/api/boletines/student/${props.studentId}/${props.periodId}`, { headers })
    
    const contentType = res.headers.get('content-type') || ''
    if (!res.ok) {
      let errorMessage = `Error HTTP ${res.status}`
      if (contentType.includes('application/json')) {
        const data = await res.json()
        errorMessage = data.error || errorMessage
      } else {
        const text = await res.text()
        console.error('El servidor devolvió una respuesta HTML de error:', text)
        errorMessage = `Respuesta no válida del servidor (HTTP ${res.status}). Verifica que el backend esté encendido en el puerto 3000.`
      }
      throw new Error(errorMessage)
    }
    
    boletinData.value = await res.json()
    isExporting.value = true

    // Esperar a que Vue renderice el componente completamente
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 800))

    try {
      const element = boletinPreviewRef.value?.boletinRef
      console.log('--- DIAGNÓSTICO DE EXPORTACIÓN PDF ---')
      console.log('Elemento recuperado de BoletinPreview:', element)

      if (!element) throw new Error('No se pudo encontrar el elemento del boletín')

      // Verificar que el elemento tiene dimensiones válidas antes de generar
      let rect = element.getBoundingClientRect()
      console.log('Dimensiones iniciales del elemento:', {
        width: rect.width,
        height: rect.height,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight
      })

      if (rect.width === 0 || rect.height === 0) {
        console.warn('¡Alerta! El elemento tiene dimensiones 0. Forzando tamaño de layout fijo...')
        element.style.width = '816px'
        element.style.minHeight = '600px'
        element.style.display = 'block'
        element.style.visibility = 'visible'
        
        // Dar otro tick al browser para re-calcular layout
        await new Promise(resolve => setTimeout(resolve, 200))
        rect = element.getBoundingClientRect()
        console.log('Dimensiones tras forzar estilos:', {
          width: rect.width,
          height: rect.height
        })
      }

      // Validar si hay algún canvas de tamaño 0 adentro
      const canvases = element.querySelectorAll('canvas')
      console.log('Cantidad de canvas dentro del boletín:', canvases.length)
      canvases.forEach((c: any, index: number) => {
        console.log(`Canvas #${index}:`, { width: c.width, height: c.height, styleWidth: c.style.width, styleHeight: c.style.height })
      })

      const opt = {
        margin: 0.5,
        filename: `boletin_${boletinData.value?.estudiante?.codigo || 'estudiante'}_${boletinData.value?.periodo || 'periodo'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: true, // Habilitar logs internos de html2canvas para debug
          scrollX: 0,
          scrollY: 0,
          windowWidth: 816
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      }

      console.log('Iniciando html2pdf con opciones:', opt)
      await html2pdf().set(opt).from(element).save()
      console.log('PDF generado exitosamente.')
    } catch (err: any) {
      console.error('Error detallado en la generación del PDF:', err)
      error.value = `Error al generar el PDF: ${err.message || err}`
    } finally {
      // Siempre limpiar el estado para desbloquear la vista
      isExporting.value = false
      boletinData.value = null
    }

  } catch (err: any) {
    console.error('Error en handleExport:', err)
    error.value = err.message || 'Error de conexión'
    isExporting.value = false
    boletinData.value = null
  } finally {
    window.getComputedStyle = originalGetComputedStyle
    isLoading.value = false
  }
}
</script>

<template>
  <div class="boletin-export-module">
    <button 
      @click="handleExport"
      :disabled="isLoading || isExporting"
      class="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Loader2 v-if="isLoading || isExporting" class="w-4 h-4 animate-spin" />
      <FileDown v-else class="w-4 h-4" />
      {{ isExporting ? 'Generando PDF...' : isLoading ? 'Cargando...' : 'Descargar Boletín' }}
    </button>
    
    <p v-if="error" class="mt-2 text-[10px] text-rose-500 font-bold text-center italic">
      {{ error }}
    </p>

    <!-- Contenedor oculto para renderizar el boletín antes de exportar a PDF -->
    <!-- fixed con z-index: -99999 y opacity: 0.005 asegura que esté siempre en el viewport visible
         del navegador (incluso si hay scroll) para que se renderice correctamente en la GPU,
         pero sin molestar al usuario ni permitir interacción alguna. -->
    <div v-if="boletinData" class="hidden-preview-container" aria-hidden="true">
      <BoletinPreview 
        :data="boletinData" 
        ref="boletinPreviewRef" 
      />
    </div>
  </div>
</template>

<style scoped>
.hidden-preview-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 816px; /* 8.5in a 96dpi */
  height: 100vh;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  opacity: 0.005;
  z-index: -99999;
}
</style>
