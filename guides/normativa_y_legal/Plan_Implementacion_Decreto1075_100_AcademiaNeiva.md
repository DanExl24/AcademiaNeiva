# Plan de Implementación: Cumplimiento 100% del Decreto 1075 de 2015 y Resolución 7797 de 2015 en AcademiaNeiva

Este documento establece el plan técnico y arquitectónico detallado para subsanar las discordancias y brechas funcionales identificadas en el reporte de auditoría técnico-legal. Al ejecutar este plan, **AcademiaNeiva** alcanzará un cumplimiento normativo del 100% frente a la legislación educativa de Colombia.

---

## 1. Alcance de las Nuevas Funcionalidades

1. **Informes Parciales de Evaluación por Traslado (Art. 2.3.3.3.3.17):** Habilitar la expedición de boletines/informes parciales acumulados a la fecha del retiro para estudiantes con traslado activo o matrícula cancelada, omitiendo el bloqueo de periodo no cerrado.
2. **Módulo de Constancias y Certificados Oficiales (Art. 2.3.3.3.3.17):** Creación de una arquitectura de emisión de certificados oficiales de desempeño escolar y escolaridad con token único de verificación y validador público QR.
3. **Registro Escolar Folio / Hoja de Vida Académica Unificada (Art. 2.3.3.3.3.16):** Vista y reporte que consolida cronológicamente todas las matrículas, cierres de año, novedades y observaciones del estudiante desde su ingreso.
4. **Parametrización Institucional del SIEE:** Centralización de las reglas de promoción (límites de inasistencia y materias perdidas) en `configuracion_colegio`.
5. **Caracterización SIMAT y Exportador Masivo (Resolución 7797 de 2015):** Campos de víctimas del conflicto, etnia y zona de residencia en `estudiante` con exportación en formato oficial SIMAT (CSV).

---

## 2. Cambios en la Base de Datos (`PostgreSQL` & `Kysely`)

### **Migración `044_decreto1075_compliance.sql`**

```sql
-- 1. Enum para tipos de certificados
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_certificado_enum') THEN
        CREATE TYPE public.tipo_certificado_enum AS ENUM (
            'DESEMPENO',
            'ESCOLARIDAD',
            'INFORME_PARCIAL_TRASLADO',
            'HOJA_DE_VIDA'
        );
    END IF;
END $$;

-- 2. Tabla para trazabilidad y verificación de certificados oficiales
CREATE TABLE IF NOT EXISTS public.certificados_expedidos (
    id_certificado SERIAL PRIMARY KEY,
    token_verificacion VARCHAR(64) NOT NULL UNIQUE,
    id_estudiante INTEGER NOT NULL REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE,
    id_colegio INTEGER NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE,
    id_anio INTEGER NOT NULL REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE,
    tipo_certificado public.tipo_certificado_enum NOT NULL,
    id_usuario_expide INTEGER NOT NULL REFERENCES public.usuario(id_usuario),
    fecha_expedicion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    detalles_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_certificados_token ON public.certificados_expedidos(token_verificacion);
CREATE INDEX IF NOT EXISTS idx_certificados_estudiante ON public.certificados_expedidos(id_estudiante, id_colegio);

-- 3. Campos SIMAT en la tabla estudiante
ALTER TABLE public.estudiante 
ADD COLUMN IF NOT EXISTS victima_conflicto BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS etnia_comunidad VARCHAR(100) DEFAULT 'NINGUNA',
ADD COLUMN IF NOT EXISTS zona_residencia VARCHAR(20) DEFAULT 'URBANA';
```

---

## 3. Arquitectura Backend (Node.js / Express / Kysely)

1. **`certificateController.ts` & `certificateService.ts`**:
   * Endpoint `POST /api/certificados/generar`: Recibe la solicitud de expedición, calcula las notas requeridas, inserta en `certificados_expedidos` y genera el payload firmado.
   * Endpoint `GET /api/certificados/public/verificar/:token`: Endpoint público (sin middleware de auth) que consulta el token y devuelve los datos validados del certificado para consulta de terceros.
