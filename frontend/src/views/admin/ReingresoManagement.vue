<template>
  <div class="min-h-[calc(100vh-4rem)] h-auto lg:h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-3 sm:p-4 flex flex-col gap-3 overflow-y-auto lg:overflow-hidden transition-colors duration-500">
    
    <!-- Top Navigation & Header Bar -->
    <div class="shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md">
      <div class="flex items-center gap-3">
        <button 
          @click="$router.go(-1)" 
          class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
          title="Volver"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 class="text-lg font-black bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-200 bg-clip-text text-transparent flex items-center gap-2">
            <span>🔄 Panel de Gestión de Reingresos</span>
          </h1>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Procesamiento acelerado en 1 sola pantalla sin desplazamientos.
          </p>
        </div>
      </div>

      <!-- Stepper Progress Indicator -->
      <div class="hidden xl:flex items-center gap-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
        <div 
          :class="selectedStudentId ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'"
          class="px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[11px]"
        >
          <span>1. Estudiante</span>
          <span v-if="selectedStudentId">✓</span>
        </div>
        <span class="text-slate-300 dark:text-slate-600">➔</span>
        <div 
          :class="targetForm.id_grupo ? 'bg-emerald-500 text-white shadow-sm' : (selectedStudentId ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500')"
          class="px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[11px]"
        >
          <span>2. Destino</span>
          <span v-if="targetForm.id_grupo">✓</span>
        </div>
        <span class="text-slate-300 dark:text-slate-600">➔</span>
        <div 
          :class="selectedStudentId && targetForm.id_grupo && targetForm.correo_padre && (ticketId || declaracionPresencial) ? 'bg-emerald-600 text-white shadow-md animate-pulse' : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'"
          class="px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[11px]"
        >
          <span>3. Matriz & Enviar</span>
        </div>
      </div>

      <div v-if="ticketId" class="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl shrink-0">
        <span>🎟️ Ticket #{{ ticketId }}</span>
      </div>
    </div>

    <!-- Ticket Context Banner (If opened from ticket) -->
    <div v-if="ticketContext" class="shrink-0 bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 px-4 py-2.5 rounded-2xl space-y-1.5 text-xs">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold flex-wrap">
          <span>📩 Solicitud recibida vía Ticket ({{ ticketContext.correo_remitente }})</span>
          <span v-if="parentPreferredGrade" class="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-900 dark:text-amber-200 font-mono font-black rounded-lg text-[11px]">
            🎯 Grado Pretendido por Acudiente: {{ parentPreferredGrade.nombre }}
          </span>
        </div>
        <span class="px-2 py-0.5 bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono font-bold rounded-lg text-[11px]">
          {{ ticketContext.codigo_ticket || 'TKT-' + ticketContext.id_ticket }}
        </span>
      </div>
      
      <!-- Quick Select Suggested Students -->
      <div v-if="suggestedStudents.length > 0" class="pt-1.5 flex flex-wrap items-center gap-2 border-t border-amber-500/20">
        <span class="font-bold text-amber-700 dark:text-amber-400 text-[11px]">Sugeridos:</span>
        <button 
          v-for="s in suggestedStudents" 
          :key="s.id_estudiante"
          @click="selectSuggestedStudent(s.id_estudiante)"
          class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-sm flex items-center gap-1"
        >
          <span>👤 {{ s.nombre }} {{ s.apellido }}</span>
          <span class="opacity-90">({{ s.estado }})</span>
        </button>
      </div>
    </div>

    <!-- Main 3-Column Zero-Scroll Grid Layout -->
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
      
      <!-- COLUMN 1: Search & Student Expediente (3 cols) -->
      <div class="lg:col-span-3 flex flex-col gap-3 h-full overflow-y-auto pr-0.5">
        
        <!-- Search Card -->
        <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3 shrink-0">
          <h2 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>🔍 1. Seleccionar Estudiante</span>
          </h2>

          <div class="space-y-2">
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="Buscar por nombre o documento..."
              class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-semibold"
            />

            <select 
              v-model="selectedStudentId" 
              @change="loadStudentHistory"
              class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
            >
              <option value="" disabled>-- Selecciona un estudiante --</option>
              <option v-for="s in filteredStudentsList" :key="s.id_estudiante" :value="s.id_estudiante">
                [{{ s.estado }}] {{ s.apellido }}, {{ s.nombre }} ({{ s.documento }})
              </option>
            </select>
          </div>
        </div>

        <!-- Student Profile Summary -->
        <div v-if="student" class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex-1 flex flex-col justify-between space-y-3">
          <div class="space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h2 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">👤 Expediente Alumno</h2>
              <span 
                :class="student.estado === 'RETIRADO' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'" 
                class="px-2.5 py-0.5 text-[10px] font-bold border rounded-lg"
              >
                {{ student.estado }}
              </span>
            </div>

            <div class="space-y-2 text-xs">
              <div>
                <span class="text-slate-400 block text-[10px] font-semibold">Nombre Completo</span>
                <span class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight block">{{ student.nombre }} {{ student.apellido }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span class="text-slate-400 block text-[9px] font-semibold">Documento</span>
                  <span class="text-slate-700 dark:text-slate-300 font-mono font-bold">{{ student.documento }}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[9px] font-semibold">Código</span>
                  <span class="text-slate-700 dark:text-slate-300 font-mono font-bold">{{ student.codigo || 'N/A' }}</span>
                </div>
              </div>

              <div v-if="student.motivo_estado" class="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-900/60">
                <span class="text-[9px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider block mb-0.5">Motivo Retiro</span>
                <p class="text-[11px] font-semibold text-slate-700 dark:text-slate-300 italic">"{{ student.motivo_estado }}"</p>
              </div>

              <div v-if="lastEnrollment" class="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-750 text-[11px]">
                <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mb-0.5">Último Registro Escolar</span>
                <p class="text-slate-700 dark:text-slate-300">
                  Año: <strong>{{ lastEnrollment.anio_lectivo }}</strong> — {{ lastEnrollment.nombre_nivel }}
                </p>
                <p class="text-slate-500 dark:text-slate-400 text-[10px]">Grupo: {{ lastEnrollment.nombre_grupo || 'Sin asignar' }}</p>
              </div>
            </div>
          </div>

          <div v-if="parent" class="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-[11px] shrink-0">
            <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">Acudiente Registrado</span>
            <p class="text-slate-800 dark:text-slate-200 font-bold truncate">{{ parent.nombre }} {{ parent.apellido }}</p>
            <p class="text-slate-500 dark:text-slate-400 font-mono text-[10px] truncate">{{ parent.email }}</p>
          </div>
        </div>

        <div v-else class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center text-slate-400 text-xs flex-1 flex items-center justify-center">
          <span>Selecciona un estudiante para cargar su expediente.</span>
        </div>

      </div>

      <!-- COLUMN 2: Target Configuration (4 cols) -->
      <div class="lg:col-span-4 flex flex-col gap-3 h-full overflow-y-auto pr-0.5">
        <div v-if="student" class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex-1 flex flex-col justify-between space-y-3">
          <div class="space-y-3">
            <div class="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
              <h2 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>🎯 2. Destino Académico</span>
              </h2>
              <span class="text-[10px] font-semibold text-slate-400">Asignación de Salón</span>
            </div>

            <!-- Smart Auto-Suggestion Badge -->
            <div v-if="suggestedGradeInfo && suggestedGradeInfo.grado_nombre" class="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60 text-[11px] space-y-0.5">
              <div class="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                <span>💡 Sugerencia Pedagógica del Sistema:</span>
                <span class="underline font-black">{{ suggestedGradeInfo.grado_nombre }}</span>
              </div>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic">{{ suggestedGradeInfo.motivo }}</p>
            </div>

            <!-- Parent Preferred Grade Badge (If Ticket) -->
            <div v-if="parentPreferredGrade" class="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60 text-[11px] flex items-center justify-between">
              <span class="font-bold text-indigo-700 dark:text-indigo-300">📩 Solicitado por Acudiente:</span>
              <span class="font-mono font-bold text-indigo-800 dark:text-indigo-200 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-md text-[10px]">
                {{ parentPreferredGrade.nombre }}
              </span>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1 text-[11px]">Año Lectivo Activo</label>
                <select v-model="targetForm.id_anio" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 font-bold text-xs">
                  <option v-for="a in academicYears" :key="a.id_anio" :value="a.id_anio">
                    {{ a.anio }} ({{ a.estado }})
                  </option>
                </select>
              </div>

              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1 text-[11px]">Nivel Escolar</label>
                <select v-model="targetForm.id_nivel" @change="onLevelChange" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 font-bold text-xs">
                  <option v-for="n in levels" :key="n.id_nivel" :value="n.id_nivel">
                    {{ n.nombre }}
                  </option>
                </select>
              </div>

              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1 text-[11px]">Grado Destino</label>
                <select v-model="targetForm.id_tipo_grado" @change="onGradeChange" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 font-bold text-xs">
                  <option value="" disabled>-- Selecciona grado --</option>
                  <option v-for="gr in availableGrados" :key="gr.id_tipo_grado" :value="gr.id_tipo_grado">
                    {{ gr.grado_nombre }}
                  </option>
                </select>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="font-bold text-slate-500 dark:text-slate-400 text-[11px]">Grupo / Salón Asignado</label>
                  <span v-if="targetForm.id_grupo" class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200">
                    Capacidad OK
                  </span>
                </div>
                <select v-model="targetForm.id_grupo" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 font-bold text-xs">
                  <option value="" disabled>-- Selecciona grupo --</option>
                  <option v-for="g in availableSections" :key="g.id_grupo" :value="g.id_grupo">
                    {{ g.seccion_nombre }} (Cupos: {{ g.cupos_disponibles }} de {{ g.cupos_totales }})
                  </option>
                </select>
              </div>

              <div class="pt-1">
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1 text-[11px]">Correo Notificación Acudiente</label>
                <input 
                  type="email" 
                  v-model="targetForm.correo_padre" 
                  placeholder="correo@ejemplo.com"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label class="font-bold text-slate-500 dark:text-slate-400 block mb-1 text-[11px]">Observaciones para Acudiente</label>
                <textarea 
                  v-model="targetForm.observaciones" 
                  rows="2"
                  placeholder="Ej: Reingreso autorizado tras comité académico..."
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-slate-800 dark:text-slate-200 font-semibold text-xs resize-none"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center text-slate-400 text-xs flex-1 flex items-center justify-center">
          <span>Selecciona un estudiante para configurar el salón de destino.</span>
        </div>
      </div>

      <!-- COLUMN 3: Document Renewal Matrix & Fixed Action Button (5 cols) -->
      <div class="lg:col-span-5 flex flex-col justify-between h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm overflow-hidden">
        
        <div class="space-y-3 flex-1 flex flex-col min-h-0">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 shrink-0">
            <div>
              <h2 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <span>📋 3. Matriz Documental</span>
              </h2>
              <span class="text-[10px] text-slate-400 font-medium">Requisitos de actualización</span>
            </div>

            <div v-if="documents.length">
              <span class="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-lg">
                {{ validCount }} Vigentes | {{ requiredCount }} Renovación
              </span>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="py-12 text-center text-slate-400 space-y-2 flex-1 flex flex-col items-center justify-center">
            <svg class="animate-spin h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-xs">Evaluando archivos previos...</span>
          </div>

          <div v-else-if="!selectedStudentId" class="flex-1 flex items-center justify-center text-center text-slate-400 text-xs">
            <span>Selecciona un estudiante para evaluar sus documentos.</span>
          </div>

          <!-- Documents Scrollable Matrix List -->
          <div v-else-if="documents.length > 0" class="flex-1 overflow-y-auto pr-1 my-1 space-y-2 text-xs min-h-0">
            <div 
              v-for="doc in documents" 
              :key="doc.tipo_documento"
              class="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-750 flex items-center justify-between gap-3 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div class="space-y-0.5 flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                    {{ formatDocType(doc.tipo_documento) }}
                  </span>
                  <span 
                    :class="getBadgeClass(doc.estado_sugerido)"
                    class="px-2 py-0.5 text-[9px] font-black uppercase border rounded-md shrink-0"
                  >
                    {{ formatBadgeText(doc.estado_sugerido) }}
                  </span>
                </div>
                
                <div class="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                  <span v-if="doc.url && doc.url !== 'PENDIENTE'">
                    Archivo anterior: 
                    <a :href="formatUrl(doc.url)" target="_blank" class="text-indigo-600 dark:text-indigo-400 underline font-bold">Ver Archivo</a>
                  </span>
                  <span v-else class="italic text-slate-400">Sin archivo previo</span>
                </div>
              </div>

              <!-- Action Toggle Buttons -->
              <div class="shrink-0 flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <button 
                  type="button"
                  @click="doc.estado_renovacion = 'VIGENTE'"
                  :class="doc.estado_renovacion === 'VIGENTE' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                  class="px-2.5 py-1 text-[10px] rounded-md transition-all"
                >
                  Vigente
                </button>
                <button 
                  type="button"
                  @click="doc.estado_renovacion = 'RENOVACION_REQUERIDA'"
                  :class="doc.estado_renovacion === 'RENOVACION_REQUERIDA' ? 'bg-amber-500 text-white font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                  class="px-2.5 py-1 text-[10px] rounded-md transition-all"
                >
                  Exigir Renovación
                </button>
              </div>
            </div>
          </div>

          <div v-else class="flex-1 flex items-center justify-center text-center text-slate-400 text-xs">
            <span>No se encontraron tipos de documentos configurados.</span>
          </div>
        </div>

        <!-- Sticky Primary Action Footer Button & Consent Governance Checkbox -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-2.5">
          
          <!-- Presencial Consent Declaration (If processed without a ticket) -->
          <div v-if="!ticketId && selectedStudentId" class="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-900/40 space-y-1">
            <span class="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 block">🛡️ Declaración de Consentimiento Presencial</span>
            <label class="flex items-start gap-2 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-tight">
              <input type="checkbox" v-model="declaracionPresencial" class="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0" />
              <span>Confirmo que el acudiente autorizó presencialmente en secretaría el inicio de este trámite de reingreso.</span>
            </label>
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Configuración completa:</span>
            <span class="font-bold text-slate-700 dark:text-slate-300">
              {{ requiredCount }} doc. exigidos renovar
            </span>
          </div>

          <button 
            @click="submitReingresoLink" 
            :disabled="submitting || !selectedStudentId || !targetForm.id_grupo || !targetForm.correo_padre || (!ticketId && !declaracionPresencial)"
            class="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <svg v-if="submitting" class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ submitting ? 'Enviando Enlace...' : '🚀 Autorizar y Enviar Enlace de Reingreso' }}</span>
          </button>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { useAuthStore } from '../../stores/auth'
