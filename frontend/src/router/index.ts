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
      path: '/matricula',
      name: 'matricula',
      component: EnrollmentView
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/auth/ForgotPasswordView.vue')
    },
    {
      path: '/reset-password/:token',
      name: 'reset-password',
      component: () => import('../views/auth/ResetPasswordView.vue')
    },
    {
      path: '/matricula/seguimiento',
      name: 'matricula-seguimiento',
      component: () => import('../views/public/MatriculaTrackingView.vue')
    },
    {
      path: '/matricula/corregir/:id',
      name: 'matricula-corregir',
      component: EnrollmentCorrection
    },
    {
      path: '/soporte',
      name: 'public-support',
      component: () => import('../views/shared/SupportView.vue')
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
          component: EnrollmentManagement,
          meta: { roles: ['directivo'] }
        },
        {
          path: 'gestion-matriculas/:id',
          name: 'Detalle de Matrícula',
          component: EnrollmentDetails,
          meta: { roles: ['directivo'] }
        },
        {
          path: 'gestion-matriculas/:id/registro',
          name: 'Finalizar Registro',
          component: FinalRegistration,
          meta: { roles: ['directivo'] }
        },
        {
          path: 'gestion-grados',
          name: 'Gestión de Grados',
          component: GradeManagement,
          meta: { roles: ['directivo'] }
        },
        {
          path: 'gestion-materias',
          name: 'Gestión de Materias',
          component: SubjectManagement,
          meta: { roles: ['directivo'] }
        },
        {
          path: 'docentes',
          name: 'Gestión de Docentes',
          component: TeacherManagement,
          meta: { roles: ['directivo'] }
        },
        {
          path: 'gestion-estudiantes',
          name: 'Gestión de Estudiantes',
          component: () => import('../views/admin/StudentManagement.vue'),
          meta: { roles: ['directivo'] }
        },
        {
          path: 'configuracion-academica',
          name: 'Configuración Académica',
          component: AcademicSettings,
          meta: { roles: ['directivo'] }
        },
        {
          path: 'configuracion-academica/inscripciones',
          name: 'Fechas de Inscripción',
          component: () => import('../views/admin/AcademicEnrollmentDatesView.vue'),
          meta: { roles: ['directivo'] }
        },
        {
          path: 'mi-colegio',
          name: 'Mi Colegio',
          component: () => import('../views/admin/MySchool.vue'),
          meta: { roles: ['directivo'] }
        },
        {
          path: 'configuracion-academica/competencias',
          name: 'Competencias Académicas',
          component: AcademicCompetenciesView,
          meta: { roles: ['directivo'] }
        },
        {
          path: 'configuracion-academica/cierres',
          name: 'Cierres de Periodo',
          component: () => import('../views/admin/PeriodClosure.vue'),
          meta: { roles: ['directivo'] }
        },
        {
          path: 'configuracion-academica/escalas',
          name: 'Escalas de Valoración',
          component: () => import('../views/admin/AcademicScalesView.vue'),
          meta: { roles: ['directivo'] }
        },
        {
          path: 'configuracion-academica/periodos',
          name: 'Periodos Académicos',
          component: () => import('../views/admin/AcademicPeriodsView.vue'),
          meta: { roles: ['directivo'] }
        },
        {
          path: 'configuracion-academica/reportes-dba',
          name: 'Reportes y Coherencia DBA',
          component: () => import('../views/admin/DbaReportsView.vue'),
          meta: { roles: ['directivo'] }
        },
        {
          path: 'boletines',
          name: 'Generación de Boletines',
          component: BoletinGenerator,
          meta: { roles: ['directivo'] }
        },
        {
          path: 'supervisiones',
          name: 'Supervisiones Externas',
          component: () => import('../views/admin/SupervisionManagement.vue'),
          meta: { roles: ['directivo'] }
        },
        // Rutas del Docente
        {
          path: 'mis-cursos',
          name: 'Mis Cursos',
          component: () => import('../views/teacher/TeacherCourses.vue'),
          meta: { roles: ['docente'] }
        },
        {
          path: 'calificaciones',
          name: 'teacher-grades',
          component: () => import('../views/teacher/TeacherGrades.vue'),
          meta: { roles: ['docente'] }
        },
        {
          path: 'asistencia',
          name: 'Asistencia',
          component: () => import('../views/teacher/TeacherAttendance.vue'),
          meta: { roles: ['docente'] }
        },
        {
          path: 'observador',
          name: 'Observador del Estudiante',
          component: () => import('../views/teacher/TeacherObservations.vue'),
          meta: { roles: ['docente'] }
        },
        {
          path: 'cierre-periodo',
          name: 'Cierre de Periodo',
          component: () => import('../views/teacher/TeacherClosure.vue'),
          meta: { roles: ['docente'] }
        },
        {
          path: 'mis-notas',
          name: 'Mis Notas',
          component: () => import('../views/student/StudentGradesView.vue'),
          meta: { roles: ['estudiante'] }
        },
        {
          path: 'mis-notas/:id_materia/:id_periodo',
          name: 'Detalle de Materia',
          component: () => import('../views/student/SubjectDetailsView.vue'),
          meta: { title: 'Detalle de Materia', roles: ['estudiante'] }
        },
        {
          path: 'mi-asistencia',
          name: 'Mi Asistencia',
          component: () => import('../views/student/StudentAttendanceView.vue'),
          meta: { roles: ['estudiante'] }
        },
        {
          path: 'mi-observacion',
          name: 'student-observations',
          component: () => import('../views/student/StudentObservationsView.vue'),
          meta: { roles: ['estudiante'] }
        },
        {
          path: 'mi-boletin',
          name: 'Mi Boletín',
          component: () => import('../views/student/StudentBoletinView.vue'),
          meta: { roles: ['estudiante'] }
        },
        // Rutas del Padre
        {
          path: 'hijos',
          name: 'Mis Hijos',
          component: () => import('../views/parent/ParentDashboard.vue'),
          meta: { roles: ['padre'] }
        },
        {
          path: 'notas-hijos',
          name: 'Calificaciones de Hijos',
          component: () => import('../views/parent/ParentGradesView.vue'),
          meta: { roles: ['padre'] }
        },
        {
          path: 'boletines-hijos',
          name: 'Boletines de Hijos',
          component: () => import('../views/parent/ParentBoletinView.vue'),
          meta: { roles: ['padre'] }
        },
        {
          path: 'notas-hijos/:id_estudiante/:id_materia/:id_periodo',
          name: 'Detalle de Materia (Hijo)',
          component: () => import('../views/student/SubjectDetailsView.vue'),
          meta: { title: 'Detalle de Calificaciones', roles: ['padre'] }
        },
        {
          path: 'asistencia-hijos',
          name: 'Asistencia de Hijos',
          component: () => import('../views/parent/ParentAttendanceView.vue'),
          meta: { roles: ['padre'] }
        },
        {
          path: 'observaciones-hijos',
          name: 'Observaciones de Hijos',
          component: () => import('../views/parent/ParentObservationsView.vue'),
          meta: { roles: ['padre'] }
        },
        // Rutas del Admin General
        {
          path: 'colegios',
          name: 'Gestión de Colegios',
          component: () => import('../views/adminGeneral/ColegiosList.vue'),
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'usuarios',
          name: 'Gestión de Usuarios',
          component: () => import('../views/adminGeneral/UsuariosList.vue'),
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'supervision/solicitudes',
          name: 'Solicitudes de Supervisión',
          component: () => import('../views/adminGeneral/SupervisionSolicitudes.vue'),
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'supervision/activas',
          name: 'Supervisiones Activas',
          component: () => import('../views/adminGeneral/SupervisionActivas.vue'),
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'supervision/historial',
          name: 'Historial de Supervisiones',
          component: () => import('../views/adminGeneral/SupervisionHistorial.vue'),
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'auditorias/lecturas',
          name: 'Auditoría de Lecturas',
          component: () => import('../views/adminGeneral/AuditoriasList.vue'),
          props: { tipo: 'LECTURA' },
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'auditorias/modificaciones',
          name: 'Auditoría de Modificaciones',
          component: () => import('../views/adminGeneral/AuditoriasList.vue'),
          props: { tipo: 'MODIFICACION' },
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'auditorias/exportaciones',
          name: 'Auditoría de Exportaciones',
          component: () => import('../views/adminGeneral/AuditoriasList.vue'),
          props: { tipo: 'EXPORTACION' },
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'notificaciones',
          name: 'Notificaciones del Sistema',
          component: () => import('../views/adminGeneral/NotificacionesList.vue'),
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'configuracion',
          name: 'Configuración de Plataforma',
          component: () => import('../views/adminGeneral/ConfiguracionPanel.vue'),
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'catalogo-dba',
          name: 'Catálogo DBA',
          component: () => import('../views/adminGeneral/DbaGlobalView.vue'),
          meta: { roles: ['admin_general'] }
        },
        {
          path: 'soporte',
          name: 'support',
          component: () => import('../views/shared/SupportView.vue')
        },
        {
          path: 'directorio',
          name: 'directory',
          component: () => import('../views/shared/DirectoryView.vue')
        },
        {
          path: 'mi-cuenta',
          name: 'my-account',
          component: () => import('../views/shared/ProfileView.vue')
        }
      ]
    }
  ]
})

