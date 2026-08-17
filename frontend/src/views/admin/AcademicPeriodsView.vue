<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { ArrowLeft, BookMarked, PenSquare, Plus, Info, Trash2, Play, Lock, ShieldAlert, Check } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

interface AcademicYear {
  id_anio: number
  calendario: string | null
  tipo_calendario?: string | null
  estado?: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

interface AcademicPeriod {
  id_periodo: number
  nombre: string
  estado: 'ABIERTO' | 'CERRADO' | 'PENDIENTE'
  porcentaje: number
  mes_inicio: number | null
  dia_inicio: number | null
  mes_fin: number | null
  dia_fin: number | null
  meses_referencia?: string | null
  id_anio: number
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const savingPeriod = ref(false)
const yearSaving = ref(false)

const currentYear = ref<AcademicYear | null>(null)
const academicYears = ref<AcademicYear[]>([])
const periods = ref<AcademicPeriod[]>([])

const periodModal = ref(false)
const periodEditModal = ref<AcademicPeriod | null>(null)

// Success year creation alert state
const yearSuccessMessage = ref<string | null>(null)
const yearSuccessPeriods = ref<any[]>([])
const showYearSuccessAlert = ref(false)

// Editor mode states
const editorModeActive = ref(false)
const showEditorWarningModal = ref(false)
const deletingYearId = ref<number | null>(null)
const togglingYearId = ref<number | null>(null)

const toggleYearStatus = async (year: AcademicYear) => {
  if (togglingYearId.value) return
  const currentStatus = year.estado || 'ABIERTO'
  const targetStatus = currentStatus === 'ABIERTO' ? 'CERRADO' : 'ABIERTO'
  try {
    togglingYearId.value = year.id_anio
    const response = await axios.patch(`/api/academic-admin/settings/years/${year.id_anio}/status`, {
      schoolId: schoolId.value,
      estado: targetStatus,
    })
    
    // Update local state
    const updated = response.data
    const found = academicYears.value.find(y => y.id_anio === year.id_anio)
    if (found) {
      found.estado = updated.estado
    }
    if (currentYear.value?.id_anio === year.id_anio) {
      currentYear.value.estado = updated.estado
    }
    if (schoolId.value) {
      await yearStore.loadYearsForSchool(schoolId.value, auth.token || undefined)
    }
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible actualizar el estado del año lectivo')
  } finally {
    togglingYearId.value = null
  }
}

const deleteYear = async (year: AcademicYear) => {
  if (deletingYearId.value) return
  if (year.estado === 'CERRADO') {
    alert(`El año lectivo ${year.calendario} está CERRADO y contiene historial académico. No puede ser eliminado.`)
    return
  }
  const confirmStr = prompt(`¿Está seguro de eliminar el año lectivo ${year.calendario}? Esta acción borrará permanentemente el año y todos sus periodos.\n\nEscriba "ELIMINAR" para confirmar:`)
  if (confirmStr !== 'ELIMINAR') {
    return
  }

  try {
    deletingYearId.value = year.id_anio
    const response = await axios.delete(`/api/academic-admin/settings/years/${year.id_anio}`, {
      data: { schoolId: schoolId.value }
    })
    
    alert(response.data?.message || `Año lectivo ${year.calendario} eliminado correctamente.`)
    
    if (selectedYearId.value === year.id_anio) {
      selectedYearId.value = null
    }
    if (schoolId.value) {
      await yearStore.loadYearsForSchool(schoolId.value, auth.token || undefined)
    }
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible eliminar el año lectivo')
  } finally {
    deletingYearId.value = null
  }
}

const newPeriod = ref({
  nombre: '',
  porcentaje: '',
  mes_inicio: '',
  dia_inicio: '',
  mes_fin: '',
  dia_fin: '',
})

const periodEdit = ref({
  porcentaje: '',
  mes_inicio: '',
  dia_inicio: '',
  mes_fin: '',
  dia_fin: '',
})

const yearModal = ref(false)

const academicYearForm = ref({
  year_number: '2026',
  tipo_calendario: 'A',
  fecha_inicio: '2026-01-15',
  fecha_fin: '2026-11-30',
})

const computedCalendarioLabel = computed(() => {
  const y = Number(academicYearForm.value.year_number) || 2026
  if (academicYearForm.value.tipo_calendario === 'B') {
    return `${y - 1}-${y}`
  }
  return `${y}`
})

const dateOverlapWarning = computed(() => {
  if (!academicYearForm.value.fecha_inicio || !academicYearForm.value.fecha_fin) return null
  const fStart = academicYearForm.value.fecha_inicio
  const fEnd = academicYearForm.value.fecha_fin

  const overlappingYear = academicYears.value.find(y => {
    if (!y.fecha_inicio || !y.fecha_fin) return false
    const yStart = String(y.fecha_inicio).split('T')[0]
    const yEnd = String(y.fecha_fin).split('T')[0]
    return fStart <= yEnd && fEnd >= yStart
  })

  if (overlappingYear) {
    const yStart = String(overlappingYear.fecha_inicio).split('T')[0]
    const yEnd = String(overlappingYear.fecha_fin).split('T')[0]
    return `Las fechas de vigencia (${fStart} al ${fEnd}) se cruzan con el año lectivo '${overlappingYear.calendario}' (${yStart} al ${yEnd}).`
  }
  return null
})

watch(
  [() => academicYearForm.value.year_number, () => academicYearForm.value.tipo_calendario, () => academicYears.value],
  ([newYearNum, newCalType]) => {
    const y = Number(newYearNum) || 2026
    let propStart = newCalType === 'B' ? `${y - 1}-09-01` : `${y}-01-15`
    let propEnd = newCalType === 'B' ? `${y}-06-30` : `${y}-11-30`

    // Find any existing year that overlaps with proposed dates
    const overlapping = academicYears.value.filter(existingYear => {
      if (!existingYear.fecha_inicio || !existingYear.fecha_fin) return false
      const yStart = String(existingYear.fecha_inicio).split('T')[0]
      const yEnd = String(existingYear.fecha_fin).split('T')[0]
      return propStart <= yEnd && propEnd >= yStart
    })

    if (overlapping.length > 0) {
      // Find latest end date among overlapping years to suggest next available date
      const latestEndStr = overlapping.map(o => String(o.fecha_fin).split('T')[0]).sort().pop()
      if (latestEndStr) {
        const latestEndDate = new Date(latestEndStr)
        latestEndDate.setDate(latestEndDate.getDate() + 1)
        const adjustedStartStr = latestEndDate.toISOString().split('T')[0]
        
        if (adjustedStartStr < propEnd) {
          propStart = adjustedStartStr
        }
      }
    }

    academicYearForm.value.fecha_inicio = propStart
    academicYearForm.value.fecha_fin = propEnd
  },
  { immediate: true, deep: true }
)

const months = [
  { id: 1, name: 'Enero' },
  { id: 2, name: 'Febrero' },
  { id: 3, name: 'Marzo' },
  { id: 4, name: 'Abril' },
  { id: 5, name: 'Mayo' },
  { id: 6, name: 'Junio' },
  { id: 7, name: 'Julio' },
  { id: 8, name: 'Agosto' },
  { id: 9, name: 'Septiembre' },
  { id: 10, name: 'Octubre' },
  { id: 11, name: 'Noviembre' },
  { id: 12, name: 'Diciembre' },
]

import { useAcademicYearStore } from '../../stores/academicYear'

const yearStore = useAcademicYearStore()
const selectedYearId = ref<number | null>(yearStore.selectedYearId)

watch(() => yearStore.selectedYearId, (newVal) => {
  if (newVal) selectedYearId.value = newVal
}, { immediate: true })

watch(selectedYearId, (newVal) => {
  if (newVal && newVal !== yearStore.selectedYearId) {
    yearStore.setSelectedYearId(newVal)
  }
  loadData()
})

const selectedYearObj = computed(() =>
  academicYears.value.find(y => y.id_anio === selectedYearId.value)
)

const isYearClosed = computed(() => {
  if (!selectedYearObj.value) return false
  const status = String(selectedYearObj.value.estado || '').toUpperCase()
  return status === 'CERRADO' || status === 'INACTIVO'
})

const filteredPeriods = computed(() => {
  if (!selectedYearId.value) return periods.value
  return periods.value.filter(p => p.id_anio === selectedYearId.value)
})

const totalPeriodPercentage = computed(() =>
  filteredPeriods.value.reduce((sum, item) => sum + Number(item.porcentaje), 0)
)

const loadData = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const params: any = { keys: 'years,periods' }
    const activeYearId = selectedYearId.value || yearStore.selectedYearId
    if (activeYearId) {
      params.yearId = activeYearId
    }
    const response = await axios.get(`/api/academic-admin/settings/${schoolId.value}`, { params })
    currentYear.value = response.data.currentYear
    academicYears.value = response.data.academicYears || []
    periods.value = response.data.periods
    