import type { SendReingresoPayload } from '../../types/reingreso.types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const ticketId = ref(route.query.ticketId || null)
const selectedStudentId = ref(route.query.studentId ? Number(route.query.studentId) : '')

const allStudents = ref<any[]>([])
const searchQuery = ref('')
const ticketContext = ref<any>(null)
const suggestedStudents = ref<any[]>([])
const suggestedGradeInfo = ref<any>(null)
const parentPreferredGrade = ref<any>(null)
const declaracionPresencial = ref(false)

const student = ref<any>(null)
const lastEnrollment = ref<any>(null)
const parent = ref<any>(null)
const documents = ref<any[]>([])
const levels = ref<any[]>([])
const groups = ref<any[]>([])
const academicYears = ref<any[]>([])

const loading = ref(false)
const submitting = ref(false)

const targetForm = reactive({
  id_anio: '',
  id_nivel: '',
  id_tipo_grado: '',
  id_grupo: '',
  correo_padre: '',
  observaciones: ''
})

const getAuthHeaders = () => {
  const token = auth.token || localStorage.getItem('token')
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
}

const availableGrados = computed(() => {
  const map = new Map()
  groups.value.forEach(g => {
    if (g.id_tipo_grado && !map.has(g.id_tipo_grado)) {
      map.set(g.id_tipo_grado, {
        id_tipo_grado: g.id_tipo_grado,
        grado_nombre: g.grado_nombre
      })
    }
  })
  return Array.from(map.values())
})

