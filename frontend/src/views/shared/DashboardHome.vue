<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { academicService } from '../../services/academicService'
import { enrollmentService } from '../../services/enrollmentService'
import { getCourseDisplayName } from '../../utils/courseHelper'
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  TrendingUp,
  Target,
  AlertTriangle,
  Filter,
  LayoutDashboard,
  X,
  Search,
  CalendarDays,
  Award,
  ShieldAlert,
  Lightbulb,
  MessageSquare,
  FileWarning
} from 'lucide-vue-next'

import PeriodCountdownBanner from '../../components/PeriodCountdownBanner.vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'
import EmptyChartState from '../../components/charts/EmptyChartState.vue'
import { useThemeStore } from '../../stores/theme'

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement, 
  PointElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
)

const theme = useThemeStore()
const auth = useAuthStore()

const activeTab = ref<'summary' | 'risk' | 'observations'>('summary')
const loading = ref(true)
const fetchError = ref(false)
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

// Data State
const dashboardData = ref({
  activePeriodInfo: null as any,
  summary: {
    totalStudents: 0,
    totalTeachers: 0,
    attendanceToday: 0,
    generalAverage: 0,
    approvalRate: 0,
    studentsAtRisk: 0,
    disciplinaryReports: 0,
    desertionRate: 0,
  },
  summaryByGrade: {} as Record<string, {
    totalStudents: number;
    totalTeachers: number;
    attendanceToday: number;
    generalAverage: number;
    approvalRate: number;
    studentsAtRisk: number;
    disciplinaryReports: number;
    desertionRate: number;
  }>,
  observationsSummary: {
    total: 0,
    academicas: 0,
    disciplinarias: 0,
    convivenciales: 0,
    sancionesActivas: 0,
    byGrade: [] as { grado: string; total: number; academicas: number; disciplinarias: number; convivenciales: number }[]
  },
  charts: {
    performanceByGrade: [] as {nombre: string, average: number}[],
    performanceBySubject: [] as {nombre: string, average: number}[],
    performanceByCourse: [] as {
      id_grupo: number;
      grado_nombre: string;
      seccion_nombre: string;
      jornada_nombre: string;
      average: number;
    }[],
    performanceBySubjectCourse: [] as {
      id_grupo: number;
      subject_nombre: string;
      grado_nombre: string;
      seccion_nombre: string;
      jornada_nombre: string;
      average: number;
    }[],
    evolution: [] as {nombre: string, average: number}[],
    evolutionByCourse: [] as {
      periodo_nombre: string;
      id_grupo: number;
      grado_nombre: string;
      seccion_nombre: string;
      jornada_nombre: string;
      average: number;
    }[]
  },
  lowPerformance: {
    criticalSubjects: [] as { 
      nombre: string; 
      failures: number; 
      estudiantes_reprobados: {
        id_estudiante: number;
        nombre_completo: string;
        promedio: number;
        curso: string;
      }[];
    }[],
    gradeAlerts: [] as { nombre: string; alerts: number }[],
    groupRisk: [] as { 
      curso: string; 
      id_grupo: number;
      grado_nombre: string;
      seccion_nombre: string;
      jornada_nombre: string;
      at_risk: number; 
      safe: number; 
    }[],
    studentsAtRiskList: [] as {
      id_estudiante: number;
      nombre_completo: string;
      id_grupo: number;
      grado_nombre?: string;
      curso?: string;
      materias_reprobadas: number;
      promedio_general: number;
      detalles_materias: { materia_nombre: string; promedio: number }[];
    }[]
  }
})

const yearStore = useAcademicYearStore()
const allPeriods = ref<any[]>([])
const academicYears = computed(() => yearStore.availableYears)
const selectedYearId = computed({
  get: () => yearStore.selectedYearId,
  set: (val: number | null) => {
    if (val) yearStore.setSelectedYearId(val)
  }
})
const selectedPeriodId = ref<number | null>(null)

// Only show periods for the selected year and hide PENDIENTE ones
const periods = computed(() => {
  let list = allPeriods.value
  if (selectedYearId.value) {
    list = list.filter((p: any) => (p.id_anio ?? p.id_año) === selectedYearId.value)
  }
  return list.filter((p: any) => p.estado !== 'PENDIENTE')
})

const activeSummary = computed(() => {
  if (globalSelectedGrade.value === 'ALL') {
    return dashboardData.value.summary
  }
  return dashboardData.value.summaryByGrade?.[globalSelectedGrade.value] || {
    totalStudents: 0,
    totalTeachers: 0,
    attendanceToday: 0,
    generalAverage: 0,
    approvalRate: 0,
    studentsAtRisk: 0,
    disciplinaryReports: 0,
    desertionRate: 0
  }
})

const maxGrade = ref<string>('5.0')

// Computed Stats for 5 Cards
const dashboardStats = computed(() => [
  { name: 'Estudiantes', value: activeSummary.value.totalStudents.toString(), icon: GraduationCap, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  { name: 'Docentes', value: activeSummary.value.totalTeachers.toString(), icon: Users, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  { name: 'Promedio Institucional', value: `${activeSummary.value.generalAverage || '0.0'}`, subValue: `/ ${maxGrade.value || '5.0'}`, icon: TrendingUp, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/40' },
  { name: 'Tasa de Aprobación', value: `${activeSummary.value.approvalRate ?? 100}%`, icon: Award, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  { name: 'Riesgo Académico', value: activeSummary.value.studentsAtRisk.toString(), icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
])

// Chart Configs
const chartOptionsBase = computed(() => {
  const isDark = theme.isDark
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        grid: { color: isDark ? '#334155' : '#f1f5f9' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      },
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      }
    }
  }
})

const horizontalOptions = computed(() => {
  const isDark = theme.isDark
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: chartOptionsBase.value.plugins,
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: isDark ? '#334155' : '#f1f5f9' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      },
      y: {
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      }
    }
  }
})

