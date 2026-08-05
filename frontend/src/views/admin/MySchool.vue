<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { API_BASE_URL } from '../../config/api'
import { 
  School, Hash, MapPin, Mail, Phone, Calendar, Users, Upload,
  Palette, RefreshCw, Check, Undo, HelpCircle, ShieldAlert, FileText, Sliders, AlertCircle, Sparkles, Eraser
} from 'lucide-vue-next'
import imglyRemoveBackground from '@imgly/background-removal'

const getShieldUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || auth.supervision?.id_colegio || 0))
const isSupervision = computed(() => auth.activeRole === 'admin_general')

// Component State
const activeTab = ref<'general' | 'identity'>('general')
const loading = ref(true)
const saving = ref(false)
const schoolData = ref<any>(null)
const kpis = ref({
  totalEstudiantes: 0,
  totalDocentes: 0,
  totalPadres: 0
})

// Visual Identity Form State
const form = ref({
  escudo_url: '',
  color_primario: '#4f46e5',
  color_secundario: '#0f172a'
})

// Original state to undo edits
const originalForm = ref({
  escudo_url: '',
  color_primario: '#4f46e5',
  color_secundario: '#0f172a'
})

// Form validations
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const validationError = ref('')
const extractedColors = ref<string[]>([])
const justification = ref('')

const fetchSchoolData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const response = await axios.get(`${API_BASE_URL}/api/academic-admin/my-school/${schoolId.value}`, { headers })
    if (response.data) {
      schoolData.value = response.data.school
      kpis.value = response.data.kpis
      
      const shield = response.data.school.escudo_url || ''
      const prim = response.data.school.color_primario || '#4f46e5'
      const sec = response.data.school.color_secundario || '#0f172a'
      
      form.value = { escudo_url: shield, color_primario: prim, color_secundario: sec }
      originalForm.value = { escudo_url: shield, color_primario: prim, color_secundario: sec }

      // Extract colors from the existing shield on load if it exists
      if (shield) {
        extractColorsFromUrl(getShieldUrl(shield))
      }
    }
  } catch (error) {
    console.error('Error fetching school details:', error)
  } finally {
    loading.value = false
  }
}

const activeColorMenu = ref<number | null>(null)

const toggleColorMenu = (idx: number) => {
  activeColorMenu.value = activeColorMenu.value === idx ? null : idx
}

const closeColorMenu = () => {
  activeColorMenu.value = null
}

onMounted(() => {
  fetchSchoolData()
  window.addEventListener('click', closeColorMenu)
})

onUnmounted(() => {
  window.removeEventListener('click', closeColorMenu)
})

const handleUploadClick = () => {
  fileInput.value?.click()
}

// Canvas-based Color Extractor
// Canvas-based Color Extractor Helper
const extractColorsFromImg = (img: HTMLImageElement): string[] => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  canvas.width = 100
  canvas.height = 100
  ctx.drawImage(img, 0, 0, 100, 100)
  const imgData = ctx.getImageData(0, 0, 100, 100).data
  
  const colorCounts: { [key: string]: number } = {}
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i]
    const g = imgData[i+1]
    const b = imgData[i+2]
    const a = imgData[i+3]
    
    if (a < 150) continue // Skip transparent pixels
    
    // Quantize colors (group close colors)
    const qr = Math.round(r / 15) * 15
    const qg = Math.round(g / 15) * 15
    const qb = Math.round(b / 15) * 15
    
    const hex = "#" + [qr, qg, qb].map(x => {
      const hexStr = x.toString(16)
      return hexStr.length === 1 ? '0' + hexStr : hexStr
    }).join('')
    
    colorCounts[hex] = (colorCounts[hex] || 0) + 1
  }
  
  const sortedColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
  
  const uniqueColors: string[] = []
  for (const color of sortedColors) {
    if (uniqueColors.length >= 6) break
    
    const r = parseInt(color.substring(1, 3), 16)
    const g = parseInt(color.substring(3, 5), 16)
    const b = parseInt(color.substring(5, 7), 16)
    
    const isWhite = r > 235 && g > 235 && b > 235
    const isBlack = r < 25 && g < 25 && b < 25
    
    const isSimilar = uniqueColors.some(uc => {
      const ur = parseInt(uc.substring(1, 3), 16)
      const ug = parseInt(uc.substring(3, 5), 16)
      const ub = parseInt(uc.substring(5, 7), 16)
      const diff = Math.abs(r - ur) + Math.abs(g - ug) + Math.abs(b - ub)
      return diff < 70
    })
    
    if (!isSimilar && !isWhite && !isBlack) {
      uniqueColors.push(color)
    }
  }
  
  // Fill up to at least 4 colors if possible
  if (uniqueColors.length < 4) {
    for (const color of sortedColors) {
      if (uniqueColors.length >= 5) break
      if (!uniqueColors.includes(color)) {
        uniqueColors.push(color)
      }
    }
  }
  return uniqueColors
}