    // Set selected year to current active year on first load if not already set
    if (!selectedYearId.value && currentYear.value) {
      selectedYearId.value = currentYear.value.id_anio
    }
  } catch (error) {
    console.error('Error loading academic settings:', error)
  } finally {
    loading.value = false
  }
}

const createPeriod = async () => {
  if (savingPeriod.value) return
  if (isYearClosed.value) {
    alert(`El año lectivo ${selectedYearObj.value?.calendario || ''} está CERRADO. No es posible crear periodos en un ciclo escolar cerrado.`)
    return
  }
  const mesInicio = Number(newPeriod.value.mes_inicio)
  const diaInicio = Number(newPeriod.value.dia_inicio)
  const mesFin = Number(newPeriod.value.mes_fin)
  const diaFin = Number(newPeriod.value.dia_fin)

  if (!mesInicio || !diaInicio || !mesFin || !diaFin) {
    alert('Debe definir el rango de fechas (Mes y Día de inicio y fin).')
    return
  }

  try {
    savingPeriod.value = true
    await axios.post('/api/academic-admin/settings/periods', {
      schoolId: schoolId.value,
      nombre: newPeriod.value.nombre,
      porcentaje: Number(newPeriod.value.porcentaje),
      mes_inicio: mesInicio,
      dia_inicio: diaInicio,
      mes_fin: mesFin,
      dia_fin: diaFin,
      id_anio: selectedYearId.value,
    })
    newPeriod.value = { nombre: '', porcentaje: '', mes_inicio: '', dia_inicio: '', mes_fin: '', dia_fin: '' }
    periodModal.value = false
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible crear el periodo')
  } finally {
    savingPeriod.value = false
  }
}

const updatePeriodPercentage = async () => {
  if (!periodEditModal.value || savingPeriod.value) return
  if (isYearClosed.value) {
    alert(`El año lectivo ${selectedYearObj.value?.calendario || ''} está CERRADO. No es posible modificar periodos en un ciclo escolar cerrado.`)
    return
  }
  const mesInicio = Number(periodEdit.value.mes_inicio)
  const diaInicio = Number(periodEdit.value.dia_inicio)
  const mesFin = Number(periodEdit.value.mes_fin)
  const diaFin = Number(periodEdit.value.dia_fin)

  if (!mesInicio || !diaInicio || !mesFin || !diaFin) {
    alert('Debe definir el rango de fechas completo.')
    return
  }

  try {
    savingPeriod.value = true
    await axios.patch(`/api/academic-admin/settings/periods/${periodEditModal.value.id_periodo}/percentage`, {
      schoolId: schoolId.value,
      porcentaje: Number(periodEdit.value.porcentaje),
      mes_inicio: mesInicio,
      dia_inicio: diaInicio,
      mes_fin: mesFin,
      dia_fin: diaFin,
    })
    periodEditModal.value = null
    periodEdit.value = { porcentaje: '', mes_inicio: '', dia_inicio: '', mes_fin: '', dia_fin: '' }
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible actualizar la configuración del periodo')
  } finally {
    savingPeriod.value = false
  }
}

