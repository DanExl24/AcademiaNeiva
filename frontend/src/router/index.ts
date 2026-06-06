import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LandingView from '../views/public/LandingView.vue'
import LoginView from '../views/auth/LoginView.vue'
import EnrollmentView from '../views/public/EnrollmentView.vue'
import DashboardHomeDispatcher from '../views/shared/DashboardHomeDispatcher.vue'
import EnrollmentManagement from '../views/admin/EnrollmentManagement.vue'
import EnrollmentDetails from '../views/admin/EnrollmentDetails.vue'
import FinalRegistration from '../views/admin/FinalRegistration.vue'
import EnrollmentCorrection from '../views/public/EnrollmentCorrection.vue'
import DashboardLayout from '../layouts/DashboardLayout.vue'
import GradeManagement from '../views/admin/GradeManagement.vue'
import SubjectManagement from '../views/admin/SubjectManagement.vue'
import TeacherManagement from '../views/admin/TeacherManagement.vue'
import AcademicSettings from '../views/admin/AcademicSettings.vue'
import AcademicCompetenciesView from '../views/admin/AcademicCompetenciesView.vue'
import BoletinGenerator from '../views/admin/BoletinGenerator.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/login/estudiante',
      name: 'student-login',
      component: () => import('../views/auth/StudentLoginView.vue')
    },
    {
      path: '/matricula',
      name: 'matricula',
      component: EnrollmentView
    },
    {
      path: '/matricula/corregir/:id',
      name: 'matricula-corregir',
      component: EnrollmentCorrection
    },
    {
      path: '/dashboard',
      component: DashboardLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: DashboardHomeDispatcher
        },
        {
          path: 'gestion-matriculas',
          name: 'Gestión de Matrículas',
          component: EnrollmentManagement
        },
        {
          path: 'gestion-matriculas/:id',
          name: 'Detalle de Matrícula',
          component: EnrollmentDetails
        },
        {
          path: 'gestion-matriculas/:id/registro',
          name: 'Finalizar Registro',
          component: FinalRegistration
        },
        {
          path: 'gestion-grados',
          name: 'Gestión de Grados',
          component: GradeManagement
        },
        {
          path: 'gestion-materias',
          name: 'Gestión de Materias',
          component: SubjectManagement
        },
        {
          path: 'docentes',
          name: 'Gestión de Docentes',
          component: TeacherManagement
        },
        {
          path: 'configuracion-academica',
          name: 'Configuración Académica',
          component: AcademicSettings
        },
        {
          path: 'configuracion-academica/competencias',
          name: 'Competencias Académicas',
          component: AcademicCompetenciesView
        },
        {
          path: 'configuracion-academica/cierres',
          name: 'Cierres de Periodo',
          component: () => import('../views/admin/PeriodClosure.vue')
        },
        {
          path: 'configuracion-academica/escalas',
          name: 'Escalas de Valoración',
          component: () => import('../views/admin/AcademicScalesView.vue')
        },
        {
          path: 'configuracion-academica/periodos',
          name: 'Periodos Académicos',
          component: () => import('../views/admin/AcademicPeriodsView.vue')
        },
        {
          path: 'boletines',
          name: 'Generación de Boletines',
          component: BoletinGenerator
        },
        // Rutas del Docente
        {
          path: 'mis-cursos',
          name: 'Mis Cursos',
          component: () => import('../views/teacher/TeacherCourses.vue')
        },
        {
          path: 'calificaciones',
          name: 'teacher-grades',
          component: () => import('../views/teacher/TeacherGrades.vue')
        },
        {
          path: 'asistencia',
          name: 'Asistencia',
          component: () => import('../views/teacher/TeacherAttendance.vue')
        },
        {
          path: 'observador',
          name: 'Observador del Estudiante',
          component: () => import('../views/teacher/TeacherObservations.vue')
        },
        {
          path: 'cierre-periodo',
          name: 'Cierre de Periodo',
          component: () => import('../views/teacher/TeacherClosure.vue')
        },
        {
          path: 'mis-notas',
          name: 'Mis Notas',
          component: () => import('../views/student/StudentGradesView.vue')
        },
        {
          path: 'mis-notas/:id_materia/:id_periodo',
          name: 'Detalle de Materia',
          component: () => import('../views/student/SubjectDetailsView.vue'),
          meta: { title: 'Detalle de Materia' }
        },
        {
          path: 'mi-asistencia',
          name: 'Mi Asistencia',
          component: () => import('../views/student/StudentAttendanceView.vue')
        },
        {
          path: 'mi-observacion',
          name: 'student-observations',
          component: () => import('../views/student/StudentObservationsView.vue')
        },
        // Rutas del Padre
        {
          path: 'hijos',
          name: 'Mis Hijos',
          component: () => import('../views/parent/ParentDashboard.vue')
        },
        {
          path: 'notas-hijos',
          name: 'Calificaciones de Hijos',
          component: () => import('../views/parent/ParentGradesView.vue')
        },
        {
          path: 'notas-hijos/:id_estudiante/:id_materia/:id_periodo',
          name: 'Detalle de Materia (Hijo)',
          component: () => import('../views/student/SubjectDetailsView.vue'),
          meta: { title: 'Detalle de Calificaciones' }
        },
        {
          path: 'asistencia-hijos',
          name: 'Asistencia de Hijos',
          component: () => import('../views/parent/ParentAttendanceView.vue')
        },
        {
          path: 'observaciones-hijos',
          name: 'Observaciones de Hijos',
          component: () => import('../views/parent/ParentObservationsView.vue')
        }
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

export default router
