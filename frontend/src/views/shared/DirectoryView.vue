<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  ChevronDown, 
  BookOpen, 
  HelpCircle 
} from 'lucide-vue-next'

const auth = useAuthStore()
const router = useRouter()

// Directory Contacts
const contacts = ref([
  { area: 'Secretaría Académica', person: 'Lic. Claudia Patricia Restrepo', phone: '+57 312 456 7890', email: 'secretaria@academianeiva.edu.co', detail: 'Gestión de matrículas, constancias y certificados escolares.' },
  { area: 'Coordinación de Convivencia', person: 'Dr. Hernán Ramírez Valderrama', phone: '+57 320 987 6543', email: 'coordinacion@academianeiva.edu.co', detail: 'Seguimiento disciplinario y atención general a acudientes.' },
  { area: 'Orientación Escolar', person: 'Psic. Angela María Soler', phone: '+57 315 222 3344', email: 'orientacion@academianeiva.edu.co', detail: 'Apoyo psico-pedagógico y acompañamiento familiar.' },
  { area: 'Soporte Técnico de Plataforma', person: 'Equipo de Soporte Neiva', phone: '+57 300 900 1010', email: 'soporte@academianeiva.edu.co', detail: 'Inconvenientes con contraseñas, accesos o reportes en la plataforma.' }
])

// FAQ List (Accordion state)
const activeFaqIndex = ref<number | null>(null)
const faqs = ref([
  { 
    question: '¿Cómo puedo agendar una cita con el docente titular?', 
    answer: 'Para solicitar una cita de atención a padres con el docente titular, puedes consultar su información de contacto en el Directorio Institucional de arriba o enviar una solicitud formal a través del correo oficial de Coordinación. Los docentes tienen horarios específicos de atención los días martes y jueves.' 
  },
  { 
    question: '¿Dónde descargo el boletín de calificaciones de mi hijo?', 
    answer: 'Una vez finalizado y cerrado oficialmente el periodo académico por las directivas, el boletín estará habilitado para descarga en formato PDF. Podrás acceder a él ingresando a la sección "Boletines" en tu menú lateral izquierdo del panel de padres.' 
  },
  { 
    question: '¿Cómo justifico la inasistencia de mi hijo a clase?', 
    answer: 'Toda inasistencia debe justificarse dentro de los 3 días hábiles siguientes al suceso. Debes radicar la incapacidad médica o carta de soporte al correo de Coordinación de Convivencia o presentarla de forma física en la ventanilla de Secretaría.' 
  },
  { 
    question: '¿Qué hago si olvidé la contraseña de mi cuenta?', 
    answer: 'En la pantalla de inicio de sesión, haz clic en el enlace "¿Olvidaste tu contraseña?". Ingresa tu correo electrónico registrado y te enviaremos las instrucciones de restablecimiento de contraseña de forma inmediata.' 
  }
])

const toggleFaq = (index: number) => {
  if (activeFaqIndex.value === index) {
    activeFaqIndex.value = null
  } else {
    activeFaqIndex.value = index
  }
}

const goBack = () => {
  if (auth.isAuthenticated) {
    router.push('/dashboard')
  } else {
    router.push('/login')
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 transition-colors duration-500">
    <div class="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl p-8 sm:p-12 relative overflow-hidden transition-all">
      <!-- Back button -->
      <button 
        @click="goBack" 
        class="absolute top-8 left-8 flex items-center gap-2 text-xs font-black text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase tracking-widest"
      >
        <ArrowLeft :size="16" />
        Regresar
      </button>

      <div class="mt-8 space-y-12">
        <!-- Header -->
        <div class="text-center max-w-xl mx-auto space-y-3">
          <div class="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-650 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <BookOpen class="w-8 h-8" />
          </div>
          <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Directorio Institucional</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
            Canales de comunicación oficiales de la institución y Preguntas Frecuentes para acudientes y estudiantes.
          </p>
        </div>

        <!-- Section 1: Contacts Directory Grid -->
        <div class="space-y-6">
          <h2 class="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider ml-1 flex items-center gap-2">
            <Phone class="text-emerald-500" :size="18" />
            Líneas de Atención Directa
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              v-for="(c, idx) in contacts" 
              :key="idx" 
              class="p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-850 rounded-[1.8rem] flex flex-col justify-between space-y-4 hover:shadow-md transition-all duration-300"
            >
              <div>
                <span class="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100/30">
                  {{ c.area }}
                </span>
                <h3 class="font-black text-slate-800 dark:text-slate-200 text-sm mt-3">{{ c.person }}</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold mt-1">{{ c.detail }}</p>
              </div>

              <div class="pt-4 border-t border-slate-100 dark:border-slate-800/60 space-y-2">
                <div class="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-350">
                  <Phone :size="13" class="text-slate-400" />
                  <span>{{ c.phone }}</span>
                </div>
                <div class="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-350">
                  <Mail :size="13" class="text-slate-400" />
                  <a :href="`mailto:${c.email}`" class="hover:text-indigo-500 transition-colors">{{ c.email }}</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Accordion FAQ Section -->
        <div class="space-y-6">
          <h2 class="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider ml-1 flex items-center gap-2">
            <HelpCircle class="text-indigo-500" :size="18" />
            Preguntas Frecuentes
          </h2>
          <div class="space-y-3">
            <div 
              v-for="(faq, idx) in faqs" 
              :key="idx" 
              class="border border-slate-100 dark:border-slate-850 rounded-[1.5rem] overflow-hidden bg-white dark:bg-slate-900 transition-all duration-300"
            >
              <button 
                @click="toggleFaq(idx)" 
                class="w-full flex items-center justify-between p-6 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left transition-colors"
              >
                <span class="font-black text-slate-800 dark:text-slate-200 text-xs sm:text-sm tracking-tight">
                  {{ faq.question }}
                </span>
                <ChevronDown 
                  :size="18" 
                  class="text-slate-400 transform transition-transform duration-300 shrink-0 ml-4"
                  :class="{'rotate-180 text-indigo-500': activeFaqIndex === idx}"
                />
              </button>
              <div 
                v-show="activeFaqIndex === idx" 
                class="p-6 bg-white dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-850 animate-in slide-in-from-top-1 duration-200"
              >
                <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-450 leading-relaxed font-semibold">
                  {{ faq.answer }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: General institutional metadata -->
        <div class="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/30 dark:border-indigo-900 rounded-[2rem] p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6 transition-colors">
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black text-xs uppercase tracking-widest">
              <Clock :size="15" />
              Horario de Atención
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Lunes a Viernes de 7:30 AM a 1:00 PM y de 2:00 PM a 4:30 PM.
            </p>
          </div>
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black text-xs uppercase tracking-widest">
              <MapPin :size="15" />
              Dirección Principal
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Sede Central: Calle 18 # 4 - 55, Neiva, Huila, Colombia.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