const approvePeriod = async (period: AcademicPeriod) => {
  if (isYearClosed.value) {
    alert(`El año lectivo ${selectedYearObj.value?.calendario || ''} está CERRADO. No es posible aprobar periodos en un ciclo escolar cerrado.`)
    return
  }
  const confirmApprove = confirm(`¿Está seguro de aprobar y activar el periodo "${period.nombre}"?`)
  if (!confirmApprove) return

  try {
    loading.value = true
    await axios.post(`/api/academic-admin/settings/periods/${period.id_periodo}/approve`, {
      schoolId: schoolId.value,
    })
    alert('Periodo académico aprobado y activado correctamente.')
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible aprobar el periodo')
  } finally {
    loading.value = false
  }
}

const closingPeriodId = ref<number | null>(null)
const reopeningPeriodId = ref<number | null>(null)

const closePeriod = async (period: AcademicPeriod, force = false) => {
  if (closingPeriodId.value) return
  if (isYearClosed.value) {
    alert(`El año lectivo ${selectedYearObj.value?.calendario || ''} ya se encuentra CERRADO.`)
    return
  }
  
  if (!force) {
    const confirmClose = confirm(`¿Está seguro de cerrar el periodo "${period.nombre}"? Los docentes no podrán registrar calificaciones para este periodo.`)
    if (!confirmClose) return
  }

  try {
    closingPeriodId.value = period.id_periodo
    await axios.post(`/api/academic-admin/settings/periods/${period.id_periodo}/close`, {
      schoolId: schoolId.value,
      force
    })
    alert(`Periodo "${period.nombre}" cerrado correctamente.`)
    await loadData()
  } catch (error: any) {
    if (error.response?.status === 409 && error.response?.data?.pending) {
      const pendingCount = error.response.data.pending.length
      const forceConfirm = confirm(`No se puede cerrar el periodo porque hay ${pendingCount} asignación(es) académica(s) pendiente(s) de cerrar por los docentes.\n\n¿Desea forzar el cierre de todas formas?`)
      if (forceConfirm) {
        await closePeriod(period, true)
      }
      return
    }
    alert(error.response?.data?.error || 'No fue posible cerrar el periodo')
  } finally {
    closingPeriodId.value = null
  }
}

const reopenPeriod = async (period: AcademicPeriod) => {
  if (reopeningPeriodId.value) return
  if (isYearClosed.value) {
    alert(`El año lectivo ${selectedYearObj.value?.calendario || ''} está CERRADO. Debe reabrir el año lectivo en la lista de años antes de reabrir sus periodos individuales.`)
    return
  }

  const warningMsg = `⚠️ ADVERTENCIA: Al reabrir el periodo "${period.nombre}", todos los docentes y directivos del colegio podrán ingresar y modificar calificaciones de este periodo de manera global.\n\nEsta acción requiere justificación obligatoria.\n\n¿Desea continuar?`
  if (!confirm(warningMsg)) return

  const motivo = prompt(`Escriba el motivo de la reapertura del periodo (Obligatorio):`)
  if (!motivo || !motivo.trim()) {
    alert('Acción cancelada. Se requiere ingresar un motivo válido para reabrir el periodo.')
    return
  }

  try {
    reopeningPeriodId.value = period.id_periodo
    await axios.post(`/api/academic-admin/settings/periods/${period.id_periodo}/reopen`, {
      schoolId: schoolId.value,
      motivo: motivo.trim()
    })
    alert(`Periodo "${period.nombre}" reabierto correctamente.`)
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible reabrir el periodo')
  } finally {
    reopeningPeriodId.value = null
  }
}

const createAcademicYear = async () => {
  if (yearSaving.value) return
  if (!academicYearForm.value.year_number) {
    alert('Ingresa el año lectivo (número, ej. 2026).')
    return
  }
  if (dateOverlapWarning.value) {
    alert(`No es posible crear el año lectivo:\n\n${dateOverlapWarning.value}`)
    return
  }

  const finalLabel = computedCalendarioLabel.value

  try {
    yearSaving.value = true
    const response = await axios.post('/api/academic-admin/settings/years', {
      schoolId: schoolId.value,
      calendario: finalLabel,
      tipo_calendario: academicYearForm.value.tipo_calendario,
      fecha_inicio: academicYearForm.value.fecha_inicio,
      fecha_fin: academicYearForm.value.fecha_fin,
    })
    
    alert(response.data.message || 'Año lectivo creado correctamente.')
    
    if (schoolId.value) {
      await yearStore.loadYearsForSchool(schoolId.value, auth.token || undefined)
    }

    if (response.data.id_anio) {
      selectedYearId.value = response.data.id_anio
      yearStore.setSelectedYearId(response.data.id_anio)
    }

    yearModal.value = false
    academicYearForm.value = { year_number: '2026', tipo_calendario: 'A', fecha_inicio: '2026-01-15', fecha_fin: '2026-11-30' }
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible crear el año lectivo')
  } finally {
    yearSaving.value = false
  }
}

const formatYearDates = (year: AcademicYear) => {
  if (year.fecha_inicio && year.fecha_fin) {
    const start = String(year.fecha_inicio).split('T')[0]
    const end = String(year.fecha_fin).split('T')[0]
    return `${start} al ${end}`
  }
  const cal = year.calendario || '2026'
  const matches = cal.match(/\d{4}/g)
  const endYear = matches ? matches[matches.length - 1] : '2026'
  const startYear = matches && matches.length > 1 ? matches[0] : (year.tipo_calendario === 'B' ? String(Number(endYear) - 1) : endYear)
  if (year.tipo_calendario === 'B') {
    return `${startYear}-09-01 al ${endYear}-06-30`
  }
  return `${startYear}-01-15 al ${endYear}-11-30`
}

const changingCalendarYearId = ref<number | null>(null)