const extractColorsFromImage = (file: File): Promise<string[]> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        resolve(extractColorsFromImg(img))
      }
    }
    reader.readAsDataURL(file)
  })
}

const extractColorsFromUrl = (url: string) => {
  const img = new Image()
  img.crossOrigin = 'Anonymous'
  img.src = url
  img.onload = () => {
    try {
      extractedColors.value = extractColorsFromImg(img)
    } catch (e) {
      console.warn('Canvas color extraction from URL failed:', e)
    }
  }
}

const processingBg = ref(false)
const bgStatusMsg = ref('')
const currentSelectedFile = ref<File | null>(null)

const uploadShieldFile = async (file: File) => {
  uploading.value = true
  try {
    const extracted = await extractColorsFromImage(file)
    extractedColors.value = extracted
    if (extracted.length > 0) {
      form.value.color_primario = extracted[0]
      if (extracted.length > 1) {
        form.value.color_secundario = extracted[1]
      }
    }

    const formData = new FormData()
    formData.append('escudo', file)
    
    const headers = { 
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'multipart/form-data'
    }
    const res = await axios.post(`${API_BASE_URL}/api/academic-admin/my-school/${schoolId.value}/identidad/upload-escudo`, formData, { headers })
    form.value.escudo_url = res.data.url
  } catch (error: any) {
    validationError.value = error.response?.data?.error || 'Error al cargar escudo.'
  } finally {
    uploading.value = false
  }
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const file = target.files[0]
  
  // Validation
  validationError.value = ''
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    validationError.value = 'Formato de escudo no soportado. Debe ser JPG, JPEG, PNG o SVG.'
    return
  }
  
  const maxSize = 2 * 1024 * 1024 // 2MB
  if (file.size > maxSize) {
    validationError.value = 'El archivo supera el tamaño máximo permitido de 2MB.'
    return
  }

  currentSelectedFile.value = file
  await uploadShieldFile(file)
}

// 1. Remove background with AI using @imgly/background-removal (Client-side)
const handleRemoveBgWithAi = async () => {
  if (!form.value.escudo_url && !currentSelectedFile.value) return
  
  processingBg.value = true
  bgStatusMsg.value = 'Procesando IA...'
  validationError.value = ''

  try {
    let source: string | Blob
    if (currentSelectedFile.value) {
      source = currentSelectedFile.value
    } else {
      const fullUrl = getShieldUrl(form.value.escudo_url)
      const response = await fetch(fullUrl)
      source = await response.blob()
    }

    const removeBgFn: any = (imglyRemoveBackground as any)?.removeBackground || imglyRemoveBackground
    const blob = await removeBgFn(source, {
      progress: (_key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.round((current / total) * 100)
          bgStatusMsg.value = `Procesando IA (${pct}%)...`
        }
      }
    })

    const cleanFile = new File([blob], 'escudo_sin_fondo.png', { type: 'image/png' })
    currentSelectedFile.value = cleanFile
    await uploadShieldFile(cleanFile)
  } catch (error: any) {
    console.error("Error al procesar fondo con IA:", error)
    validationError.value = 'No se pudo procesar la IA. Prueba con Fondo Blanco Transparente.'
  } finally {
    processingBg.value = false
    bgStatusMsg.value = ''
  }
}

