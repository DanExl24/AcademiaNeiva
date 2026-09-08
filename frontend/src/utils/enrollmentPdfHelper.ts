import html2pdf from 'html2pdf.js'
import { enrollmentService } from '../services/enrollmentService'

export interface GeneratePdfOptions {
  notify?: {
    addNotification: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void
  }
}

export const exportEnrollmentToPDF = async (matriculaInput: any, options?: GeneratePdfOptions): Promise<boolean> => {
  if (!matriculaInput) return false

  const notify = options?.notify
  notify?.addNotification('Generando ficha PDF de matrícula...', 'info')

  let mat = matriculaInput
  // Si falta información detallada (ej. si proviene del listado de gestión), obtenerla del backend
  if (!mat.school_name || !mat.parent_firstname || mat.student_firstname === undefined) {
    try {
      const details = await enrollmentService.getDetails(mat.id_matricula)
      if (details) {
        mat = { ...mat, ...details }
      }
    } catch (e) {
      console.warn('No se pudieron obtener detalles adicionales para el PDF, usando datos existentes:', e)
    }
  }

  const documentLabels: Record<string, string> = {
    registroCivil: 'Registro Civil de Nacimiento',
    documentoIdentidad: 'Doc. Identidad Estudiante',
    documentoPadre: 'Doc. Identidad Acudiente',
    vacunas: 'Carnet de Vacunación',
    salud: 'Certificado EPS / Salud',
    foto: 'Foto Tamaño Documento',
    visa: 'Visa / Permiso de Permanencia',
    reciboPublico: 'Recibo Servicio Público',
    certificadoDiscapacidad: 'Certificado Discapacidad',
    certificadosEscolaridad: 'Certificado Escolaridad Previa',
  }

  // Crear contenedor seguro fuera de pantalla
  const container = document.createElement('div')
  container.id = `temp-pdf-container-${Date.now()}`
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.width = '816px'
  container.style.backgroundColor = '#ffffff'
  container.style.color = '#0f172a'
  container.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif"
  container.style.zIndex = '-9999'

  const schoolName = mat.school_name || 'COLEGIO ACADEMIANEIVA'
  const studentFullname = `${mat.student_firstname || ''} ${mat.student_lastname || ''}`.trim() || 'Estudiante Sin Asignar'
  const parentFullname = `${mat.parent_firstname || ''} ${mat.parent_lastname || ''}`.trim() || 'Acudiente'
  const formattedToday = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const studentCode = mat.student_code || `MAT-${mat.id_matricula}`

  const docsHtml = (mat.documentos && mat.documentos.length > 0)
    ? mat.documentos.map((d: any) => `
        <div style="font-size: 11px; display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="color: ${d.estado === 'VALIDADO' ? '#10b981' : (d.estado === 'RECHAZADO' ? '#ef4444' : '#f59e0b')}; font-weight: 900; font-size: 13px;">✔</span>
          <span style="font-weight: 700; color: #334155;">${documentLabels[d.tipo_documento] || d.tipo_documento}</span>
          <span style="color: #64748b; font-size: 9px; font-style: italic;">(${d.estado || 'PENDIENTE'})</span>
        </div>
      `).join('')
    : `<p style="font-size: 11px; color: #64748b; font-style: italic; margin: 0;">Expediente con documentación digital validada institucionalmente.</p>`

  container.innerHTML = `
    <div style="width: 816px; padding: 40px; background-color: #ffffff; color: #0f172a; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #cbd5e1; padding-bottom: 20px; margin-bottom: 24px;">
        <div style="width: 100px; height: 80px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          ${mat.escudo_url 
            ? `<img src="${mat.escudo_url}" crossorigin="anonymous" style="max-width: 100px; max-height: 80px; object-fit: contain;" />`
            : `<div style="width: 80px; height: 80px; background: #f1f5f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 32px;">🏫</div>`
          }
        </div>
        <div style="text-align: center; flex: 1; padding: 0 16px;">
          <h1 style="font-size: 20px; font-weight: 900; text-transform: uppercase; color: #1e1b4b; margin: 0; letter-spacing: -0.02em;">${schoolName}</h1>
          <p style="font-size: 11px; font-weight: 800; color: #4f46e5; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.12em;">Ficha Oficial de Matrícula Académica</p>
          <p style="font-size: 10px; font-weight: 500; color: #64748b; margin: 3px 0 0 0;">Matrícula #${mat.id_matricula} | Año Lectivo: ${mat.anio_lectivo || new Date().getFullYear()} | Fecha: ${formattedToday}</p>
        </div>
        <div style="width: 80px; height: 80px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 36px; color: #4f46e5;">
          🎓
        </div>
      </div>

      <!-- General Grid -->
      <div style="display: flex; gap: 16px; margin-bottom: 24px;">
        <!-- Student Information Card -->
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background-color: #f8fafc;">
          <h3 style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #4338ca; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; letter-spacing: 0.05em;">Datos del Estudiante</h3>
          <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
            <tbody>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0; width: 45%;">Nombres:</td><td style="font-weight: 800; color: #0f172a; padding: 4px 0;">${mat.student_firstname || '—'}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Apellidos:</td><td style="font-weight: 800; color: #0f172a; padding: 4px 0;">${mat.student_lastname || '—'}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Documento:</td><td style="font-weight: 700; color: #334155; padding: 4px 0;">${mat.student_document || '—'}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Código Portal:</td><td style="font-weight: 800; color: #4338ca; padding: 4px 0; font-family: monospace;">${studentCode}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Nivel / Grado:</td><td style="font-weight: 700; color: #334155; padding: 4px 0;">${mat.grado_nivel || mat.tipo_grado || '—'}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Curso Sección:</td><td style="font-weight: 800; color: #0f172a; padding: 4px 0;">${mat.tipo_grado || ''} ${mat.seccion ? `(${mat.seccion})` : ''}</td></tr>
              <tr><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Jornada:</td><td style="font-weight: 800; color: #4338ca; padding: 4px 0; text-transform: uppercase;">${mat.jornada || 'Única'}</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Parent Information Card -->
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; background-color: #f8fafc;">
          <h3 style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #b45309; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; letter-spacing: 0.05em;">Datos del Acudiente</h3>
          <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
            <tbody>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0; width: 45%;">Nombres:</td><td style="font-weight: 800; color: #0f172a; padding: 4px 0;">${mat.parent_firstname || '—'}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Apellidos:</td><td style="font-weight: 800; color: #0f172a; padding: 4px 0;">${mat.parent_lastname || '—'}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Identificación:</td><td style="font-weight: 700; color: #334155; padding: 4px 0;">${mat.parent_document || '—'}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Correo Electrónico:</td><td style="font-weight: 700; color: #4338ca; padding: 4px 0; word-break: break-all;">${mat.correo_padre || '—'}</td></tr>
              <tr><td style="font-weight: 700; color: #64748b; padding: 4px 0;">Teléfono / Celular:</td><td style="font-weight: 700; color: #334155; padding: 4px 0;">${mat.parent_telefono || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Status & Documentation Summary -->
      <div style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; margin-bottom: 28px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <h3 style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #334155; margin: 0; letter-spacing: 0.05em;">Documentación Verificada</h3>
          <span style="font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; text-transform: uppercase;">
            Estado: ${mat.estado || 'ACTIVA'}
          </span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          ${docsHtml}
        </div>
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; margin-top: 50px; padding: 0 20px;">
        <div style="text-align: center; width: 260px;">
          <div style="border-bottom: 1px solid #94a3b8; height: 1px; margin-bottom: 8px;"></div>
          <p style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">${parentFullname}</p>
          <p style="font-size: 9px; font-weight: 600; color: #64748b; margin: 2px 0 0 0;">Firma del Acudiente Responsable</p>
          <p style="font-size: 8px; font-weight: 500; color: #94a3b8; margin: 2px 0 0 0;">Documento: ${mat.parent_document || '—'}</p>
        </div>
        
        <div style="text-align: center; width: 260px;">
          <div style="border-bottom: 1px solid #94a3b8; height: 1px; margin-bottom: 8px;"></div>
          <p style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">Secretaría / Rectoría</p>
          <p style="font-size: 9px; font-weight: 600; color: #64748b; margin: 2px 0 0 0;">Firma y Sello de Aprobación Institucional</p>
          <p style="font-size: 8px; font-weight: 500; color: #94a3b8; margin: 2px 0 0 0;">${schoolName}</p>
        </div>
      </div>
    </div>
  `

  document.body.appendChild(container)

  try {
    const cleanStudentName = studentFullname.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `ficha_matricula_${cleanStudentName}_#${mat.id_matricula}.pdf`

    const opt = {
      margin: 0.3,
      filename: fileName,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 816
      },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    }

    await html2pdf().set(opt).from((container.firstElementChild as HTMLElement) || container).save()
    notify?.addNotification('Ficha de matrícula descargada exitosamente.', 'success')
    return true
  } catch (err) {
    console.error('Error al generar PDF de matrícula:', err)
    notify?.addNotification('Error al generar el archivo PDF de la matrícula.', 'error')
    return false
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container)
    }
  }
}
