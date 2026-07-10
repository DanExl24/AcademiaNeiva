<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { getCourseDisplayName } from '../../utils/courseHelper'
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  TrendingUp,
  Target,
  AlertTriangle,
  UserCheck,
  Filter,
  LayoutDashboard,
  X,
  Search,
  CalendarDays
} from 'lucide-vue-next'
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

const loading = ref(true)
const fetchError = ref(false)
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

// Data State
const dashboardData = ref({
  summary: {
    totalStudents: 0,
    totalTeachers: 0,
    attendanceToday: 0,
    generalAverage: 0,
    studentsAtRisk: 0,
    disciplinaryReports: 0,
    desertionRate: 0,
  },
  summaryByGrade: {} as Record<string, {
    totalStudents: number;
    totalTeachers: number;
    attendanceToday: number;
    generalAverage: number;
    studentsAtRisk: number;
    disciplinaryReports: number;
    desertionRate: number;
  }>,
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

const allPeriods = ref<any[]>([])
const academicYears = ref<any[]>([])
const selectedYearId = ref<number | null>(null)
const selectedPeriodId = ref<number | null>(null)

// Only show periods for the selected year and hide PENDIENTE ones
const periods = computed(() => {
  let list = allPeriods.value
  if (selectedYearId.value) {
    list = list.filter((p: any) => p['id_anio'] === selectedYearId.value)
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
    studentsAtRisk: 0,
    disciplinaryReports: 0,
    desertionRate: 0
  }
})

// Computed Stats for Cards
const dashboardStats = computed(() => [
  { name: 'Estudiantes', value: activeSummary.value.totalStudents.toString(), icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
  { name: 'Docentes', value: activeSummary.value.totalTeachers.toString(), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { name: 'Asistencia Hoy', value: `${activeSummary.value.attendanceToday}%`, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { name: 'Riesgo Académico', value: activeSummary.value.studentsAtRisk.toString(), icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
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

const globalGradeOptions = computed(() => {
  const gradesRisk = dashboardData.value.lowPerformance.groupRisk.map(r => r.grado_nombre)
  const gradesPerf = dashboardData.value.charts.performanceByCourse.map(c => c.grado_nombre)
  return [...new Set([...gradesRisk, ...gradesPerf])].filter(Boolean).sort()
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
        data: dashboardData.value.charts.performanceByGrade.map(g => g.average),
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
        data: filteredCourses.map(c => c.average),
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
        data: dashboardData.value.charts.performanceBySubject.map(s => s.average),
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
      .sort((a, b) => b.average - a.average)
      .slice(0, 15);
      
    return {
      labels: filtered.map(f => f.subject_nombre),
      datasets: [{
        label: 'Promedio Materia',
        data: filtered.map(f => f.average),
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
        data: dashboardData.value.charts.evolution.map(e => e.average),
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
        data: filtered.map(e => e.average),
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
    const url = `http://localhost:3000/api/academic-admin/dashboard/${schoolId.value}`
    const params: any = {}
    if (selectedYearId.value) params.yearId = selectedYearId.value
    if (selectedPeriodId.value) params.periodId = selectedPeriodId.value
    const headers = { Authorization: `Bearer ${auth.token}` }
    const response = await axios.get(url, { params, headers })
    dashboardData.value = response.data
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
    const headers = { Authorization: `Bearer ${auth.token}` }
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`, { headers })
    allPeriods.value = response.data.periods
    academicYears.value = response.data.academicYears || []

    // Default to the active year
    if (!selectedYearId.value && response.data.activeYear) {
      selectedYearId.value = response.data.activeYear['id_anio']
    }

    // Set active period by default if none selected
    if (!selectedPeriodId.value) {
      const active = periods.value.find(p => p.estado === 'ABIERTO')
      if (active) selectedPeriodId.value = active.id_periodo
    }
  } catch (error) {
    console.error('Error loading periods:', error)
    fetchError.value = true
  }
}

// When year changes, reset period to the open one for that year
watch(selectedYearId, () => {
  const yearPeriods = periods.value
  const active = yearPeriods.find(p => p.estado === 'ABIERTO')
  selectedPeriodId.value = active ? active.id_periodo : (yearPeriods.length > 0 ? yearPeriods[yearPeriods.length - 1].id_periodo : null)
  fetchDashboard()
})

watch(selectedPeriodId, fetchDashboard)

const enrollmentNotice = ref<string | null>(null)

const checkEnrollmentDates = async () => {
  if (!schoolId.value) return
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const response = await axios.get(`http://localhost:3000/api/matriculas/school/${schoolId.value}/enrollment-config`, { headers })
    const data = response.data
    if (data && data.config && data.config.habilitada && !data.config.hasApproved) {
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
    
    <!-- Welcome & Period Selector -->
    <div class="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
      <div class="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-100 dark:shadow-none flex-1 relative overflow-hidden w-full">
        <div class="relative z-10">
          <h1 class="text-3xl font-black">¡Bienvenido, {{ auth.user?.name || 'Director' }}! 👋</h1>
          <p class="mt-2 text-indigo-100 max-w-md font-medium">
            Módulo <span class="font-bold underline text-white">Directivo</span>. Analiza el rendimiento institucional en tiempo real.
          </p>
        </div>
        <div class="absolute -right-10 -bottom-10 h-48 w-48 bg-white/10 rounded-full blur-3xl"></div>
      </div>
      
      <!-- Filters -->
      <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm w-full lg:w-auto flex flex-col sm:flex-row gap-6">
        <div class="flex flex-col gap-3 min-w-[180px]">
          <label class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <CalendarDays :size="14" />
            Año Lectivo
          </label>
          <select 
            v-model="selectedYearId" 
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
          >
            <option v-for="y in academicYears" :key="y['id_anio']" :value="y['id_anio']">
              {{ y.calendario }}{{ y.estado === 'CERRADO' ? ' (Cerrado)' : '' }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-3 min-w-[200px]">
          <label class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Filter :size="14" />
            Periodo Académico
          </label>
          <select 
            v-model="selectedPeriodId" 
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
          >
            <option :value="null">Periodo Activo (Auto)</option>
            <option v-for="p in periods" :key="p.id_periodo" :value="p.id_periodo">
              {{ p.nombre }}{{ p.estado === 'ABIERTO' ? ' (Activo)' : '' }}
            </option>
          </select>
        </div>
        
        <div class="flex flex-col gap-3 min-w-[200px]">
          <label class="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Filter :size="14" />
            Grado
          </label>
          <select 
            v-model="globalSelectedGrade" 
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
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
        @click="handleRetry"
        class="mt-6 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-black transition-all text-sm shadow-md hover:shadow-lg focus:outline-none"
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

      <!-- Principal KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          v-for="stat in dashboardStats" 
          :key="stat.name" 
          class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl dark:hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 flex items-center gap-5 group"
        >
          <div :class="[stat.bg, stat.color, 'p-5 rounded-2xl transition-transform group-hover:scale-110']">
            <component :is="stat.icon" :size="32" stroke-width="2.5" />
          </div>
          <div>
            <p class="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{{ stat.name }}</p>
            <p class="text-3xl font-black text-gray-900 dark:text-white mt-0.5 tracking-tight">
              {{ stat.value }}
            </p>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 gap-8">
        
        <!-- Performance by Grade -->
        <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 p-8 shadow-sm flex flex-col min-h-[450px] transition-colors">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 class="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
              <TrendingUp :size="20" class="text-indigo-600" />
              {{ globalSelectedGrade === 'ALL' ? 'Rendimiento por Grado' : 'Rendimiento por Curso' }}
            </h3>
          </div>
          <div class="flex-1 w-full">
            <Bar v-if="!loading" :data="gradeChartData" :options="horizontalOptions as any" />
          </div>
        </div>

        <!-- Performance by Subject -->
        <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 p-8 shadow-sm flex flex-col min-h-[500px] transition-colors">
          <div class="flex flex-col mb-6">
            <h3 class="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
              <BookOpen :size="20" class="text-emerald-500" />
              Rendimiento por Materia {{ globalSelectedGrade === 'ALL' ? '(Top 10 Institucional)' : 'por Curso' }}
            </h3>
            
            <!-- Course Selector Blocks (Only visible when a grade is selected) -->
            <div v-if="globalSelectedGrade !== 'ALL' && availableCoursesForSelectedGrade.length > 0" class="mt-4 flex flex-wrap gap-3">
              <button
                v-for="course in availableCoursesForSelectedGrade"
                :key="course.id_grupo"
                @click="selectedCourseForSubjects = course.id_grupo"
                :class="[
                  'px-4 py-2 rounded-xl text-sm font-bold transition-all border',
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
          
          <div class="flex-1 w-full relative">
            <div v-if="globalSelectedGrade !== 'ALL' && !selectedCourseForSubjects && availableCoursesForSelectedGrade.length > 0" class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <p class="text-slate-500 font-medium">Selecciona un curso arriba para ver su rendimiento.</p>
            </div>
            <Bar v-if="!loading" :data="subjectChartData" :options="horizontalOptions as any" />
          </div>
        </div>

        <!-- Performance Evolution -->
        <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 p-8 shadow-sm flex flex-col min-h-[400px] transition-colors">
          <div class="flex flex-col mb-6">
            <h3 class="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
              <Target :size="20" class="text-amber-500" />
              Evolución del Promedio {{ globalSelectedGrade === 'ALL' ? 'Institucional' : 'por Curso' }}
            </h3>
            
            <!-- Course Selector Blocks for Evolution (Only visible when a grade is selected) -->
            <div v-if="globalSelectedGrade !== 'ALL' && availableCoursesForSelectedGrade.length > 0" class="mt-4 flex flex-wrap gap-3">
              <button
                v-for="course in availableCoursesForSelectedGrade"
                :key="course.id_grupo"
                @click="selectedCourseForEvolution = course.id_grupo"
                :class="[
                  'px-4 py-2 rounded-xl text-sm font-bold transition-all border',
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
          
          <div class="flex-1 w-full relative">
            <div v-if="globalSelectedGrade !== 'ALL' && !selectedCourseForEvolution && availableCoursesForSelectedGrade.length > 0" class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <p class="text-slate-500 font-medium">Selecciona un curso arriba para ver su evolución.</p>
            </div>
            <Line v-if="!loading" :data="evolutionChartData" :options="chartOptionsBase as any" />
          </div>
        </div>
      </div>

      <!-- Low Performance Analysis Section -->
      <div class="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
        <div class="relative z-10">
          <div class="flex items-center gap-4 mb-10">
            <div class="bg-rose-500 p-4 rounded-3xl shadow-lg shadow-rose-500/20">
              <AlertTriangle :size="32" class="text-white" />
            </div>
            <div>
              <h2 class="text-3xl font-black tracking-tight">Análisis de Desempeño Crítico</h2>
              <p class="text-slate-400 font-medium">Detectando focos de riesgo académico para intervención temprana.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-12">
            <!-- Risk by Course (STACKED HORIZONTAL) -->
            <div class="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[3rem] flex flex-col h-[550px]">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div class="flex flex-col sm:flex-row sm:items-center gap-4">
                  <h3 class="text-xl font-bold flex items-center gap-2 text-indigo-400">
                    <LayoutDashboard :size="20" />
                    {{ globalSelectedGrade === 'ALL' ? 'Riesgo de Reprobación por Grado' : 'Riesgo de Reprobación por Curso' }}
                  </h3>
                </div>
                <div class="flex gap-6 text-[10px] font-black uppercase tracking-widest bg-white/5 px-6 py-3 rounded-2xl border border-white/10 shrink-0">
                  <span class="flex items-center gap-2 text-rose-400">
                    <div class="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div> En Riesgo
                  </span>
                  <span class="flex items-center gap-2 text-emerald-400">
                    <div class="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div> A Salvo
                  </span>
                </div>
              </div>
              <div class="flex-1 w-full">
                <Bar v-if="!loading" :data="riskChartData" :options="riskChartOptions as any" />
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <!-- Critical Subjects List -->
              <div class="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] flex flex-col h-[450px]">
                <div class="flex flex-col mb-6">
                  <h3 class="text-lg font-bold flex items-center gap-2 text-rose-400">
                    <BookOpen :size="20" />
                    Materias Críticas
                  </h3>
                  <p class="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-tighter">Materias con mayor índice de reprobación</p>
                </div>
                <div class="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  <div 
                    v-for="(sub, idx) in filteredCriticalSubjects" 
                    :key="idx"
                    @click="handleCriticalSubjectClick(sub)"
                    class="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-rose-500/30 hover:shadow-lg hover:shadow-rose-500/5 hover:-translate-y-0.5 transition-all group cursor-pointer"
                  >
                    <div class="flex items-center gap-4 min-w-0">
                      <div class="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 font-black text-xs group-hover:scale-110 transition-transform">
                        #{{ idx + 1 }}
                      </div>
                      <span class="font-bold truncate text-sm text-slate-200">{{ sub.nombre }}</span>
                    </div>
                    <div class="flex flex-col items-end">
                      <span class="text-xs font-black bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full whitespace-nowrap">
                        {{ sub.failures }} Estudiantes
                      </span>
                    </div>
                  </div>
                  <div v-if="filteredCriticalSubjects.length === 0" class="flex flex-col items-center justify-center h-full opacity-30 italic">
                    Sin datos de reprobación
                  </div>
                </div>
              </div>

              <!-- Grade Alerts -->
              <div class="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] flex flex-col h-[450px]">
                <div class="flex flex-col mb-6">
                  <h3 class="text-lg font-bold flex items-center gap-2 text-amber-400">
                    <Target :size="20" />
                    {{ globalSelectedGrade === 'ALL' ? 'Alertas por Grado' : 'Alertas por Curso' }}
                  </h3>
                  <p class="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-tighter">Estudiantes que reprueban una o más materias</p>
                </div>
                <div class="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  <div 
                    v-for="(item, idx) in filteredAlertsData" 
                    :key="idx"
                    @click="handleAlertClick(item)"
                    :class="[
                      'flex flex-col gap-2 p-5 bg-white/5 rounded-2xl border border-white/5 transition-all cursor-pointer',
                      globalSelectedGrade === 'ALL' 
                        ? 'hover:border-indigo-500/50 hover:bg-white/10 hover:-translate-y-0.5' 
                        : 'hover:border-amber-500/50 hover:bg-white/10 hover:-translate-y-0.5'
                    ]"
                  >
                    <div class="flex justify-between items-center mb-1">
                      <span class="font-bold text-sm text-slate-200">{{ item.name }}</span>
                      <span class="text-xs font-black text-amber-400">{{ item.alerts }} Estudiantes</span>
                    </div>
                    <div class="w-full h-3 bg-white/5 rounded-full overflow-hidden shadow-inner p-[2px]">
                      <div 
                        class="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000" 
                        :style="{ width: `${Math.min(100, (item.alerts / (dashboardData.summary.totalStudents || 1)) * 100 * 5)}%` }"
                      ></div>
                    </div>
                  </div>
                  <div v-if="filteredAlertsData.length === 0" class="flex flex-col items-center justify-center h-full opacity-30 italic">
                    Sin alertas registradas
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Decorative BG -->
        <div class="absolute -right-20 -top-20 h-80 w-80 bg-rose-500/10 rounded-full blur-[100px]"></div>
        <div class="absolute -left-20 -bottom-20 h-80 w-80 bg-indigo-500/10 rounded-full blur-[100px]"></div>
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
              @click="selectedAlertCourse = null" 
              class="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 p-3 rounded-2xl transition-all text-slate-400 hover:text-white"
            >
              <X :size="18" />
            </button>
          </div>
          
          <!-- Search Bar -->
          <div class="relative mb-6">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
              <Search :size="16" />
            </div>
            <input
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
              @click="selectedCriticalSubject = null" 
              class="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 p-3 rounded-2xl transition-all text-slate-400 hover:text-white"
            >
              <X :size="18" />
            </button>
          </div>
          
          <!-- Search Bar and Group Filter -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="relative md:col-span-2">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                <Search :size="16" />
              </div>
              <input
                v-model="modalSearchQuery"
                type="text"
                placeholder="Buscar estudiante por nombre..."
                class="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all"
              />
            </div>
            <div class="relative">
              <select
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