const availableSections = computed(() => {
  if (!targetForm.id_tipo_grado) return groups.value
  return groups.value.filter(g => g.id_tipo_grado === targetForm.id_tipo_grado)
})

const onLevelChange = async () => {
  targetForm.id_tipo_grado = ''
  targetForm.id_grupo = ''
  await loadGroups()
}

const onGradeChange = () => {
  targetForm.id_grupo = ''
  const sections = availableSections.value
  if (sections.length > 0) {
    targetForm.id_grupo = sections[0].id_grupo
  }
}

const filteredStudentsList = computed(() => {
  if (!searchQuery.value.trim()) return allStudents.value
  const q = searchQuery.value.toLowerCase()
  return allStudents.value.filter((s: any) => 
    s.nombre.toLowerCase().includes(q) ||
    s.apellido.toLowerCase().includes(q) ||
    s.documento.toLowerCase().includes(q) ||
    (s.codigo && s.codigo.toLowerCase().includes(q))
  )
})

const validCount = computed(() => documents.value.filter((d: any) => d.estado_renovacion === 'VIGENTE').length)
const requiredCount = computed(() => documents.value.filter((d: any) => d.estado_renovacion !== 'VIGENTE').length)

onMounted(async () => {
  await fetchAllStudents()
  await fetchCatalogs()
  if (ticketId.value) {
    await loadTicketContext()
  }
  if (selectedStudentId.value) {
    await loadStudentHistory()
  }
})

