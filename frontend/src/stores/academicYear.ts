import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { academicService } from '../services/academicService'

export interface AcademicYear {
  id_anio: number
  id_año?: number
  calendario: string
  estado?: string
}

export const useAcademicYearStore = defineStore('academicYear', () => {
  const savedId = localStorage.getItem('selectedAcademicYearId')
  const initialNum = savedId ? Number(savedId) : null
  const selectedYearId = ref<number | null>(initialNum && !isNaN(initialNum) ? initialNum : null)
  const availableYears = ref<AcademicYear[]>([])
  const loading = ref(false)

  const selectedYear = computed(() => {
    if (!selectedYearId.value) return null
    return availableYears.value.find(y => Number(y.id_anio || y.id_año) === Number(selectedYearId.value)) || null
  })

  const isClosedYear = computed(() => {
    if (!selectedYear.value) return false
    const estado = String(selectedYear.value.estado || '').toUpperCase()
    return estado === 'CERRADO' || estado === 'INACTIVO'
  })
  const isReadonlyYear = computed(() => isClosedYear.value)

  const loadYearsForSchool = async (schoolId: number, _token?: string) => {
    if (!schoolId) return
    loading.value = true
    try {
      const res = await academicService.getSettings(schoolId, { keys: 'years' })
      const years: AcademicYear[] = (res.academicYears || []).map((y: any) => ({
        ...y,
        id_anio: Number(y.id_anio ?? y.id_año)
      }))
      availableYears.value = years

      // Check if previously saved ID exists in loaded years
      const currentSaved = selectedYearId.value
      const exists = years.some(y => Number(y.id_anio) === Number(currentSaved))

      if (currentSaved && exists) {
        // Keep user selection
      } else {
        const activeYearId = res.activeYear ? Number(res.activeYear.id_anio ?? res.activeYear.id_año) : null
        const activeExists = activeYearId ? years.some(y => Number(y.id_anio) === activeYearId) : false

        if (activeYearId && activeExists) {
          setSelectedYearId(activeYearId)
        } else if (years.length > 0) {
          setSelectedYearId(Number(years[0].id_anio))
        }
      }
    } catch (err) {
      console.error('Error loading academic years in store:', err)
    } finally {
      loading.value = false
    }
  }

  const setSelectedYearId = (id: number | string) => {
    const num = Number(id)
    if (!isNaN(num) && num > 0) {
      selectedYearId.value = num
      localStorage.setItem('selectedAcademicYearId', String(num))
    }
  }

  const addOrUpdateYear = (year: AcademicYear) => {
    const norm = { ...year, id_anio: Number(year.id_anio ?? (year as any).id_año) }
    const idx = availableYears.value.findIndex(y => Number(y.id_anio) === norm.id_anio)
    if (idx >= 0) {
      availableYears.value[idx] = norm
    } else {
      availableYears.value.unshift(norm)
    }
    setSelectedYearId(norm.id_anio)
  }

  return {
    selectedYearId,
    availableYears,
    selectedYear,
    isClosedYear,
    isReadonlyYear,
    loading,
    loadYearsForSchool,
    setSelectedYearId,
    addOrUpdateYear
  }
})