const globalSelectedGrade = ref<string>('ALL')
const schoolGradesCatalog = ref<string[]>([])

const globalGradeOptions = computed(() => {
  const gradesRisk = dashboardData.value.lowPerformance.groupRisk.map(r => r.grado_nombre)
  const gradesPerf = dashboardData.value.charts.performanceByCourse.map(c => c.grado_nombre)
  const catalogGrades = schoolGradesCatalog.value
  return [...new Set([...gradesRisk, ...gradesPerf, ...catalogGrades])].filter(Boolean).sort()
})

watch(globalGradeOptions, (newOptions) => {
  if (globalSelectedGrade.value !== 'ALL' && !newOptions.includes(globalSelectedGrade.value)) {
    globalSelectedGrade.value = 'ALL'
  }
})

const availableCoursesForSelectedGrade = computed(() => {
  if (globalSelectedGrade.value === 'ALL') return []
  return dashboardData.value.charts.performanceByCourse.filter(
    c => c.grado_nombre === globalSelectedGrade.value
  )
})

const selectedAlertCourse = ref<{ id_grupo: number; name: string } | null>(null)
const selectedCriticalSubject = ref<{ nombre: string; estudiantes_reprobados: any[] } | null>(null)
const modalSearchQuery = ref('')
const selectedModalGroup = ref<string>('ALL')

const studentsAtRiskForSelectedAlertCourse = computed(() => {
  if (!selectedAlertCourse.value) return []
  const list = dashboardData.value.lowPerformance.studentsAtRiskList.filter(
    s => s.id_grupo === selectedAlertCourse.value!.id_grupo
  )
  if (!modalSearchQuery.value) return list
  const q = modalSearchQuery.value.toLowerCase().trim()
  return list.filter(s => s.nombre_completo.toLowerCase().includes(q))
})

const availableModalGroups = computed(() => {
  if (!selectedCriticalSubject.value) return []
  const list = selectedCriticalSubject.value.estudiantes_reprobados || []
  const groups = list.map(s => s.curso).filter(Boolean)
  return [...new Set(groups)].sort()
})

const filteredCriticalSubjectStudents = computed(() => {
  if (!selectedCriticalSubject.value) return []
  let list = selectedCriticalSubject.value.estudiantes_reprobados || []
  
  if (selectedModalGroup.value !== 'ALL') {
    list = list.filter(s => s.curso === selectedModalGroup.value)
  }
  
  if (!modalSearchQuery.value) return list
  const q = modalSearchQuery.value.toLowerCase().trim()
  return list.filter(s => s.nombre_completo.toLowerCase().includes(q))
})

watch([selectedAlertCourse, selectedCriticalSubject], () => {
  modalSearchQuery.value = ''
  selectedModalGroup.value = 'ALL'
})

const handleAlertClick = (item: { name: string; alerts: number }) => {
  if (globalSelectedGrade.value === 'ALL') {
    globalSelectedGrade.value = item.name
  } else {
    const course = availableCoursesForSelectedGrade.value.find(
      c => `${getCourseDisplayName(c)} - ${c.jornada_nombre}` === item.name
    )
    if (course) {
      selectedAlertCourse.value = {
        id_grupo: course.id_grupo,
        name: `${getCourseDisplayName(course)} - ${course.jornada_nombre}`
      }
    }
  }
}

const handleCriticalSubjectClick = (sub: any) => {
  selectedCriticalSubject.value = {
    nombre: sub.nombre,
    estudiantes_reprobados: sub.estudiantes_reprobados || []
  }
}

const getInitials = (name: string): string => {
  if (!name) return ''
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

const selectedCourseForSubjects = ref<number | null>(null)
const selectedCourseForEvolution = ref<number | null>(null)

watch(globalSelectedGrade, (newGrade) => {
  if (newGrade === 'ALL') {
    selectedCourseForSubjects.value = null
    selectedCourseForEvolution.value = null
  } else {
    const courses = dashboardData.value.charts.performanceByCourse.filter(
      c => c.grado_nombre === newGrade
    )
    if (courses.length > 0) {
      selectedCourseForSubjects.value = courses[0].id_grupo
      selectedCourseForEvolution.value = courses[0].id_grupo
    } else {
      selectedCourseForSubjects.value = null
      selectedCourseForEvolution.value = null
    }
  }
})

const riskChartData = computed(() => {
  const allRisk = dashboardData.value.lowPerformance.groupRisk
  
  if (globalSelectedGrade.value === 'ALL') {
    const grouped = allRisk.reduce((acc, curr) => {
      const existing = acc.find(item => item.grado === curr.grado_nombre)
      if (existing) {
        existing.at_risk += curr.at_risk
        existing.safe += curr.safe
      } else {
        acc.push({
          grado: curr.grado_nombre,
          at_risk: curr.at_risk,
          safe: curr.safe
        })
      }
      return acc
    }, [] as { grado: string, at_risk: number, safe: number }[])

    return {
      labels: grouped.map(g => g.grado),
      datasets: [
        {
          label: 'En Riesgo',
          data: grouped.map(g => g.at_risk),
          backgroundColor: '#f87171',
          borderRadius: 6
        },
        {
          label: 'A Salvo',
          data: grouped.map(g => g.safe),
          backgroundColor: '#34d399',
          borderRadius: 6
        }
      ]
    }
  }

  const filtered = allRisk.filter(r => r.grado_nombre === globalSelectedGrade.value)
  return {
    labels: filtered.map(r => `${getCourseDisplayName({ grado_nombre: r.grado_nombre, seccion_nombre: r.seccion_nombre })} - ${r.jornada_nombre}`),
    datasets: [
      {
        label: 'En Riesgo',
        data: filtered.map(r => r.at_risk),
        backgroundColor: '#f87171',
        borderRadius: 6
      },
      {
        label: 'A Salvo',
        data: filtered.map(r => r.safe),
        backgroundColor: '#34d399',
        borderRadius: 6
      }
    ]
  }
})

const riskChartOptions = computed(() => {
  const isDark = theme.isDark
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      ...chartOptionsBase.value.plugins,
      legend: { display: true, position: 'top' as const, labels: { color: isDark ? '#cbd5e1' : '#475569', font: { weight: 'bold' } } }
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: isDark ? '#334155' : '#f1f5f9' },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      }
    }
  }
})

