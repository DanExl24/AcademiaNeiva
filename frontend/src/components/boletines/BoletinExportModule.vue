<script setup lang="ts">
import { ref } from 'vue'
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

const handleExport = async () => {
  if (!props.studentId || !props.periodId) {
    error.value = 'Faltan datos para la exportación'
    return
  }

  error.value = ''
  isLoading.value = true
  
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await fetch(`http://localhost:3000/api/boletines/student/${props.studentId}/${props.periodId}`, { headers })
    
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Error al obtener los datos del boletín')
    }
    
    boletinData.value = await res.json()
    
    // Start PDF generation
    isExporting.value = true
    
    // Wait for the component to render
    setTimeout(async () => {
      try {
        const element = boletinPreviewRef.value?.boletinRef
        if (!element) throw new Error('No se pudo encontrar el elemento del boletín')

        const opt = {
          margin: 0.5,
          filename: `boletin_${boletinData.value?.estudiante?.codigo || 'estudiante'}_${boletinData.value?.periodo || 'periodo'}.pdf`,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
        }

        await html2pdf().set(opt).from(element).save()
        isExporting.value = false
        boletinData.value = null // Clear data after export to hide preview
      } catch (err: any) {
        console.error(err)
        error.value = 'Error al generar el PDF'
        isExporting.value = false
      }
    }, 500)

  } catch (err: any) {
    console.error(err)
    error.value = err.message || 'Error de conexión'
  } finally {
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
      {{ isExporting ? 'Generando...' : isLoading ? 'Cargando...' : 'Descargar Boletín' }}
    </button>
    
    <p v-if="error" class="mt-2 text-[10px] text-rose-500 font-bold text-center italic">
      {{ error }}
    </p>

    <!-- Hidden Preview for PDF Generation -->
    <div v-if="boletinData" class="hidden-preview-container">
      <BoletinPreview 
        :data="boletinData" 
        ref="boletinPreviewRef" 
      />
    </div>
  </div>
</template>

<style scoped>
.hidden-preview-container {
  position: absolute;
  left: -9999px;
  top: -9999px;
  width: 8.5in; /* Letter size width */
}
</style>