const fetchAllStudents = async () => {
  try {
    const res = await axios.get('/api/student/colegio/' + getSchoolId(), getAuthHeaders())
    const all = res.data || []
    allStudents.value = all.filter((s: any) => s.estado === 'RETIRADO')
  } catch (err) {
    console.error('Error cargando estudiantes:', err)
  }
}

const loadTicketContext = async () => {
  if (!ticketId.value) return
  try {
    const res = await axios.get(`/api/reingreso/ticket-context/${ticketId.value}`, getAuthHeaders())
    ticketContext.value = res.data.ticket
    suggestedStudents.value = res.data.suggestedStudents || []
    parentPreferredGrade.value = res.data.gradoPretendido || null
    if (ticketContext.value && ticketContext.value.correo_remitente) {
      targetForm.correo_padre = ticketContext.value.correo_remitente
    }
    if (suggestedStudents.value.length === 1 && !selectedStudentId.value) {
      selectedStudentId.value = Number(suggestedStudents.value[0].id_estudiante)
      await loadStudentHistory()
    }
  } catch (err) {
    console.error('Error cargando contexto del ticket:', err)
  }
}

const selectSuggestedStudent = async (studentId: any) => {
  selectedStudentId.value = Number(studentId)
  await loadStudentHistory()
}

const fetchCatalogs = async () => {
  try {
    const schoolId = getSchoolId()
    const res = await axios.get(`/api/reingreso/catalogs?schoolId=${schoolId}`, getAuthHeaders())
    academicYears.value = res.data.anios || res.data.years || []
    levels.value = res.data.niveles || []
    if (academicYears.value.length > 0) {
      const active = academicYears.value.find((a: any) => a.estado === 'ABIERTO') || academicYears.value[0]
      targetForm.id_anio = active.id_anio
    }
    if (levels.value.length > 0) {
      targetForm.id_nivel = levels.value[0].id_nivel
      await loadGroups()
    }
  } catch (err) {
    console.error('Error cargando catálogos:', err)
  }
}