const gradeChartData = computed(() => {
  const isAll = globalSelectedGrade.value === 'ALL'
  if (isAll) {
    return {
      labels: dashboardData.value.charts.performanceByGrade.map(g => g.nombre),
      datasets: [{
        label: 'Promedio Grado',
        data: dashboardData.value.charts.performanceByGrade.map(g => Number(g.average || 0)),
        backgroundColor: '#6366f1',
        borderRadius: 8
      }]
    }
  } else {
    const filteredCourses = dashboardData.value.charts.performanceByCourse.filter(
      c => c.grado_nombre === globalSelectedGrade.value
    )
    return {
      labels: filteredCourses.map(c => `${getCourseDisplayName(c)} - ${c.jornada_nombre}`),
      datasets: [{
        label: 'Promedio Curso',
        data: filteredCourses.map(c => Number(c.average || 0)),
        backgroundColor: '#6366f1',
        borderRadius: 8
      }]
    }
  }
})

const subjectChartData = computed(() => {
  if (globalSelectedGrade.value === 'ALL') {
    return {
      labels: dashboardData.value.charts.performanceBySubject.map(s => s.nombre),
      datasets: [{
        label: 'Promedio Materia',
        data: dashboardData.value.charts.performanceBySubject.map(s => Number(s.average || 0)),
        backgroundColor: '#10b981',
        borderRadius: 8
      }]
    }
  } else {
    if (!selectedCourseForSubjects.value) {
      return { labels: [], datasets: [] }
    }
    const filtered = dashboardData.value.charts.performanceBySubjectCourse
      .filter(item => item.id_grupo === selectedCourseForSubjects.value)
      .sort((a, b) => Number(b.average || 0) - Number(a.average || 0))
      .slice(0, 15);
      
    return {
      labels: filtered.map(f => f.subject_nombre),
      datasets: [{
        label: 'Promedio Materia',
        data: filtered.map(f => Number(f.average || 0)),
        backgroundColor: '#10b981',
        borderRadius: 8
      }]
    }
  }
})

const evolutionChartData = computed(() => {
  if (globalSelectedGrade.value === 'ALL') {
    return {
      labels: dashboardData.value.charts.evolution.map(e => e.nombre),
      datasets: [{
        label: 'Media Institucional',
        data: dashboardData.value.charts.evolution.map(e => Number(e.average || 0)),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointBackgroundColor: '#f59e0b'
      }]
    }
  } else {
    if (!selectedCourseForEvolution.value) {
      return { labels: [], datasets: [] }
    }
    const filtered = dashboardData.value.charts.evolutionByCourse.filter(
      item => item.id_grupo === selectedCourseForEvolution.value
    )
    return {
      labels: filtered.map(e => e.periodo_nombre),
      datasets: [{
        label: 'Promedio Curso',
        data: filtered.map(e => Number(e.average || 0)),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointBackgroundColor: '#f59e0b'
      }]
    }
  }
})

const hasGradeChartData = computed(() => {
  return (gradeChartData.value?.datasets?.[0]?.data || []).some((v: any) => Number(v) > 0)
})

const hasSubjectChartData = computed(() => {
  return (subjectChartData.value?.datasets?.[0]?.data || []).some((v: any) => Number(v) > 0)
})

const hasEvolutionChartData = computed(() => {
  return (evolutionChartData.value?.datasets?.[0]?.data || []).some((v: any) => Number(v) > 0)
})

const hasRiskChartData = computed(() => {
  const datasets = riskChartData.value?.datasets || []
  return datasets.some((d: any) => (d.data || []).some((v: any) => Number(v) > 0))
})

const filteredAlertsData = computed(() => {
  if (globalSelectedGrade.value === 'ALL') {
    return dashboardData.value.lowPerformance.gradeAlerts.map(g => ({
      name: g.nombre,
      alerts: g.alerts
    }))
  } else {
    const coursesInGrade = dashboardData.value.lowPerformance.groupRisk.filter(
      r => r.grado_nombre === globalSelectedGrade.value
    )
    return coursesInGrade.map(c => ({
      name: `${getCourseDisplayName(c)} - ${c.jornada_nombre}`,
      alerts: c.at_risk
    }))
    .filter(c => c.alerts > 0)
    .sort((a, b) => b.alerts - a.alerts)
  }
})

const filteredCriticalSubjects = computed(() => {
  const studentsList = dashboardData.value.lowPerformance.studentsAtRiskList || []
  
  // Filter students based on selected grade
  const filteredStudents = globalSelectedGrade.value === 'ALL'
    ? studentsList
    : studentsList.filter(s => s.grado_nombre === globalSelectedGrade.value)
    
  // Aggregate subject failures
  const subjectMap = new Map<string, {
    nombre: string;
    failures: number;
    estudiantes_reprobados: {
      id_estudiante: number;
      nombre_completo: string;
      promedio: number;
      curso: string;
    }[]
  }>()
  
  for (const student of filteredStudents) {
    if (!student.detalles_materias) continue
    for (const detail of student.detalles_materias) {
      const subjectName = detail.materia_nombre
      const gradeOrCourseName = student.curso || 'Desconocido'
      
      let subjectData = subjectMap.get(subjectName)
      if (!subjectData) {
        subjectData = {
          nombre: subjectName,
          failures: 0,
          estudiantes_reprobados: []
        }
        subjectMap.set(subjectName, subjectData)
      }
      
      subjectData.failures++
      subjectData.estudiantes_reprobados.push({
        id_estudiante: student.id_estudiante,
        nombre_completo: student.nombre_completo,
        promedio: detail.promedio,
        curso: gradeOrCourseName
      })
    }
  }
  
  // Convert map to array, sort by failures desc, and take the top 5
  return Array.from(subjectMap.values())
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 5)
})

