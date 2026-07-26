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
  const selectedYearId = ref<number | null>(null)
  const availableYears = ref<AcademicYear[]>([])
  const loading = ref(false)

  const selectedYear = computed(() => {
    if (!selectedYearId.value) return null
    return availableYears.value.find(y => (y.id_anio || y.id_año) === selectedYearId.value) || null
  })

  const loadYearsForSchool = async (schoolId: number, token?: string) => {
    if (!schoolId) return
    loading.value = true
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId}`, { headers })
      const years: AcademicYear[] = (res.data.academicYears || []).map((y: any) => ({
        ...y,
        id_anio: y.id_anio ?? y.id_año
      }))
      availableYears.value = years

      // If no year selected yet, set to active year or newest year
      if (!selectedYearId.value) {
        if (res.data.activeYear) {
          selectedYearId.value = res.data.activeYear.id_anio ?? res.data.activeYear.id_año
        } else if (years.length > 0) {
          selectedYearId.value = years[0].id_anio
        }
      } else {
        // Verify current selectedYearId exists in loaded years
        const exists = years.some(y => y.id_anio === selectedYearId.value)
        if (!exists && years.length > 0) {
          selectedYearId.value = years[0].id_anio
        }
      }
    } catch (err) {
      console.error('Error loading academic years in store:', err)
    } finally {
      loading.value = false
    }
  }

  const setSelectedYearId = (id: number) => {
    selectedYearId.value = id
  }

  return {
    selectedYearId,
    availableYears,
    selectedYear,
    loading,
    loadYearsForSchool,
    setSelectedYearId
  }
})