// 2. Remove White Background using HTML5 Canvas threshold
const handleRemoveWhiteBg = async () => {
  if (!form.value.escudo_url && !currentSelectedFile.value) return

  processingBg.value = true
  bgStatusMsg.value = 'Limpiando fondo...'
  validationError.value = ''

  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    if (currentSelectedFile.value) {
      img.src = URL.createObjectURL(currentSelectedFile.value)
    } else {
      img.src = getShieldUrl(form.value.escudo_url)
    }

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Sin contexto de canvas')

    ctx.drawImage(img, 0, 0)
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imgData.data

    const threshold = 230 // White threshold
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold) {
        data[i + 3] = 0 // transparent
      }
    }
    ctx.putImageData(imgData, 0, 0)

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png')
    })

    const cleanFile = new File([blob], 'escudo_sin_fondo.png', { type: 'image/png' })
    currentSelectedFile.value = cleanFile
    await uploadShieldFile(cleanFile)
  } catch (error: any) {
    console.error("Error al limpiar fondo blanco:", error)
    validationError.value = 'Error al procesar la imagen.'
  } finally {
    processingBg.value = false
    bgStatusMsg.value = ''
  }
}

const applyColorSuggestion = (type: 'primary' | 'secondary', color: string) => {
  if (type === 'primary') {
    form.value.color_primario = color
  } else {
    form.value.color_secundario = color
  }
}

const undoChanges = () => {
  form.value = { ...originalForm.value }
  justification.value = ''
  validationError.value = ''
  extractedColors.value = []
}

const resetToDefaults = async () => {
  if (confirm('¿Estás seguro de que deseas restablecer los colores y escudo por defecto del colegio?')) {
    if (isSupervision.value && !justification.value.trim()) {
      alert('Por favor escribe la justificación para registrar esta modificación en la auditoría.')
      return
    }
    try {
      saving.value = true
      const headers = { Authorization: `Bearer ${auth.token}` }
      const payload = { motivo_cambio: isSupervision.value ? justification.value : undefined }
      
      await axios.post(`http://localhost:3000/api/academic-admin/my-school/${schoolId.value}/identidad/reset`, payload, { headers })
      
      form.value = { escudo_url: '', color_primario: '#4f46e5', color_secundario: '#0f172a' }
      originalForm.value = { escudo_url: '', color_primario: '#4f46e5', color_secundario: '#0f172a' }
      justification.value = ''
      alert('Identidad restablecida a los valores por defecto del sistema.')
      window.location.reload() // Reload page to immediately apply global stylesheet reset
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al restablecer valores por defecto.')
    } finally {
      saving.value = false
    }
  }
}