// Methods
const fetchDashboard = async () => {
  if (!schoolId.value) return
  loading.value = true
  fetchError.value = false
  try {
    const params: any = {}
    if (selectedYearId.value) params.yearId = selectedYearId.value
    if (selectedPeriodId.value) params.periodId = selectedPeriodId.value
    const data = await academicService.getDashboard(schoolId.value, params)
    dashboardData.value = data
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    fetchError.value = true
  } finally {
    loading.value = false
  }
}

const loadPeriods = async () => {
  if (!schoolId.value) return
  try {
    const params: any = { keys: 'periods,tiposGrado,defaultSettings' }
    if (selectedYearId.value) {
      params.yearId = selectedYearId.value
    }
    const data = await academicService.getSettings(schoolId.value, params)
    allPeriods.value = (data.periods || []).filter((p: any) => p.estado !== 'PENDIENTE')
    if (data.tiposGrado) {
      schoolGradesCatalog.value = (data.tiposGrado || []).map((g: any) => g.nombre).filter(Boolean)
    }
    if (data.defaultSettings?.nota_maxima) {
      maxGrade.value = Number(data.defaultSettings.nota_maxima).toFixed(1)
    }

    // Set active period by default if none selected
    if (!selectedPeriodId.value) {
      const active = periods.value.find(p => p.estado === 'ABIERTO')
      if (active) {
        selectedPeriodId.value = active.id_periodo
      } else if (periods.value.length > 0) {
        selectedPeriodId.value = periods.value[periods.value.length - 1].id_periodo
      }
    }
  } catch (error) {
    console.error('Error loading periods:', error)
    fetchError.value = true
  }
}

// When year changes, reload periods for that specific year and reset selected period and grade
watch(selectedYearId, async () => {
  selectedPeriodId.value = null
  globalSelectedGrade.value = 'ALL'
  await loadPeriods()
  const yearPeriods = periods.value
  const active = yearPeriods.find(p => p.estado === 'ABIERTO')
  let defaultPeriodId: number | null = null
  if (active) {
    defaultPeriodId = active.id_periodo
  } else if (yearPeriods.length > 0) {
    defaultPeriodId = yearPeriods.at(-1)?.id_periodo ?? null
  }
  selectedPeriodId.value = defaultPeriodId
  fetchDashboard()
})

watch(selectedPeriodId, fetchDashboard)

const enrollmentNotice = ref<string | null>(null)

const checkEnrollmentDates = async () => {
  if (!schoolId.value) return
  try {
    const data = await enrollmentService.getSchoolEnrollmentConfig(schoolId.value)
    if (data && data.config && data.config.habilitada && data.config.fecha_inicio && data.config.fecha_cierre) {
      const now = new Date()
      const start = new Date(data.config.fecha_inicio)
      const end = new Date(data.config.fecha_cierre)
      if (now >= start && now <= end) {
        const diffTime = end.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays === 0) {
          enrollmentNotice.value = "Fechas de inscripción abiertas, terminan hoy"
        } else if (diffDays === 1) {
          enrollmentNotice.value = "Fechas de inscripción abiertas, terminan mañana"
        } else {
          enrollmentNotice.value = `Fechas de inscripción abiertas, terminan en ${diffDays} días`
        }
      } else {
        enrollmentNotice.value = null
      }
    } else {
      enrollmentNotice.value = null
    }
  } catch (error) {
    console.error('Error checking enrollment dates for notice:', error)
    enrollmentNotice.value = null
  }
}

watch(schoolId, () => {
  checkEnrollmentDates()
})


const handleRetry = async () => {
  loading.value = true
  fetchError.value = false
  try {
    await loadPeriods()
    await fetchDashboard()
    await checkEnrollmentDates()
    
    // Trigger initial setup for courses if grade is not ALL
    if (globalSelectedGrade.value !== 'ALL') {
      const courses = dashboardData.value.charts.performanceByCourse.filter(
        c => c.grado_nombre === globalSelectedGrade.value
      )
      if (courses.length > 0) {
        selectedCourseForSubjects.value = courses[0].id_grupo
        selectedCourseForEvolution.value = courses[0].id_grupo
      }
    }
  } catch (error) {
    console.error('Error in handleRetry:', error)
    fetchError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  handleRetry()
})
</script>

