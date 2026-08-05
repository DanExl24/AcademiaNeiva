import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export interface AcademicYear {
  id_anio: number
  id_año?: number
  calendario: string
  estado?: string
}

export const useAcademicYearStore = defineStore('academicYear', () => {
  const savedId = localStorage.getItem('selectedAcademicYearId')
  const selectedYearId = ref<number | null>(savedId ? Number(savedId) : null)
  const availableYears = ref<AcademicYear[]>([])
  const loading = ref(false)

  const selectedYear = computed(() => {
    if (!selectedYearId.value) return null
    return availableYears.value.find(y => (y.id_anio || y.id_año) === selectedYearId.value) || null
  })

  const isClosedYear = computed(() => selectedYear.value ? (selectedYear.value.estado === 'CERRADO' || selectedYear.value.estado === 'INACTIVO') : false)
  const isReadonlyYear = computed(() => isClosedYear.value)

  const loadYearsForSchool = async (schoolId: number, token?: string) => {
    if (!schoolId) return
    loading.value = true
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await axios.get(`/api/academic-admin/settings/${schoolId}?keys=years`, { headers })
      const years: AcademicYear[] = (res.data.academicYears || []).map((y: any) => ({
        ...y,
        id_anio: y.id_anio ?? y.id_año
      }))
      availableYears.value = years

      // Check if previously saved ID exists in loaded years
      const currentSaved = selectedYearId.value
      const exists = years.some(y => y.id_anio === currentSaved)

      if (currentSaved && exists) {
        // Keep user selection
      } else if (res.data.activeYear) {
        const activeId = res.data.activeYear.id_anio ?? res.data.activeYear.id_año
        setSelectedYearId(activeId)
      } else if (years.length > 0) {
        setSelectedYearId(years[0].id_anio)
      }
    } catch (err) {
      console.error('Error loading academic years in store:', err)
    } finally {
      loading.value = false
    }
  }

  const setSelectedYearId = (id: number) => {
    selectedYearId.value = id
    localStorage.setItem('selectedAcademicYearId', String(id))
  }

  return {
    selectedYearId,
    availableYears,
    selectedYear,
    isClosedYear,
    isReadonlyYear,
    loading,
    loadYearsForSchool,
    setSelectedYearId
  }
})