const changeYearCalendarType = async (year: AcademicYear, newType: string) => {
  if (!editorModeActive.value) {
    alert('Debes activar el Modo Editor para cambiar el tipo de calendario de un año lectivo.')
    return
  }
  if (changingCalendarYearId.value) return
  if (year.tipo_calendario === newType) return

  const confirmMsg = `¿Desea cambiar el calendario del año lectivo a Calendario ${newType}? Esto actualizará las fechas oficiales de sus periodos.`
  if (!confirm(confirmMsg)) return

  try {
    changingCalendarYearId.value = year.id_anio
    const response = await axios.patch(`/api/academic-admin/settings/years/${year.id_anio}/calendar-type`, {
      schoolId: schoolId.value,
      tipo_calendario: newType
    })

    alert(response.data.message || 'Tipo de calendario actualizado correctamente.')
    if (schoolId.value) {
      await yearStore.loadYearsForSchool(schoolId.value, auth.token || undefined)
    }
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible cambiar el tipo de calendario')
    await loadData()
  } finally {
    changingCalendarYearId.value = null
  }
}

const standardPeriodPresets = [
  {
    nombre: 'Primer Periodo',
    trimestre: 1,
    porcentaje: 25,
    calendarioA: { mes_inicio: 1, dia_inicio: 15, mes_fin: 4, dia_fin: 4 },
    calendarioB: { mes_inicio: 9, dia_inicio: 1, mes_fin: 11, dia_fin: 15 }
  },
  {
    nombre: 'Segundo Periodo',
    trimestre: 2,
    porcentaje: 25,
    calendarioA: { mes_inicio: 4, dia_inicio: 5, mes_fin: 6, dia_fin: 23 },
    calendarioB: { mes_inicio: 11, dia_inicio: 16, mes_fin: 1, dia_fin: 29 }
  },
  {
    nombre: 'Tercer Periodo',
    trimestre: 3,
    porcentaje: 25,
    calendarioA: { mes_inicio: 6, dia_inicio: 24, mes_fin: 9, dia_fin: 11 },
    calendarioB: { mes_inicio: 1, dia_inicio: 30, mes_fin: 4, dia_fin: 14 }
  },
  {
    nombre: 'Cuarto Periodo',
    trimestre: 4,
    porcentaje: 25,
    calendarioA: { mes_inicio: 9, dia_inicio: 12, mes_fin: 11, dia_fin: 30 },
    calendarioB: { mes_inicio: 4, dia_inicio: 15, mes_fin: 6, dia_fin: 30 }
  }
]

const availablePresets = computed(() => {
  const existingNames = filteredPeriods.value.map(p => p.nombre.toLowerCase().trim())
  return standardPeriodPresets.filter(preset => !existingNames.includes(preset.nombre.toLowerCase().trim()))
})

const onPresetSelected = (presetNombre: string) => {
  const preset = standardPeriodPresets.find(p => p.nombre === presetNombre)
  if (!preset) return
  const isB = selectedYearObj.value?.tipo_calendario === 'B'
  const dates = isB ? preset.calendarioB : preset.calendarioA
  
  newPeriod.value = {
    nombre: preset.nombre,
    porcentaje: String(preset.porcentaje),
    mes_inicio: String(dates.mes_inicio),
    dia_inicio: String(dates.dia_inicio),
    mes_fin: String(dates.mes_fin),
    dia_fin: String(dates.dia_fin)
  }
}