const loadGroups = async () => {
  if (!targetForm.id_nivel) return
  try {
    const schoolId = getSchoolId()
    const res = await axios.get(`/api/reingreso/groups?nivelId=${targetForm.id_nivel}&schoolId=${schoolId}`, getAuthHeaders())
    groups.value = res.data || []
    if (availableGrados.value.length > 0) {
      if (!targetForm.id_tipo_grado) {
        targetForm.id_tipo_grado = availableGrados.value[0].id_tipo_grado
      }
      onGradeChange()
    }
  } catch (err) {
    console.error('Error cargando grupos:', err)
  }
}

const loadStudentHistory = async () => {
  if (!selectedStudentId.value) return
  loading.value = true
  
  targetForm.correo_padre = ''
  targetForm.observaciones = ''

  try {
    const res = await axios.get(`/api/reingreso/student-history/${selectedStudentId.value}`, getAuthHeaders())
    student.value = res.data.student
    lastEnrollment.value = res.data.lastEnrollment
    parent.value = res.data.parent
    suggestedGradeInfo.value = res.data.suggestedGrade || null
    documents.value = (res.data.documents || []).map((d: any) => {
      const sugerido = d.estado_sugerido || d.estado_renovacion_sugerido || 'VIGENTE'
      const isObligatory = sugerido === 'OBLIGATORIO_ACTUALIZAR' || sugerido === 'DESACTUALIZADO_POR_FECHA'
      return {
        ...d,
        estado_sugerido: sugerido,
        estado_renovacion: isObligatory ? 'RENOVACION_REQUERIDA' : 'VIGENTE'
      }
    })

    if (parent.value && parent.value.email) {
      targetForm.correo_padre = parent.value.email
    } else if (ticketContext.value && ticketContext.value.correo_remitente) {
      targetForm.correo_padre = ticketContext.value.correo_remitente
    }

    const preferredGradeId = parentPreferredGrade.value?.id_tipo_grado || null
    const targetGradeId = preferredGradeId || suggestedGradeInfo.value?.id_tipo_grado || null

    if (suggestedGradeInfo.value?.id_nivel) {
      targetForm.id_nivel = suggestedGradeInfo.value.id_nivel
    } else if (lastEnrollment.value?.id_nivel) {
      targetForm.id_nivel = lastEnrollment.value.id_nivel
    } else if (levels.value.length > 0) {
      targetForm.id_nivel = levels.value[0].id_nivel
    }
    
    await loadGroups()

    if (targetGradeId) {
      const matchGrado = availableGrados.value.find((g: any) => g.id_tipo_grado === targetGradeId)
      if (matchGrado) {
        targetForm.id_tipo_grado = targetGradeId
      } else if (availableGrados.value.length > 0) {
        targetForm.id_tipo_grado = availableGrados.value[0].id_tipo_grado
      }
      onGradeChange()
    } else if (availableGrados.value.length > 0) {
      targetForm.id_tipo_grado = availableGrados.value[0].id_tipo_grado
      onGradeChange()
    }
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al cargar expediente del estudiante')
    student.value = null
  } finally {
    loading.value = false
  }
}

