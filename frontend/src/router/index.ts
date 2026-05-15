import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LandingView from '../views/LandingView.vue'
import LoginView from '../views/LoginView.vue'
import EnrollmentView from '../views/EnrollmentView.vue'
import DashboardHome from '../views/DashboardHome.vue'
import EnrollmentManagement from '../views/EnrollmentManagement.vue'
import EnrollmentDetails from '../views/EnrollmentDetails.vue'
import FinalRegistration from '../views/FinalRegistration.vue'
import EnrollmentCorrection from '../views/EnrollmentCorrection.vue'
import DashboardLayout from '../layouts/DashboardLayout.vue'
import StudentParentDashboard from '../views/StudentParentDashboard.vue'

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
      path: '/estudiante/login',
      name: 'student-login',
      component: () => import('../views/StudentLoginView.vue')
    },
    {
      path: '/panel-control',
      name: 'panel-control',
      component: StudentParentDashboard,
      meta: { requiresAuth: true }
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
          component: DashboardHome
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