<template>
  <div class="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
    
    <!-- Contador Regresivo de Cierre de Período Académico -->
    <PeriodCountdownBanner :period-info="dashboardData?.activePeriodInfo" />

    <!-- Welcome & Period Selector -->
    <div class="flex flex-col 2xl:flex-row gap-6 items-stretch 2xl:items-center justify-between">
      <div class="bg-indigo-600 rounded-[2rem] p-6 sm:p-8 text-white shadow-xl shadow-indigo-100 dark:shadow-none flex-1 relative overflow-hidden w-full min-w-0">
        <div class="relative z-10">
          <h1 class="text-2xl sm:text-3xl font-black">¡Bienvenido, {{ auth.user?.name || 'Director' }}! 👋</h1>
          <p class="mt-2 text-indigo-100 max-w-xl text-sm sm:text-base font-medium">
            Módulo <span class="font-bold underline text-white">Directivo</span>. Analiza el rendimiento institucional en tiempo real.
          </p>
        </div>
        <div class="absolute -right-10 -bottom-10 h-48 w-48 bg-white/10 rounded-full blur-3xl"></div>
      </div>
      
      <!-- Filters -->
      <div class="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm w-full 2xl:w-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="flex flex-col gap-2 min-w-0">
          <label for="dash-selected-year" class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 truncate">
            <CalendarDays :size="14" class="shrink-0" />
            Año Lectivo
          </label>
          <select 
            id="dash-selected-year"
            v-model="selectedYearId" 
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 sm:p-3.5 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer truncate"
          >
            <option v-for="y in academicYears" :key="y['id_anio']" :value="y['id_anio']">
              {{ y.calendario }}{{ y.estado === 'CERRADO' ? ' (Cerrado)' : '' }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-2 min-w-0">
          <label for="dash-selected-period" class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 truncate">
            <Filter :size="14" class="shrink-0" />
            Periodo Académico
          </label>
          <select 
            id="dash-selected-period"
            v-model="selectedPeriodId" 
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 sm:p-3.5 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer truncate"
          >
            <option :value="null">Periodo Activo (Auto)</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }}{{ p.estado === 'ABIERTO' ? ' (Activo)' : '' }}
            </option>
          </select>
        </div>
        
        <div class="flex flex-col gap-2 min-w-0">
          <label for="dash-selected-grade" class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 truncate">
            <Filter :size="14" class="shrink-0" />
            Grado
          </label>
          <select 
            id="dash-selected-grade"
            v-model="globalSelectedGrade" 
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 sm:p-3.5 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer truncate"
          >
            <option value="ALL">Todos los Grados</option>
            <option v-for="grade in globalGradeOptions" :key="grade" :value="grade">
              {{ grade }}
            </option>
          </select>
        </div>
      </div>
    </div>
    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 min-h-[400px]">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 dark:border-slate-800 dark:border-t-indigo-400 mb-4"></div>
      <p class="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">Cargando datos institucionales...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-12 text-center flex flex-col items-center justify-center min-h-[400px] shadow-sm transition-colors w-full">
      <div class="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 p-5 rounded-full mb-4">
        <AlertTriangle :size="36" />
      </div>
      <h3 class="text-xl font-black text-slate-900 dark:text-white">Error al cargar la información</h3>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md font-medium">
        No se pudo obtener la información del colegio. Por favor verifica tu sesión o vuelve a intentarlo.
      </p>
      <button 
        type="button"
        @click="handleRetry"
        class="mt-6 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-black transition-all text-sm shadow-md hover:shadow-lg focus:outline-none cursor-pointer"
      >
        Reintentar
      </button>
    </div>

    <!-- Main Content -->
    <template v-else>
      <!-- Enrollment Active Alert Banner -->
      <div v-if="enrollmentNotice" class="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-4 px-6 rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
        <div class="flex items-center gap-3">
          <div class="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
          <span class="text-sm font-bold text-emerald-800 dark:text-emerald-300">{{ enrollmentNotice }}</span>
        </div>
        <router-link to="/dashboard/gestion-matriculas" class="text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline uppercase tracking-wider">
          Gestionar Matrículas
        </router-link>
      </div>

      <!-- Navigation Tabs for Dashboard -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto custom-scrollbar">
        <button 
          type="button"
          @click="activeTab = 'summary'"
          :class="[
            'flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap',
            activeTab === 'summary'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          ]"
        >
          <TrendingUp :size="18" />
          <span>Resumen General</span>
        </button>

        <button 
          type="button"
          @click="activeTab = 'risk'"
          :class="[
            'flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap',
            activeTab === 'risk'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          ]"
        >
          <AlertTriangle :size="18" />
          <span>Riesgo Académico</span>
          <span v-if="activeSummary.studentsAtRisk > 0" class="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-black">
            {{ activeSummary.studentsAtRisk }}
          </span>
        </button>

        <button 
          type="button"
          @click="activeTab = 'observations'"
          :class="[
            'flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap',
            activeTab === 'observations'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          ]"
        >
          <ShieldAlert :size="18" />
          <span>Convivencia & Observaciones</span>
          <span v-if="dashboardData.observationsSummary?.total > 0" class="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-black">
            {{ dashboardData.observationsSummary.total }}
          </span>
        </button>
      </div>

      <!-- TAB 1: RESUMEN GENERAL & GRÁFICOS -->
      <div v-if="activeTab === 'summary'" class="space-y-8 animate-in fade-in duration-300">
        <!-- Principal KPIs -->
        <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
          <div 
            v-for="stat in dashboardStats" 
            :key="stat.name" 
            class="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-3 sm:gap-4 group min-w-0"
          >
            <div :class="[stat.bg, stat.color, 'p-3 sm:p-4 rounded-xl shrink-0 transition-transform group-hover:scale-105']">
              <component :is="stat.icon" class="w-6 h-6 sm:w-7 sm:h-7" stroke-width="2.5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate" :title="stat.name">{{ stat.name }}</p>
              <div class="flex items-baseline gap-1 mt-0.5 min-w-0">
                <span class="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                  {{ stat.value }}
                </span>
                <span v-if="(stat as any).subValue" class="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 shrink-0">
                  {{ (stat as any).subValue }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="grid grid-cols-1 gap-8">
          <!-- Performance by Grade -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm flex flex-col min-h-[450px] transition-colors">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 class="text-base sm:text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                <TrendingUp :size="20" class="text-indigo-600" />
                {{ globalSelectedGrade === 'ALL' ? 'Rendimiento por Grado' : 'Rendimiento por Curso' }}
              </h3>
            </div>
            <div class="flex-1 w-full flex items-center justify-center">
              <Bar v-if="!loading && hasGradeChartData" :data="gradeChartData" :options="horizontalOptions as any" />
              <EmptyChartState 
                v-else-if="!loading"
                :icon="TrendingUp"
                :badge-text="dashboardData.activePeriodInfo?.estado === 'CERRADO' ? 'Periodo Cerrado' : 'Periodo en curso'"
                title="Sin datos consolidados de rendimiento"
                description="Las barras de promedio por grado o curso se generarán en cuanto existan notas registradas en el periodo."
              />
            </div>
          </div>

          <!-- Performance by Subject -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm flex flex-col min-h-[500px] transition-colors">
            <div class="flex flex-col mb-6">
              <h3 class="text-base sm:text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                <BookOpen :size="20" class="text-emerald-500" />
                Rendimiento por Materia {{ globalSelectedGrade === 'ALL' ? '(Top 10 Institucional)' : 'por Curso' }}
              </h3>
              
              <!-- Course Selector Blocks (Only visible when a grade is selected) -->
              <div v-if="globalSelectedGrade !== 'ALL' && availableCoursesForSelectedGrade.length > 0" class="mt-4 flex flex-wrap gap-2 sm:gap-3">
                <button
                  type="button"
                  v-for="course in availableCoursesForSelectedGrade"
                  :key="course.id_grupo"
                  @click="selectedCourseForSubjects = course.id_grupo"
                  :class="[
                    'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer',
                    selectedCourseForSubjects === course.id_grupo 
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20 scale-105' 
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-500'
                  ]"
                >
                  {{ getCourseDisplayName(course) }} - {{ course.jornada_nombre }}
                </button>
              </div>
              <div v-else-if="globalSelectedGrade !== 'ALL' && availableCoursesForSelectedGrade.length === 0" class="mt-4 text-sm text-slate-500 italic">
                No hay cursos disponibles para este grado.
              </div>
            </div>
            
            <div class="flex-1 w-full relative flex items-center justify-center">
              <div v-if="globalSelectedGrade !== 'ALL' && !selectedCourseForSubjects && availableCoursesForSelectedGrade.length > 0" class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <p class="text-slate-500 font-medium text-sm">Selecciona un curso arriba para ver su rendimiento.</p>
              </div>
              <Bar v-if="!loading && hasSubjectChartData" :data="subjectChartData" :options="horizontalOptions as any" />
              <EmptyChartState 
                v-else-if="!loading"
                :icon="BookOpen"
                :badge-text="dashboardData.activePeriodInfo?.estado === 'CERRADO' ? 'Periodo Cerrado' : 'Periodo en curso'"
                title="Sin calificaciones por asignatura"
                description="El consolidado de asignaturas se trazará automáticamente conforme se publiquen evaluaciones."
              />
            </div>
          </div>

          <!-- Performance Evolution -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm flex flex-col min-h-[400px] transition-colors">
            <div class="flex flex-col mb-6">
              <h3 class="text-base sm:text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                <Target :size="20" class="text-amber-500" />
                Evolución del Promedio {{ globalSelectedGrade === 'ALL' ? 'Institucional' : 'por Curso' }}
              </h3>
              
              <!-- Course Selector Blocks for Evolution -->
              <div v-if="globalSelectedGrade !== 'ALL' && availableCoursesForSelectedGrade.length > 0" class="mt-4 flex flex-wrap gap-2 sm:gap-3">
                <button
                  type="button"
                  v-for="course in availableCoursesForSelectedGrade"
                  :key="course.id_grupo"
                  @click="selectedCourseForEvolution = course.id_grupo"
                  :class="[
                    'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer',
                    selectedCourseForEvolution === course.id_grupo 
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 scale-105' 
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:text-amber-500'
                  ]"
                >
                  {{ getCourseDisplayName(course) }} - {{ course.jornada_nombre }}
                </button>
              </div>
              <div v-else-if="globalSelectedGrade !== 'ALL' && availableCoursesForSelectedGrade.length === 0" class="mt-4 text-sm text-slate-500 italic">
                No hay cursos disponibles para este grado.
              </div>
            </div>
            
            <div class="flex-1 w-full relative flex items-center justify-center">
              <div v-if="globalSelectedGrade !== 'ALL' && !selectedCourseForEvolution && availableCoursesForSelectedGrade.length > 0" class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <p class="text-slate-500 font-medium text-sm">Selecciona un curso arriba para ver su evolución.</p>
              </div>
              <Line v-if="!loading && hasEvolutionChartData" :data="evolutionChartData" :options="chartOptionsBase as any" />
              <EmptyChartState 
                v-else-if="!loading"
                :icon="Target"
                :badge-text="dashboardData.activePeriodInfo?.estado === 'CERRADO' ? 'Periodo Cerrado' : 'Periodo en curso'"
                title="Evolución institucional en preparación"
                description="La trayectoria histórica de promedios se activará con el avance de los periodos evaluativos."
              />
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: RIESGO ACADÉMICO & ALERTAS -->
      <div v-else-if="activeTab === 'risk'" class="space-y-8 animate-in fade-in duration-300">
        <div class="bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-950/50 rounded-2xl p-6 sm:p-8 shadow-sm transition-colors space-y-6">
          <div class="flex items-center gap-4">
            <div class="bg-rose-500 text-white p-3.5 rounded-2xl shadow-md shadow-rose-500/20">
              <AlertTriangle :size="26" />
            </div>
            <div>
              <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Focos de Riesgo y Desempeño Crítico</h2>
              <p class="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">Detección de alertas tempranas para intervención académica oportuna.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-8">
            <!-- Risk by Course (STACKED HORIZONTAL) -->
            <div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 p-6 rounded-2xl flex flex-col min-h-[450px]">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 class="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                  <LayoutDashboard :size="18" class="text-indigo-500" />
                  {{ globalSelectedGrade === 'ALL' ? 'Riesgo de Reprobación por Grado' : 'Riesgo de Reprobación por Curso' }}
                </h3>
                <div class="flex gap-4 text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                  <span class="flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
                    <div class="h-2 w-2 rounded-full bg-rose-500"></div> En Riesgo
                  </span>
                  <span class="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400">
                    <div class="h-2 w-2 rounded-full bg-emerald-500"></div> A Salvo
                  </span>
                </div>
              </div>
              <div class="flex-1 w-full flex items-center justify-center">
                <Bar v-if="!loading && hasRiskChartData" :data="riskChartData" :options="riskChartOptions as any" />
                <EmptyChartState 
                  v-else-if="!loading"
                  :icon="LayoutDashboard"
                  badge-text="Sin Estudiantes en Riesgo"
                  title="Semáforo académico despejado"
                  description="No se registran estudiantes en riesgo crítico de reprobación en los grados y cursos seleccionados."
                />
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              <!-- Critical Subjects List -->
              <div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 p-6 rounded-2xl flex flex-col h-[450px]">
                <div class="flex flex-col mb-4">
                  <h3 class="text-base font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <BookOpen :size="18" />
                    Materias con Mayor Reprobación
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Asignaturas con mayor volumen de estudiantes en riesgo</p>
                </div>
                <div class="space-y-3 overflow-y-auto pr-1 custom-scrollbar flex-1">
                  <div 
                    v-for="(sub, idx) in filteredCriticalSubjects" 
                    :key="idx"
                    @click="handleCriticalSubjectClick(sub)"
                    class="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-600 transition-all group cursor-pointer"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-black text-xs">
                        #{{ idx + 1 }}
                      </div>
                      <span class="font-bold truncate text-sm text-slate-800 dark:text-slate-200">{{ sub.nombre }}</span>
                    </div>
                    <span class="text-xs font-black bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg shrink-0">
                      {{ sub.failures }} Alumnos
                    </span>
                  </div>
                  <div v-if="filteredCriticalSubjects.length === 0" class="flex flex-col items-center justify-center h-full text-slate-400 italic text-sm">
                    Sin datos de reprobación en este período
                  </div>
                </div>
              </div>

              <!-- Grade Alerts -->
              <div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 p-6 rounded-2xl flex flex-col h-[450px]">
                <div class="flex flex-col mb-4">
                  <h3 class="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Target :size="18" />
                    {{ globalSelectedGrade === 'ALL' ? 'Alertas por Grado' : 'Alertas por Curso' }}
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Estudiantes reprobando una o más materias</p>
                </div>
                <div class="space-y-3 overflow-y-auto pr-1 custom-scrollbar flex-1">
                  <div 
                    v-for="(item, idx) in filteredAlertsData" 
                    :key="idx"
                    @click="handleAlertClick(item)"
                    class="flex flex-col gap-2 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition-all cursor-pointer"
                  >
                    <div class="flex justify-between items-center">
                      <span class="font-bold text-sm text-slate-800 dark:text-slate-200">{{ item.name }}</span>
                      <span class="text-xs font-black text-amber-600 dark:text-amber-400">{{ item.alerts }} Alumnos</span>
                    </div>
                    <div class="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        class="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700" 
                        :style="{ width: `${Math.min(100, (item.alerts / (dashboardData.summary.totalStudents || 1)) * 100 * 5)}%` }"
                      ></div>
                    </div>
                  </div>
                  <div v-if="filteredAlertsData.length === 0" class="flex flex-col items-center justify-center h-full text-slate-400 italic text-sm">
                    Sin alertas registradas
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: CONVIVENCIA & OBSERVACIONES -->
      <div v-else-if="activeTab === 'observations'" class="space-y-6 animate-in fade-in duration-300">
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm transition-colors space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div class="flex items-center gap-3">
              <div class="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
                <ShieldAlert :size="22" />
              </div>
              <div>
                <h3 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Seguimiento de Convivencia y Observaciones</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Recopilación institucional por categoría y medidas vigentes</p>
              </div>
            </div>
            <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 self-start sm:self-auto">
              <CalendarDays :size="14" class="text-purple-500" />
              Total Registros: <span class="text-slate-900 dark:text-white text-sm font-black">{{ dashboardData.observationsSummary?.total || 0 }}</span>
            </div>
          </div>

          <!-- Observaciones Sub-KPIs Grid -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Académicas -->
            <div class="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 p-4 rounded-xl transition-all flex items-center justify-between group">
              <div>
                <p class="text-xs font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider">Académicas</p>
                <p class="text-2xl font-black mt-1 text-slate-900 dark:text-white">{{ dashboardData.observationsSummary?.academicas || 0 }}</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Alertas pedagógicas</p>
              </div>
              <div class="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-lg">
                <Lightbulb :size="18" />
              </div>
            </div>

            <!-- Disciplinarias -->
            <div class="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 p-4 rounded-xl transition-all flex items-center justify-between group">
              <div>
                <p class="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Disciplinarias</p>
                <p class="text-2xl font-black mt-1 text-slate-900 dark:text-white">{{ dashboardData.observationsSummary?.disciplinarias || 0 }}</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Faltas al manual</p>
              </div>
              <div class="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
                <FileWarning :size="18" />
              </div>
            </div>

            <!-- Convivenciales -->
            <div class="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 p-4 rounded-xl transition-all flex items-center justify-between group">
              <div>
                <p class="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">Convivenciales</p>
                <p class="text-2xl font-black mt-1 text-slate-900 dark:text-white">{{ dashboardData.observationsSummary?.convivenciales || 0 }}</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Acuerdos de grupo</p>
              </div>
              <div class="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg">
                <MessageSquare :size="18" />
              </div>
            </div>

            <!-- Sanciones Activas -->
            <div class="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 p-4 rounded-xl transition-all flex items-center justify-between group">
              <div>
                <p class="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Sanciones Activas</p>
                <p class="text-2xl font-black mt-1 text-slate-900 dark:text-white">{{ dashboardData.observationsSummary?.sancionesActivas || 0 }}</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Medidas vigentes</p>
              </div>
              <div class="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
                <AlertTriangle :size="18" />
              </div>
            </div>
          </div>

          <!-- Breakdown by Grade List -->
          <div v-if="dashboardData.observationsSummary?.byGrade && dashboardData.observationsSummary.byGrade.length > 0" class="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <Filter :size="14" class="text-purple-500" />
              Desglose de Observaciones por Grado
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              <div 
                v-for="gObs in dashboardData.observationsSummary.byGrade" 
                :key="gObs.grado"
                class="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-xl flex flex-col justify-between hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all"
              >
                <div class="flex justify-between items-center mb-2">
                  <span class="font-bold text-sm text-slate-800 dark:text-slate-200">{{ gObs.grado }}</span>
                  <span class="text-xs font-black bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-lg border border-purple-100 dark:border-purple-900/50">
                    {{ gObs.total }} obs.
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span class="text-sky-600 dark:text-sky-400">Acad: {{ gObs.academicas }}</span> • 
                  <span class="text-amber-600 dark:text-amber-400">Disc: {{ gObs.disciplinarias }}</span> • 
                  <span class="text-purple-600 dark:text-purple-400">Conv: {{ gObs.convivenciales }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal for Students at Risk details -->
      <div v-if="selectedAlertCourse" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-md" @click="selectedAlertCourse = null"></div>
        
        <!-- Modal Content -->
        <div class="relative bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl p-8 max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle class="text-rose-500" :size="24" />
                Estudiantes en Riesgo - {{ selectedAlertCourse.name }}
              </h3>
              <p class="text-xs text-slate-400 mt-1 font-medium">
                Estudiantes reprobando 1 o más materias en este curso.
              </p>
            </div>
            <button 
              type="button"
              @click="selectedAlertCourse = null" 
              class="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 p-3 rounded-2xl transition-all text-slate-400 hover:text-white cursor-pointer"
            >
              <X :size="18" />
            </button>
          </div>
          
          <!-- Search Bar -->
          <div class="relative mb-6">
            <label for="modal-search-risk-input" class="sr-only">Buscar estudiante por nombre</label>
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
              <Search :size="16" />
            </div>
            <input
              id="modal-search-risk-input"
              v-model="modalSearchQuery"
              type="text"
              placeholder="Buscar estudiante por nombre..."
              class="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all"
            />
          </div>
          
          <!-- Student List -->
          <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
            <div 
              v-for="student in studentsAtRiskForSelectedAlertCourse" 
              :key="student.id_estudiante"
              class="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"
            >
              <div class="flex items-center gap-4 min-w-0">
                <div class="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 font-black text-sm">
                  {{ student.nombre_completo.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() }}
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="font-bold truncate text-sm text-slate-200">{{ student.nombre_completo }}</span>
                  <span class="text-xs text-slate-400 mt-0.5">Promedio General: <span class="font-bold text-slate-300">{{ student.promedio_general }}</span></span>
                  <!-- Detalles de materias reprobadas -->
                  <div v-if="student.detalles_materias && student.detalles_materias.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                    <span 
                      v-for="(sub, sIdx) in student.detalles_materias" 
                      :key="sIdx"
                      class="text-[10px] font-bold bg-rose-500/10 border border-rose-500/25 text-rose-300 px-2 py-0.5 rounded-lg"
                    >
                      {{ sub.materia_nombre }}: <span class="text-rose-400 font-extrabold">{{ sub.promedio }}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span class="text-xs font-black bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-full whitespace-nowrap">
                  {{ student.materias_reprobadas }} {{ student.materias_reprobadas === 1 ? 'materia reprobada' : 'materias reprobadas' }}
                </span>
              </div>
            </div>
            <div v-if="studentsAtRiskForSelectedAlertCourse.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-500 italic">
              No se encontraron estudiantes en riesgo en este curso.
            </div>
          </div>
        </div>
      </div>

      <!-- Modal for Critical Subject Students details -->
      <div v-if="selectedCriticalSubject" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-md" @click="selectedCriticalSubject = null"></div>
        
        <!-- Modal Content -->
        <div class="relative bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl p-8 max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen class="text-rose-500" :size="24" />
                Estudiantes Reprobando - {{ selectedCriticalSubject.nombre }}
              </h3>
              <p class="text-xs text-slate-400 mt-1 font-medium">
                Listado de estudiantes con promedio inferior a 3.0 en esta materia.
              </p>
            </div>
            <button 
              type="button"
              @click="selectedCriticalSubject = null" 
              class="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 p-3 rounded-2xl transition-all text-slate-400 hover:text-white cursor-pointer"
            >
              <X :size="18" />
            </button>
          </div>
          
          <!-- Search Bar and Group Filter -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="relative md:col-span-2">
              <label for="modal-search-critical-input" class="sr-only">Buscar estudiante por nombre</label>
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                <Search :size="16" />
              </div>
              <input
                id="modal-search-critical-input"
                v-model="modalSearchQuery"
                type="text"
                placeholder="Buscar estudiante por nombre..."
                class="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all"
              />
            </div>
            <div class="relative">
              <label for="modal-group-select" class="sr-only">Filtrar por grupo o curso</label>
              <select
                id="modal-group-select"
                v-model="selectedModalGroup"
                class="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-4 pr-10 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all cursor-pointer"
              >
                <option value="ALL" class="bg-slate-900 text-white">Todos los Cursos</option>
                <option v-for="group in availableModalGroups" :key="group" :value="group" class="bg-slate-900 text-white">
                  {{ group }}
                </option>
              </select>
              <div class="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-500">
                <Filter :size="14" />
              </div>
            </div>
          </div>
          
          <!-- Student List -->
          <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
            <div 
              v-for="student in filteredCriticalSubjectStudents" 
              :key="student.id_estudiante"
              class="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"
            >
              <div class="flex items-center gap-4 min-w-0">
                <div class="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 font-black text-sm">
                  {{ getInitials(student.nombre_completo) }}
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="font-bold truncate text-sm text-slate-200">{{ student.nombre_completo }}</span>
                  <span class="text-xs text-slate-400 mt-0.5">Curso: <span class="font-bold text-slate-300">{{ student.curso }}</span></span>
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span class="text-xs font-black bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-full whitespace-nowrap">
                  Nota: {{ student.promedio }}
                </span>
              </div>
            </div>
            <div v-if="filteredCriticalSubjectStudents.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-500 italic">
              No se encontraron estudiantes reprobando esta materia.
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
</style>