const submitReingresoLink = async () => {
  if (!selectedStudentId.value || !targetForm.id_nivel || !targetForm.id_grupo || !targetForm.correo_padre) {
    alert('Por favor completa todos los campos de configuración obligatorios.')
    return
  }

  if (!ticketId.value && !declaracionPresencial.value) {
    alert('Por gobernanza de consentimiento, debes confirmar la declaración de atención presencial en secretaría para procesar el trámite sin ticket.')
    return
  }

  submitting.value = true
  try {
    const payload: SendReingresoPayload & { declaracion_presencial?: boolean } = {
      id_estudiante: Number(selectedStudentId.value),
      id_nivel: Number(targetForm.id_nivel),
      id_grupo: Number(targetForm.id_grupo),
      id_anio: Number(targetForm.id_anio),
      id_ticket: ticketId.value ? Number(ticketId.value) : null,
      declaracion_presencial: !ticketId.value ? declaracionPresencial.value : false,
      correo_padre: targetForm.correo_padre,
      observaciones: targetForm.observaciones,
      document_config: documents.value.map((d: any) => ({
        tipo_documento: d.tipo_documento,
        estado_renovacion: d.estado_renovacion,
        url: d.url
      }))
    }

    const res = await axios.post('/api/reingreso/send-parent-link', payload, getAuthHeaders())
    alert(res.data.message || 'Enlace de reingreso enviado con éxito.')
    router.push('/dashboard/gestion-matriculas')
  } catch (err: any) {
    alert(err.response?.data?.error || 'Error al enviar enlace de reingreso')
  } finally {
    submitting.value = false
  }
}

const getSchoolId = () => {
  const user = auth.user || JSON.parse(localStorage.getItem('user') || '{}')
  return user.schoolId || 1
}

const formatDocType = (type: string) => {
  if (!type) return 'Documento'
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str: string) => str.toUpperCase())
}

const formatUrl = (target: any) => {
  if (!target || target === 'PENDIENTE') return '#'
  const token = auth.token || localStorage.getItem('token') || ''
  const tokenQuery = token ? `?authToken=${encodeURIComponent(token)}` : ''

  if (typeof target === 'object' && target.id_documento) {
    return `${API_BASE_URL}/api/matriculas/documentos/${target.id_documento}/archivo${tokenQuery}`
  }
  if (typeof target === 'number') {
    return `${API_BASE_URL}/api/matriculas/documentos/${target}/archivo${tokenQuery}`
  }
  if (typeof target === 'string') {
    if (target.startsWith('http')) return target
    const found = documents.value?.find((d: any) => d.url === target)
    if (found && found.id_documento) {
      return `${API_BASE_URL}/api/matriculas/documentos/${found.id_documento}/archivo${tokenQuery}`
    }
    return '#'
  }
  return '#'
}

const getBadgeClass = (state: string) => {
  switch (state) {
    case 'VIGENTE': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'RECOMENDADO_ACTUALIZAR': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
    case 'OBLIGATORIO_ACTUALIZAR': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
    case 'DESACTUALIZADO_POR_FECHA': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
}

const formatBadgeText = (state: string) => {
  switch (state) {
    case 'VIGENTE': return 'Vigente'
    case 'OBLIGATORIO_ACTUALIZAR': return 'Renovación Obligatoria'
    case 'RECOMENDADO_ACTUALIZAR': return 'Renovación Sugerida'
    case 'DESACTUALIZADO_POR_FECHA': return 'Documento Vencido'
    default: return 'Vigente'
  }
}
</script>