2. **`boletinController.ts`**:
   * Ajuste de regla en `getStudentBoletin`:
     ```typescript
     const isTransferOrCancelled = studentInfo.matricula_estado === 'CANCELADO' || studentInfo.matricula_estado === 'TRASLADO';
     if (!isTransferOrCancelled && periodoDetails.estado !== 'CERRADO') {
       return res.status(400).json({ error: 'El periodo académico debe estar cerrado para generar boletines regulares.' });
     }
     ```
3. **`studentRecordController.ts`**:
   * Endpoint `GET /api/estudiantes/:id_estudiante/hoja-de-vida-historica`: Genera el objeto consolidado con el árbol de matrículas, cierres por año, decisiones de promoción y faltas registradas.
4. **`matriculaController.ts`**:
   * Endpoint `GET /api/matricula/exportar-simat`: Genera y descarga el archivo CSV formateado según la estructura del Anexo de Cobertura de la Res. 7797/2015.

---

## 4. Arquitectura Frontend (Vue.js 3 / Pinia / TailWind/CSS)

1. **`CertificadosView.vue`**: Interfaz donde administrativos y padres pueden seleccionar el año lectivo y descargar la **Constancia Oficial de Desempeño**, **Certificado de Escolaridad** o **Informe Parcial de Traslado** formateados para impresión física o PDF con sello digital y código QR.
2. **`PublicCertificateVerification.vue`**: Vista accesible públicamente para validar códigos QR o tokens de certificados expedidos por el colegio.
3. **`StudentLifeSheetModal.vue`**: Componente visual para explorar y descargar la Hoja de Vida Escolar Foliada.
4. **`EnrollmentAdminView.vue`**: Incorpora el botón "Exportar Cobertura SIMAT (Res. 7797)".
5. **`SchoolConfig.vue`**: Pestaña para ajustar la configuración del SIEE (máximos de inasistencia y asignaturas perdidas para alertas automáticas).

---

## 5. Diagrama de Relaciones e Integración del Nuevo Flujo

```text
                               NUEVO FLUJO DE CERTIFICADOS Y SIMAT
                                
  ┌────────────────────────────────┐            ┌────────────────────────────────┐
  │     [Solicitud de Traslado]    │            │     [Matrícula Estudiante]     │
  └───────────────┬────────────────┘            └───────────────┬────────────────┘
                  │                                             │ (Campos SIMAT)
                  ▼                                             ▼
  ┌────────────────────────────────┐            ┌────────────────────────────────┐
  │   [Informe Parcial Habilitado] │            │  [exportar-simat (Res. 7797)]  │
  └───────────────┬────────────────┘            └────────────────────────────────┘
                  │
                  ▼
  ┌────────────────────────────────┐            ┌────────────────────────────────┐
  │   [certificados_expedidos]     │ ─────────► │ [Public Token / QR Verifier]   │
  │    (Token Único / Hash UUID)   │            │   /verificar-certificado/:token│
  └────────────────────────────────┘            └────────────────────────────────┘
```

---

## 6. Plan de Verificación y Pruebas

* **Prueba de Generación de Informe Parcial:** Retirar formalmente a un estudiante de prueba en medio de un período abierto y solicitar su informe parcial. Verificar que se emita correctamente con las calificaciones acumuladas hasta la fecha.
* **Prueba de Certificado y Código QR:** Expedir una Constancia de Desempeño Escolar, copiar el token generado y abrir el enlace de verificación pública. Confirmar que muestre la autenticidad y datos exactos de la institución.
* **Prueba de Folio Escolar:** Consultar la Hoja de Vida Histórica de un estudiante matriculado durante más de 2 años y verificar la continuidad de los registros de promoción.
* **Prueba de Exportador SIMAT:** Generar el reporte masivo de matrícula y auditar que las columnas de víctimas del conflicto, etnia y grupo poblacional coincidan con la especificación de la Resolución 7797 de 2015.