const saveChanges = async () => {
  if (isSupervision.value && !justification.value.trim()) {
    alert('Por favor escribe la justificación para registrar esta modificación en la auditoría.')
    return
  }

  try {
    saving.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const payload = {
      escudo_url: form.value.escudo_url,
      color_primario: form.value.color_primario,
      color_secundario: form.value.color_secundario,
      motivo_cambio: isSupervision.value ? justification.value : undefined
    }
    
    await axios.put(`http://localhost:3000/api/academic-admin/my-school/${schoolId.value}/identidad`, payload, { headers })
    originalForm.value = { ...form.value }
    justification.value = ''
    alert('Identidad visual actualizada exitosamente.')
    window.location.reload() // Reload to apply CSS custom properties immediately globally
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar los cambios.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <!-- Header banner -->
    <div class="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm md:p-10 dark:bg-slate-900 dark:border-slate-800">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-650 dark:text-indigo-400">
            <School :size="32" />
          </div>
          <div>
            <h1 class="text-3xl font-black text-slate-900 dark:text-white leading-none">Mi Colegio</h1>
            <p class="mt-2 text-slate-500 dark:text-slate-400">Visualiza los datos institucionales y gestiona el escudo y los colores de la plataforma.</p>
          </div>
        </div>

        <!-- Supervision notice -->
        <div v-if="isSupervision" class="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-black text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">
          <ShieldAlert :size="16" class="animate-pulse" />
          <span>Modo Supervisión: Modificando como Editor. Se requiere justificación.</span>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-20 text-center shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <RefreshCw class="animate-spin h-8 w-8 mx-auto text-indigo-650 mb-3" />
      <span class="font-bold text-slate-400">Cargando información del colegio...</span>
    </div>

    <template v-else-if="schoolData">
      <!-- Tabs -->
      <div class="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-2xl w-fit shrink-0">
        <button 
          @click="activeTab = 'general'"
          :class="[
            activeTab === 'general' ? 'bg-white dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
            'px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2'
          ]"
        >
          <FileText :size="15" />
          Información General
        </button>
        <button 
          @click="activeTab = 'identity'"
          :class="[
            activeTab === 'identity' ? 'bg-white dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
            'px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2'
          ]"
        >
          <Palette :size="15" />
          Identidad Visual
        </button>
      </div>

      <!-- Tab Content: General Info -->
      <div v-if="activeTab === 'general'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main stats & card details -->
        <div class="lg:col-span-2 space-y-8">
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
            <h2 class="text-xl font-black text-slate-900 dark:text-white mb-6 border-b border-slate-50 dark:border-slate-800/50 pb-3">Detalles Institucionales</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div class="flex items-start gap-3">
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <School :size="18" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre del Colegio</p>
                  <p class="font-extrabold text-slate-800 dark:text-white mt-0.5">{{ schoolData.nombre }}</p>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <Hash :size="18" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Código DANE</p>
                  <p class="font-bold text-slate-800 dark:text-white mt-0.5 font-mono">{{ schoolData.dane }}</p>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <MapPin :size="18" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Sede</p>
                  <p class="font-semibold text-slate-800 dark:text-slate-350 mt-0.5">{{ schoolData.sede || 'Sede Principal' }}</p>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <Sliders :size="18" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo Colegio</p>
                  <p class="font-semibold text-slate-800 dark:text-slate-350 mt-0.5">{{ schoolData.tipo_colegio }}</p>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <Mail :size="18" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Correo Institucional</p>
                  <p class="font-semibold text-slate-800 dark:text-slate-350 mt-0.5">{{ schoolData.correo }}</p>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <Phone :size="18" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Contacto Telefónico</p>
                  <p class="font-semibold text-slate-800 dark:text-slate-350 mt-0.5">{{ schoolData.contacto || 'No registrado' }}</p>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <Calendar :size="18" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Calendario</p>
                  <p class="font-bold text-slate-800 dark:text-white mt-0.5">Calendario {{ schoolData.tipo_calendario || 'A' }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- School KPIs -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div class="p-3 bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 rounded-2xl">
                <Users :size="24" />
              </div>
              <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Estudiantes Activos</p>
                <h3 class="text-2xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">{{ kpis.totalEstudiantes }}</h3>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <Users :size="24" />
              </div>
              <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Docentes Activos</p>
                <h3 class="text-2xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">{{ kpis.totalDocentes }}</h3>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div class="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 rounded-2xl">
                <Users :size="24" />
              </div>
              <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Padres Registrados</p>
                <h3 class="text-2xl font-black text-slate-900 dark:text-white mt-0.5 font-mono">{{ kpis.totalPadres }}</h3>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar visual card -->
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
            <h4 class="text-xs font-black text-slate-400 uppercase tracking-wider self-start">Escudo del Colegio</h4>
            
            <div class="w-40 h-40 rounded-full bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden">
              <img v-if="form.escudo_url" :src="`http://localhost:3000${form.escudo_url}`" alt="Escudo" class="w-full h-full object-contain" />
              <School v-else class="text-slate-300 dark:text-slate-700" :size="72" />
            </div>
            
            <h3 class="font-extrabold text-slate-900 dark:text-white text-lg">{{ schoolData.nombre }}</h3>
            <p class="text-xs text-slate-500 max-w-[200px]">Usa la pestaña de Identidad Visual para cambiar el escudo y personalizar la paleta de colores de la plataforma.</p>
          </div>
        </div>
      </div>

      <!-- Tab Content: Visual Identity -->
      <div v-else-if="activeTab === 'identity'" class="grid grid-cols-1 xl:grid-cols-5 gap-8">
        <!-- Configuration Controls -->
        <div class="xl:col-span-3 space-y-6">
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-6">
            <h2 class="text-xl font-black text-slate-900 dark:text-white border-b border-slate-50 dark:border-slate-800/50 pb-3">Personalizar Identidad Visual</h2>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <!-- Upload Escudo -->
              <div class="md:col-span-1 space-y-2">
                <label class="text-xs font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">Cargar Escudo</label>
                <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileChange" />
                
                <div 
                  @click="handleUploadClick"
                  class="w-full aspect-square border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all overflow-hidden relative group"
                >
                  <img v-if="form.escudo_url" :src="getShieldUrl(form.escudo_url)" class="w-full h-full object-contain p-3" alt="Escudo" />
                  <div v-else-if="uploading" class="text-center p-3 text-slate-400">
                    <RefreshCw class="animate-spin h-6 w-6 mx-auto mb-1 text-slate-400" />
                    <span class="text-[10px] font-bold">Subiendo...</span>
                  </div>
                  <div v-else class="text-center p-3">
                    <Upload class="mx-auto mb-1.5 text-slate-400" :size="20" />
                    <span class="text-[10px] font-bold text-slate-400">Subir Escudo</span>
                  </div>
                  
                  <div v-if="form.escudo_url && !uploading" class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                    <span class="text-xs text-white font-bold">Cambiar Imagen</span>
                  </div>
                </div>

                <!-- Actions for background removal -->
                <div v-if="form.escudo_url" class="space-y-1.5 pt-2">
                  <button 
                    @click="handleRemoveBgWithAi"
                    :disabled="uploading || processingBg"
                    type="button"
                    class="w-full py-2 px-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
                  >
                    <Sparkles class="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                    <span>{{ processingBg ? bgStatusMsg || 'Procesando IA...' : '🪄 Quitar Fondo con IA' }}</span>
                  </button>
                  <button 
                    @click="handleRemoveWhiteBg"
                    :disabled="uploading || processingBg"
                    type="button"
                    class="w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Eraser class="w-3.5 h-3.5 text-slate-400" />
                    <span>🧼 Limpiar Fondo Blanco</span>
                  </button>
                </div>

                <p v-if="validationError" class="text-[10px] text-red-500 font-bold mt-1.5 flex items-center gap-1"><AlertCircle :size="12" /> {{ validationError }}</p>
                <p class="text-[9px] text-slate-400 leading-normal mt-1 font-semibold">JPG, JPEG, PNG, SVG (Máx. 2MB)</p>
              </div>

              <!-- Color Selectors -->
              <div class="md:col-span-2 space-y-4">
                <label class="text-xs font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider block">Colores del Colegio</label>

                <!-- Color Pickers -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <!-- Primary Color -->
                  <div class="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-2">
                    <span class="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Color Primario</span>
                    <div class="flex items-center gap-2">
                      <div class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden shrink-0" :style="{ backgroundColor: form.color_primario }">
                        <input type="color" v-model="form.color_primario" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </div>
                      <input type="text" v-model="form.color_primario" class="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none text-slate-800 dark:text-white" />
                    </div>
                  </div>

                  <!-- Secondary Color -->
                  <div class="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 space-y-2">
                    <span class="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Color Secundario</span>
                    <div class="flex items-center gap-2">
                      <div class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden shrink-0" :style="{ backgroundColor: form.color_secundario }">
                        <input type="color" v-model="form.color_secundario" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </div>
                      <input type="text" v-model="form.color_secundario" class="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none text-slate-800 dark:text-white" />
                    </div>
                  </div>
                </div>

                <!-- Extracted Color Suggestions -->
                <div v-if="extractedColors.length > 0" class="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Colores Sugeridos del Escudo</span>
                  <div class="flex flex-wrap gap-2">
                    <div 
                      v-for="(color, idx) in extractedColors" 
                      :key="idx"
                      @click.stop="toggleColorMenu(idx)"
                      class="relative w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-110 transition-all flex items-center justify-center"
                      :style="{ backgroundColor: color }"
                      :title="color"
                    >
                      <!-- Apply color drop-down/helper inside tooltip -->
                      <div 
                        v-if="activeColorMenu === idx"
                        @click.stop
                        class="absolute bottom-full mb-2 bg-slate-900 text-white rounded p-1.5 text-[8px] flex flex-col gap-1 w-24 z-20 shadow-xl border border-slate-800"
                      >
                        <button @click="applyColorSuggestion('primary', color); closeColorMenu()" class="hover:bg-slate-800 px-2 py-1 rounded text-left font-bold transition-colors">Usar Primario</button>
                        <button @click="applyColorSuggestion('secondary', color); closeColorMenu()" class="hover:bg-slate-850 px-2 py-1 rounded text-left font-bold transition-colors">Usar Secundario</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Supervision Audit Justification -->
            <div v-if="isSupervision" class="space-y-2 bg-amber-50/50 dark:bg-amber-950/15 border border-amber-250/30 p-5 rounded-2xl">
              <span class="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1"><ShieldAlert :size="14" /> Justificación del Cambio (Auditoría) *</span>
              <textarea 
                v-model="justification" 
                placeholder="Por favor detalla el motivo formal de esta modificación como administrador supervisor..." 
                rows="2"
                class="w-full bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-3 text-xs font-bold outline-none text-slate-950 dark:text-white resize-none"
              ></textarea>
            </div>

            <!-- Form Action buttons -->
            <div class="flex flex-wrap gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
              <button @click="resetToDefaults" :disabled="saving" class="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shrink-0">
                <RefreshCw :size="14" />
                Restablecer por defecto
              </button>
              
              <div class="flex-1"></div>
              
              <button @click="undoChanges" :disabled="saving" class="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-bold transition-all">
                <Undo :size="14" />
                Deshacer cambios
              </button>
              
              <button @click="saveChanges" :disabled="saving" class="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md">
                <Check :size="14" />
                {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Live Mockup Visualizer -->
        <div class="xl:col-span-2 space-y-6">
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div class="flex items-center gap-1.5 text-slate-400">
              <HelpCircle :size="16" />
              <h3 class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Vista Previa Interactiva</h3>
            </div>

            <!-- Simulated dashboard browser window mockup -->
            <div class="w-full aspect-[4/3] rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col shadow-inner">
              <!-- Window header -->
              <div class="h-8 bg-slate-200/60 dark:bg-slate-900 px-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div class="flex gap-1.5">
                  <div class="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                  <div class="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                </div>
                <div class="mx-auto w-1/2 h-4 bg-white/60 dark:bg-slate-800 rounded-md flex items-center justify-center text-[7px] text-slate-400 font-bold truncate">
                  {{ schoolData.nombre }}.academianeiva.edu.co/dashboard
                </div>
              </div>

              <!-- Main Dashboard Area inside mockup -->
              <div class="flex-1 flex min-h-0">
                <!-- Sidebar mockup -->
                <div class="w-16 bg-white dark:bg-slate-900 border-r border-slate-200/50 dark:border-slate-800 flex flex-col items-center py-3 space-y-4 shrink-0">
                  <!-- dynamic logo -->
                  <div class="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-slate-100/50 p-1 border border-slate-100 dark:border-slate-800" :style="{ borderColor: form.color_primario + '33' }">
                    <img v-if="form.escudo_url" :src="getShieldUrl(form.escudo_url)" class="w-full h-full object-contain" />
                    <School v-else :style="{ color: form.color_primario }" :size="16" />
                  </div>
                  <!-- navigation links mockup -->
                  <div class="space-y-1 w-full px-2 flex flex-col items-center">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white" :style="{ backgroundColor: form.color_primario }">
                      <div class="w-4 h-4 bg-white/20 rounded"></div>
                    </div>
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400">
                      <div class="w-4 h-4 bg-slate-300 dark:bg-slate-700 rounded"></div>
                    </div>
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400">
                      <div class="w-4 h-4 bg-slate-300 dark:bg-slate-700 rounded"></div>
                    </div>
                  </div>
                </div>

                <!-- Page Area mockup -->
                <div class="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 p-4 space-y-4 overflow-y-auto">
                  <!-- Topbar mockup -->
                  <div class="h-8 bg-white dark:bg-slate-900 border border-slate-200/30 rounded-xl px-4 flex items-center justify-between shrink-0">
                    <span class="text-[8px] font-black text-slate-800 dark:text-white truncate max-w-[80px]">{{ schoolData.nombre }}</span>
                    <div class="flex items-center gap-1.5">
                      <span class="text-[6px] font-bold text-slate-400">Año 2026</span>
                      <div class="w-4 h-4 rounded-full bg-slate-100 border flex items-center justify-center text-[7px]" :style="{ color: form.color_primario }">U</div>
                    </div>
                  </div>

                  <!-- Page contents mockup -->
                  <div class="space-y-3">
                    <div class="h-3 w-1/3 bg-slate-300 dark:bg-slate-700 rounded"></div>
                    
                    <!-- KPI Card Mockup -->
                    <div class="grid grid-cols-2 gap-3">
                      <div class="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/30 flex items-center gap-2">
                        <div class="p-1.5 rounded-lg text-white" :style="{ backgroundColor: form.color_primario }">
                          <Users :size="10" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <span class="text-[6px] text-slate-400 uppercase tracking-wider block">Estudiantes</span>
                          <span class="text-xs font-black block mt-0.5 leading-none">{{ kpis.totalEstudiantes }}</span>
                        </div>
                      </div>

                      <div class="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/30 flex items-center gap-2">
                        <!-- Secondary brand indicator border/bg -->
                        <div class="p-1.5 rounded-lg text-white" :style="{ backgroundColor: form.color_secundario }">
                          <Palette :size="10" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <span class="text-[6px] text-slate-400 uppercase tracking-wider block">Colores</span>
                          <span class="text-xs font-black block mt-0.5 leading-none">2</span>
                        </div>
                      </div>
                    </div>

                    <!-- Button & elements preview mockup -->
                    <div class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/30 space-y-3">
                      <div class="h-2 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                      <div class="h-2 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                      
                      <div class="flex gap-2 pt-2">
                        <!-- Primary button style preview -->
                        <button class="px-3 py-1.5 rounded-lg text-[7px] font-black text-white hover:opacity-90 active:scale-95 transition-all" :style="{ backgroundColor: form.color_primario }">
                          Botón Primario
                        </button>
                        <!-- Secondary/border link mockup -->
                        <button class="px-3 py-1.5 rounded-lg text-[7px] font-bold border hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-350" :style="{ borderColor: form.color_primario + '4D', color: form.color_primario }">
                          Botón Borde
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <p class="text-[10px] text-slate-400 leading-relaxed text-center font-semibold mt-2">
              El mockup interactivo muestra en tiempo real cómo lucirán tus colores en el menú principal, los botones y componentes del sistema.
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
</style>