const deletePeriod = async (period: AcademicPeriod) => {
  if (!confirm(`¿Está seguro de eliminar el periodo "${period.nombre}"?`)) return
  try {
    loading.value = true
    await axios.delete(`/api/academic-admin/settings/periods/${period.id_periodo}`, {
      data: { schoolId: schoolId.value }
    })
    alert(`Periodo ${period.nombre} eliminado correctamente.`)
    await loadData()
  } catch (error: any) {
    alert(error.response?.data?.error || 'No fue posible eliminar el periodo académico')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="flex items-center gap-4">
        <router-link to="/dashboard/configuracion-academica" class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 border border-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800">
          <ArrowLeft class="h-5 w-5" />
        </router-link>
        <div>
          <h1 class="text-3xl font-black text-slate-900 dark:text-white">Años y Periodos</h1>
          <p class="mt-1 text-slate-500 dark:text-slate-400">Administra los años lectivos y sus distribuciones por periodos.</p>
        </div>
      </div>
      <div class="rounded-2xl bg-orange-50 px-5 py-4 text-sm font-black text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
        Año lectivo activo: {{ currentYear ? currentYear.calendario : 'No configurado' }}
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-slate-100 bg-white p-16 text-center font-bold text-slate-400 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500">
      Cargando configuración de tiempos académicos...
    </div>

    <template v-else>
      <!-- Alerta Informativa: Año Lectivo Seleccionado Cerrado (Modo Solo Lectura) -->
      <div v-if="isYearClosed" class="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-3xl flex items-start gap-3.5 text-xs text-amber-900 dark:text-amber-300 shadow-sm mb-2">
        <Lock class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div class="space-y-1">
          <p class="font-bold text-amber-950 dark:text-amber-200 text-sm">🔒 Año Lectivo {{ selectedYearObj?.calendario || '' }} (Modo Solo Lectura)</p>
          <p>
            El año lectivo seleccionado se encuentra <strong>CERRADO</strong>. Los periodos académicos de este ciclo escolar permanecen bloqueados y no pueden ser modificados, creados ni eliminados. Para realizar ajustes, debes reabrir el año lectivo desde el Modo Editor.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <div class="border-b border-slate-100 p-6 dark:border-slate-800 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <div class="rounded-2xl bg-sky-50 p-3 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400 shrink-0">
                <BookMarked class="h-6 w-6" />
              </div>
              <div class="min-w-0">
                <h2 class="text-lg font-black text-slate-900 dark:text-white">Años lectivos del colegio</h2>
                <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Registra los años lectivos configurados. El más reciente queda como referencia activa.</p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                @click="yearModal = true"
                class="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black transition-all shadow-md shrink-0 uppercase tracking-wider dark:bg-sky-500 dark:hover:bg-sky-400"
              >
                <Plus class="h-4 w-4" />
                Agregar año
              </button>
              <button
                type="button"
                @click="editorModeActive ? editorModeActive = false : showEditorWarningModal = true"
                :class="[
                  editorModeActive 
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200/50' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  'inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all shadow-md dark:shadow-none shrink-0 uppercase tracking-wider'
                ]"
              >
                <ShieldAlert class="h-4 w-4" />
                {{ editorModeActive ? 'Salir Editor' : 'Modo Editor' }}
              </button>
            </div>
          </div>

          <div v-if="academicYears.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400 dark:text-slate-600">
            No hay años lectivos configurados.
          </div>

          <div v-else class="divide-y divide-slate-100 overflow-y-auto max-h-[400px] dark:divide-slate-800">
            <div 
              v-for="year in academicYears" 
              :key="year.id_anio"
              @click="selectedYearId = year.id_anio"
              :class="[
                selectedYearId === year.id_anio ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-l-4 border-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-transparent',
                'flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between transition-all cursor-pointer'
              ]"
            >
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <p class="text-base font-black text-slate-900 dark:text-white">{{ year.calendario || 'Sin definir' }}</p>
                  <span 
                    :class="[
                      year.estado === 'CERRADO' 
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' 
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
                      'px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider'
                    ]"
                  >
                    {{ year.estado === 'CERRADO' ? 'Cerrado' : 'Abierto' }}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-1.5" @click.stop>
                  <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Calendario:</span>
                  <select 
                    :value="year.tipo_calendario || 'A'" 
                    @change="changeYearCalendarType(year, ($event.target as HTMLSelectElement).value)"
                    :disabled="!editorModeActive || changingCalendarYearId === year.id_anio || year.estado === 'CERRADO'"
                    :title="year.estado === 'CERRADO' ? 'Año lectivo cerrado (Solo lectura)' : (!editorModeActive ? 'Debes activar el Modo Editor para cambiar el tipo de calendario' : '')"
                    :class="[
                      !editorModeActive || year.estado === 'CERRADO' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer focus:ring-2 focus:ring-sky-500',
                      'text-xs font-black bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 outline-none text-slate-700 dark:text-slate-200 transition-all'
                    ]"
                  >
                    <option value="A">Calendario A</option>
                    <option value="B">Calendario B</option>
                  </select>
                </div>
                <p class="text-xs font-bold text-slate-500 mt-2 dark:text-slate-400 flex items-center gap-1.5">
                  <span class="text-slate-400 dark:text-slate-500 font-semibold">📅 Vigencia:</span>
                  <span class="font-extrabold text-slate-700 dark:text-slate-200">{{ formatYearDates(year) }}</span>
                </p>
              </div>

              <div class="flex items-center gap-3 shrink-0" @click.stop>
                <template v-if="editorModeActive">
                  <button
                    type="button"
                    @click="toggleYearStatus(year)"
                    :disabled="togglingYearId === year.id_anio"
                    title="Alternar estado abierto/cerrado del año"
                    class="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                  >
                    <component :is="year.estado === 'CERRADO' ? Play : Lock" class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    @click="deleteYear(year)"
                    :disabled="deletingYearId === year.id_anio || year.estado === 'CERRADO'"
                    :title="year.estado === 'CERRADO' ? 'Un año lectivo CERRADO no se puede eliminar' : 'Eliminar año lectivo permanentemente'"
                    :class="[year.estado === 'CERRADO' ? 'opacity-40 cursor-not-allowed' : 'hover:bg-rose-100', 'p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 transition']"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </template>
                <template v-else>
                  <span :class="[currentYear?.id_anio === year.id_anio ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', 'rounded-full px-3 py-1 text-sm font-black']">
                    {{ currentYear?.id_anio === year.id_anio ? 'Activo en el módulo' : 'Configurado' }}
                  </span>
                </template>
              </div>
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <div class="border-b border-slate-100 p-6 dark:border-slate-800">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex items-center gap-3">
                <div class="rounded-2xl bg-orange-50 p-3 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                  <BookMarked class="h-6 w-6" />
                </div>
                <div>
                  <h2 class="text-lg font-black text-slate-900 dark:text-white">Periodos académicos</h2>
                  <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">Total: <span class="text-orange-600 dark:text-orange-400 font-black">{{ totalPeriodPercentage.toFixed(2) }}%</span></p>
                </div>
              </div>
              <button
                type="button"
                @click="periodModal = true"
                :disabled="isYearClosed"
                :class="[isYearClosed ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60' : 'bg-orange-500 hover:bg-orange-400 dark:bg-orange-600 dark:hover:bg-orange-500']"
                class="inline-flex shrink-0 min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-sm transition-all uppercase tracking-wider"
              >
                <Lock v-if="isYearClosed" class="h-4 w-4" />
                <Plus v-else class="h-4 w-4" />
                {{ isYearClosed ? 'Año Cerrado (Solo Lectura)' : 'Crear periodo' }}
              </button>
            </div>
          </div>

          <div v-if="filteredPeriods.length === 0" class="p-12 text-center text-sm font-semibold text-slate-400 dark:text-slate-600">
            No hay periodos académicos configurados para este año.
          </div>

          <div v-else class="divide-y divide-slate-100 overflow-y-auto max-h-[500px] dark:divide-slate-800">
            <div v-for="period in filteredPeriods" :key="period.id_periodo" class="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <p class="text-base font-black text-slate-900 dark:text-white">{{ period.nombre }}</p>
                <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Estado: 
                  <span 
                    :class="[
                      period.estado === 'ABIERTO' ? 'text-emerald-600 dark:text-emerald-400 font-black' :
                      period.estado === 'PENDIENTE' ? 'text-amber-600 dark:text-amber-500 font-black' :
                      'text-slate-400'
                    ]"
                  >
                    {{ period.estado }}
                  </span> 
                  · Año: {{ selectedYearObj ? selectedYearObj.calendario : period.id_anio }}
                </p>
                <p class="mt-1 text-xs font-semibold text-slate-400 italic dark:text-slate-500">
                  <span v-if="period.mes_inicio !== null">
                    📅 Desde {{ months[period.mes_inicio - 1].name }} {{ period.dia_inicio }} hasta {{ months[period.mes_fin! - 1].name }} {{ period.dia_fin }}
                  </span>
                  <span v-else class="text-slate-300 dark:text-slate-700">Rango de fechas no definido</span>
                </p>
              </div>
              <div class="flex items-center gap-3">
                <span class="rounded-full bg-orange-50 px-3 py-1 text-sm font-black text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">{{ Number(period.porcentaje).toFixed(2) }}%</span>
                
                <button
                  v-if="period.estado === 'PENDIENTE'"
                  type="button"
                  @click="approvePeriod(period)"
                  :disabled="isYearClosed"
                  :class="[isYearClosed ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40']"
                  class="inline-flex items-center justify-center gap-1.5 rounded-2xl px-3.5 py-3 text-xs font-black transition-all"
                  title="Aprobar y activar periodo"
                >
                  <Check class="h-4 w-4" />
                  Aprobar
                </button>

                <button
                  v-if="period.estado === 'ABIERTO'"
                  type="button"
                  @click="closePeriod(period)"
                  :disabled="closingPeriodId === period.id_periodo || isYearClosed"
                  :class="[isYearClosed ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40']"
                  class="inline-flex items-center justify-center gap-1.5 rounded-2xl px-3.5 py-3 text-xs font-black transition-all disabled:opacity-50"
                  title="Cerrar periodo"
                >
                  <Lock class="h-4 w-4" />
                  Cerrar
                </button>

                <button
                  v-if="period.estado === 'CERRADO'"
                  type="button"
                  @click="reopenPeriod(period)"
                  :disabled="reopeningPeriodId === period.id_periodo || isYearClosed"
                  :class="[isYearClosed ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:hover:bg-sky-950/40']"
                  class="inline-flex items-center justify-center gap-1.5 rounded-2xl px-3.5 py-3 text-xs font-black transition-all disabled:opacity-50"
                  title="Reabrir periodo"
                >
                  <Play class="h-4 w-4" />
                  Reabrir
                </button>

                <button
                  type="button"
                  @click="periodEditModal = period; periodEdit.porcentaje = String(period.porcentaje); periodEdit.mes_inicio = String(period.mes_inicio); periodEdit.dia_inicio = String(period.dia_inicio); periodEdit.mes_fin = String(period.mes_fin); periodEdit.dia_fin = String(period.dia_fin)"
                  :disabled="isYearClosed"
                  :class="[isYearClosed ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-white']"
                  class="inline-flex items-center justify-center rounded-2xl bg-slate-100 p-3 text-slate-600 transition-all dark:bg-slate-800 dark:text-slate-400"
                  title="Editar periodo"
                >
                  <PenSquare class="h-4 w-4" />
                </button>

                <button
                  type="button"
                  @click="deletePeriod(period)"
                  :disabled="isYearClosed"
                  :class="[isYearClosed ? 'opacity-40 cursor-not-allowed' : 'hover:bg-rose-100 dark:hover:bg-rose-950/40']"
                  class="inline-flex items-center justify-center rounded-2xl bg-rose-50 p-3 text-rose-600 transition-all dark:bg-rose-950/20 dark:text-rose-400"
                  title="Eliminar periodo académico"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Referencia de Calendarios Escolares (A y B) -->
      <section class="overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div class="flex items-center gap-3 mb-6">
          <div class="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
            <Info class="h-6 w-6" />
          </div>
          <div>
            <h2 class="text-lg font-black text-slate-900 dark:text-white">Guía de Calendarios Académicos</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Referencia oficial para configurar los rangos de fechas de periodos según el tipo de calendario en Colombia.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Calendario A -->
          <div class="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/70 p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="text-2xl">📚</span>
                <h3 class="text-base font-black text-slate-900 dark:text-white">Calendario A</h3>
              </div>
              <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                Inicia generalmente entre <strong>enero y febrero</strong> y finaliza entre <strong>noviembre y diciembre</strong>. Es el esquema estándar de la mayoría de colegios en Colombia. Se divide comúnmente en 4 periodos académicos.
              </p>
              
              <div class="space-y-2.5">
                <h4 class="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Distribución sugerida de periodos:</h4>
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <span class="font-black block text-slate-800 dark:text-white">Periodo 1</span>
                    <span class="text-slate-500 dark:text-slate-400">Ene/Feb → Marzo</span>
                  </div>
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <span class="font-black block text-slate-800 dark:text-white">Periodo 2</span>
                    <span class="text-slate-500 dark:text-slate-400">Abril → Junio</span>
                  </div>
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <span class="font-black block text-slate-800 dark:text-white">Periodo 3</span>
                    <span class="text-slate-500 dark:text-slate-400">Julio → Sept</span>
                  </div>
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <span class="font-black block text-slate-800 dark:text-white">Periodo 4</span>
                    <span class="text-slate-500 dark:text-slate-400">Sept → Nov</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-4 text-[11px] text-slate-400 font-medium">
              * Nota: Incluye receso de mitad de año entre junio y julio.
            </div>
          </div>

          <!-- Calendario B -->
          <div class="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/70 p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <span class="text-2xl">🌎</span>
                <h3 class="text-base font-black text-slate-900 dark:text-white">Calendario B</h3>
              </div>
              <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                Inicia generalmente entre <strong>agosto y septiembre</strong> y termina en <strong>junio o julio del año siguiente</strong>. Común en colegios internacionales, bilingües y alineados con el hemisferio norte.
              </p>
              
              <div class="space-y-2.5">
                <h4 class="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Distribución sugerida de periodos:</h4>
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 col-span-2">
                    <span class="font-black block text-slate-800 dark:text-white">Primer Semestre (Periodo 1 & 2)</span>
                    <span class="text-slate-500 dark:text-slate-400">Agosto → Diciembre (Cierre antes de Navidad)</span>
                  </div>
                  <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 col-span-2">
                    <span class="font-black block text-slate-800 dark:text-white">Segundo Semestre (Periodo 3 & 4)</span>
                    <span class="text-slate-500 dark:text-slate-400">Enero → Junio/Julio (Cierre de año escolar)</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-4 text-[11px] text-slate-400 font-medium">
              * Nota: Incluye vacaciones de fin de año entre diciembre y enero.
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Modal Create Academic Year -->
    <div v-if="yearModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all">
      <div class="w-full max-w-xl rounded-[32px] bg-white shadow-2xl overflow-hidden dark:bg-slate-900 border dark:border-slate-800">
        <div class="border-b border-slate-100 px-8 py-7 dark:border-slate-800">
          <h2 class="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Agregar Año Lectivo</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
            Ingresa el año lectivo en formato numérico (ej. 2026). Si seleccionas Calendario B, el sistema configurará automáticamente la etiqueta de rango de años (ej. 2025-2026).
          </p>
        </div>
        <div class="px-8 py-8 space-y-6">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Año Lectivo (Número)</span>
              <input 
                v-model="academicYearForm.year_number" 
                type="number" 
                min="2000" 
                max="2100" 
                placeholder="Ej. 2026" 
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-black outline-none text-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500/20" 
              />
            </label>
            
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Tipo de Calendario</span>
              <select 
                v-model="academicYearForm.tipo_calendario" 
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-extrabold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="A">Calendario A</option>
                <option value="B">Calendario B</option>
              </select>
            </label>
          </div>

          <div class="rounded-2xl bg-sky-50/80 p-4 border border-sky-100 flex items-center justify-between dark:bg-sky-950/20 dark:border-sky-900/30">
            <span class="text-xs font-black text-sky-800 dark:text-sky-300 uppercase tracking-wider">Etiqueta Resultante:</span>
            <span class="px-3.5 py-1.5 rounded-xl bg-sky-600 text-white font-black text-sm shadow-sm dark:bg-sky-500">
              {{ computedCalendarioLabel }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Fecha de Inicio</span>
              <input 
                v-model="academicYearForm.fecha_inicio" 
                type="date" 
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500/20" 
              />
            </label>

            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Fecha de Fin</span>
              <input 
                v-model="academicYearForm.fecha_fin" 
                type="date" 
                class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500/20" 
              />
            </label>
          </div>

          <div v-if="dateOverlapWarning" class="rounded-2xl bg-rose-50 p-4 border border-rose-200 flex items-start gap-3 dark:bg-rose-950/30 dark:border-rose-900/40">
            <ShieldAlert class="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div class="text-xs font-bold text-rose-800 dark:text-rose-300">
              <span class="block font-black text-rose-900 dark:text-rose-200 uppercase tracking-wider mb-0.5">⚠️ Solapamiento de Fechas Detectado</span>
              {{ dateOverlapWarning }}
            </div>
          </div>

          <div class="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <button type="button" @click="yearModal = false" class="rounded-2xl border border-slate-200 px-8 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 uppercase tracking-widest">
              Cancelar
            </button>
            <button type="button" @click="createAcademicYear" :disabled="yearSaving || !!dateOverlapWarning" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-sky-600 px-10 py-4 text-sm font-black text-white shadow-lg shadow-sky-200/50 dark:shadow-none hover:bg-sky-500 transition-all disabled:opacity-50 uppercase tracking-widest dark:bg-sky-500 dark:hover:bg-sky-400">
              <Plus class="h-4 w-4" />
              {{ yearSaving ? 'Creando...' : 'Crear año lectivo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Create Period -->
    <div v-if="periodModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all">
      <div class="w-full max-w-2xl rounded-[32px] bg-white shadow-2xl overflow-hidden dark:bg-slate-900 border dark:border-slate-800">
        <div class="border-b border-slate-100 px-8 py-7 dark:border-slate-800">
          <h2 class="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Crear periodo académico</h2>
          <p class="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">El porcentaje agregado no puede romper el total global del año.</p>
        </div>
        <div class="px-8 py-8">
          <div v-if="availablePresets.length > 0" class="mb-6 rounded-2xl bg-orange-50/70 p-4 border border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30">
            <label class="space-y-1.5 block">
              <span class="block text-xs font-black text-orange-800 dark:text-orange-300 uppercase tracking-wider">⚡ Cargar periodo predefinido</span>
              <select 
                @change="onPresetSelected(($event.target as HTMLSelectElement).value)"
                class="w-full rounded-xl border border-orange-200 bg-white p-3 text-sm font-black text-slate-800 outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">-- Seleccionar periodo disponible --</option>
                <option v-for="preset in availablePresets" :key="preset.trimestre" :value="preset.nombre">
                  {{ preset.nombre }} ({{ selectedYearObj?.tipo_calendario === 'B' ? 'Calendario B' : 'Calendario A' }})
                </option>
              </select>
            </label>
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nombre del periodo</span>
              <input v-model="newPeriod.nombre" type="text" placeholder="Ej. Primer Periodo" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Porcentaje (%)</span>
              <input v-model="newPeriod.porcentaje" type="number" min="0" step="0.01" placeholder="Ej. 25" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
            </label>
          </div>

          <div class="mt-8 space-y-6 rounded-3xl border border-orange-100 bg-orange-50/50 p-7 dark:bg-orange-950/10 dark:border-orange-900/40">
            <h3 class="text-sm font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest">Vigencia del periodo</h3>
            
            <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div class="space-y-4">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest h-4">Inicio del periodo</p>
                <div class="flex gap-3">
                  <select v-model="newPeriod.mes_inicio" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="newPeriod.dia_inicio" type="number" min="1" max="31" placeholder="Día" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>

              <div class="space-y-4">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest h-4">Fin del periodo</p>
                <div class="flex gap-3">
                  <select v-model="newPeriod.mes_fin" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="newPeriod.dia_fin" type="number" min="1" max="31" placeholder="Día" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>
            </div>
          </div>

          <div class="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <button type="button" @click="periodModal = false" class="rounded-2xl border border-slate-200 px-8 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 uppercase tracking-widest">Cancelar</button>
            <button type="button" @click="createPeriod" :disabled="savingPeriod" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-orange-500 px-10 py-4 text-sm font-black text-white shadow-lg shadow-orange-200/50 dark:shadow-none hover:bg-orange-600 transition-all disabled:opacity-50 uppercase tracking-widest">
              <Plus class="h-4 w-4" />
              {{ savingPeriod ? 'Creando...' : 'Crear periodo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Edit Period -->
    <div v-if="periodEditModal" class="fixed inset-0 z-[100] flex min-h-screen w-screen items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all">
      <div class="w-full max-w-2xl rounded-[32px] bg-white shadow-2xl overflow-hidden dark:bg-slate-900 border dark:border-slate-800">
        <div class="border-b border-slate-100 px-8 py-7 dark:border-slate-800">
          <h2 class="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Actualizar periodo</h2>
          <p class="mt-2 text-sm font-black text-orange-600 dark:text-orange-400">{{ periodEditModal.nombre }}</p>
        </div>
        <div class="px-8 py-8">
          <label class="space-y-2">
            <span class="block text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Porcentaje (%)</span>
            <input v-model="periodEdit.porcentaje" type="number" min="0" step="0.01" class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
          </label>

          <div class="mt-8 space-y-6 rounded-3xl border border-orange-100 bg-orange-50/50 p-7 dark:bg-orange-950/10 dark:border-orange-900/40">
            <h3 class="text-sm font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest">Actualizar vigencia</h3>
            
            <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div class="space-y-4">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest h-4">Inicio</p>
                <div class="flex gap-3">
                  <select v-model="periodEdit.mes_inicio" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="periodEdit.dia_inicio" type="number" min="1" max="31" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>

              <div class="space-y-4">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest h-4">Fin</p>
                <div class="flex gap-3">
                  <select v-model="periodEdit.mes_fin" class="flex-1 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20">
                    <option value="">Mes</option>
                    <option v-for="m in months" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <input v-model="periodEdit.dia_fin" type="number" min="1" max="31" class="w-24 rounded-2xl border border-slate-200 bg-white p-4 font-semibold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>
            </div>
          </div>

          <div class="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-end">
            <button type="button" @click="periodEditModal = null" class="rounded-2xl border border-slate-200 px-8 py-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 uppercase tracking-widest">Cancelar</button>
            <button type="button" @click="updatePeriodPercentage" :disabled="savingPeriod" class="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-orange-600 px-10 py-4 text-sm font-black text-white shadow-lg shadow-orange-200/50 dark:shadow-none hover:bg-orange-700 transition-all disabled:opacity-50 uppercase tracking-widest">
              <PenSquare class="h-4 w-4" />
              {{ savingPeriod ? 'Guardando...' : 'Actualizar periodo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Success Year Creation -->
    <div v-if="showYearSuccessAlert" class="fixed inset-0 z-[120] flex min-h-screen w-screen items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all">
      <div class="w-full max-w-lg rounded-[32px] bg-white shadow-2xl overflow-hidden dark:bg-slate-900 border dark:border-slate-800 p-8">
        <div class="text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 mb-4">
            <BookMarked class="h-6 w-6" />
          </div>
          <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">¡Año Lectivo Creado!</h2>
          <p class="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">{{ yearSuccessMessage }}</p>
        </div>

        <div class="mt-6 space-y-3 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
          <p class="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Periodos autogenerados:</p>
          <div v-for="p in yearSuccessPeriods" :key="p.id_periodo" class="flex items-center justify-between text-xs py-1.5 border-b border-dashed border-slate-200 dark:border-slate-700 last:border-b-0">
            <span class="font-bold text-slate-800 dark:text-slate-200">{{ p.nombre }}</span>
            <span class="text-slate-500 dark:text-slate-400">
              📅 {{ months[p.mes_inicio - 1].name }} {{ p.dia_inicio }} - {{ months[p.mes_fin - 1].name }} {{ p.dia_fin }}
            </span>
          </div>
        </div>

        <div class="mt-8 flex justify-center">
          <button type="button" @click="showYearSuccessAlert = false" class="w-full rounded-2xl bg-sky-600 py-4 text-sm font-black text-white hover:bg-sky-500 transition-all dark:bg-sky-500 dark:hover:bg-sky-400 uppercase tracking-widest">
            Entendido
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Warning Editor Mode -->
    <div v-if="showEditorWarningModal" class="fixed inset-0 z-[120] flex min-h-screen w-screen items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-all">
      <div class="w-full max-w-lg rounded-[32px] bg-white shadow-2xl overflow-hidden dark:bg-slate-900 border dark:border-slate-800 p-8">
        <div class="text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 mb-4">
            <ShieldAlert class="h-6 w-6" />
          </div>
          <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">¡Atención - Zona de Riesgo!</h2>
          <p class="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
            El modo editor es una herramienta delicada. Le permitirá <strong>eliminar, abrir o cerrar</strong> años lectivos completos.
          </p>
          <div class="mt-4 p-4 rounded-2xl bg-rose-50/50 border border-rose-100 text-left text-xs font-semibold text-rose-700 dark:bg-rose-950/10 dark:border-rose-900/30 dark:text-rose-400 leading-relaxed">
            ⚠️ <strong>Riesgos asociados:</strong>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li>Cerrar un año evitará que se realicen modificaciones académicas.</li>
              <li>Eliminar un año borrará todos los periodos y estructuras asociadas de forma irreversible.</li>
              <li>Si hay matrículas o notas activas, el borrado será bloqueado para proteger la consistencia de datos.</li>
            </ul>
          </div>
          <p class="mt-4 text-xs font-bold text-slate-400 dark:text-slate-500">
            ¿Desea ingresar bajo su propia responsabilidad?
          </p>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <button 
            type="button" 
            @click="showEditorWarningModal = false" 
            class="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 uppercase tracking-widest"
          >
            Cancelar
          </button>
          <button 
            type="button" 
            @click="editorModeActive = true; showEditorWarningModal = false" 
            class="flex-1 rounded-2xl bg-rose-600 py-3.5 text-xs font-black text-white hover:bg-rose-500 transition-all dark:bg-rose-500 dark:hover:bg-rose-400 uppercase tracking-widest shadow-lg shadow-rose-200/50 dark:shadow-none"
          >
            Entendido, activar
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