// La verificación del token se cachea en sessionStorage.
// Se verifica contra el backend una sola vez por sesión del navegador (nueva pestaña/tab = nueva verificación).
// Al hacer logout, sessionStorage._sessionVerified se limpia.

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Rutas públicas: si el usuario ya está autenticado y va al login, redirigir al dashboard
  if (to.path === '/login' && auth.isAuthenticated) {
    return '/dashboard'
  }

  // Rutas protegidas
  if (to.meta.requiresAuth) {
    // Si no hay token local, redirigir inmediatamente al login
    if (!auth.isAuthenticated || !auth.token) {
      auth.logout()
      return '/login'
    }

    // Validar token contra el backend (una vez por sesión de navegador)
    const alreadyVerified = sessionStorage.getItem('_sessionVerified') === 'true'
    if (!alreadyVerified) {
      try {
        const res = await fetch('http://localhost:3000/api/auth/verify', {
          headers: { 'Authorization': `Bearer ${auth.token}` }
        })

        if (!res.ok) {
          // Token inválido, expirado o usuario suspendido → limpiar y redirigir
          console.warn('[Auth Guard] Token inválido. Cerrando sesión local.')
          auth.logout()
          return '/login'
        }

        sessionStorage.setItem('_sessionVerified', 'true')
      } catch (err) {
        // Error de red (backend caído): permitir acceso local pero no re-verificar constantemente
        console.warn('[Auth Guard] No se pudo verificar el token con el servidor:', err)
        sessionStorage.setItem('_sessionVerified', 'true')
      }
    }
  }

  // Verificación de roles
  if (auth.isAuthenticated) {
    const activeRole = auth.activeRole
    const allowedRoles = to.meta.roles as string[] | undefined
    
    if (allowedRoles && !allowedRoles.includes(activeRole || '')) {
      // Redirigir al dashboard home dispatcher si no tiene el rol
      return '/dashboard'
    }
  }
})

export default router

