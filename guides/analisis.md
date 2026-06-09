**PROPUESTA 03: SISTEMA DE MATRÍCULA Y SEGUIMIENTO ACADÉMICO PARA
INSTITUCIONES EDUCATIVAS**

**Problema:**

Las instituciones educativas públicas de Neiva realizan el proceso de
matrícula de forma presencial con formularios físicos, lo que genera
largas filas, errores en la digitación de datos, duplicidad de registros
y dificultad para generar reportes académicos. Los docentes no cuentan
con una herramienta digital para registrar calificaciones y hacer
seguimiento al rendimiento estudiantil.

**Descripción General del Sistema:**

El sistema permite llevar un seguimiento académico de una Institución
Educativa de Neiva, facilitando el registro de información estudiantil,
el proceso de matrícula en línea y la generación de reportes académicos
Incluye funcionalidades como el registro de matrícula en línea, registro
de calificaciones por periodo académico, consulta de notas por parte de
padres de familia, generación de boletines y reportes estadísticos de
rendimiento general de los grados. Está Dirigido a Padres de familia,
Docentes y Directivos, con el objetivo de optimizar los procesos
académicos, reducir errores en la digitación de datos y mejorar el
acceso a la información en tiempo real. El sistema se desarrolla
inicialmente para una institución educativa, con posibilidad de escalar
a múltiples instituciones en el futuro.

**Actores del sistema**

- Administradores

- Directivos

- Docentes

- Padres de Familia

- Estudiante

**Requisitos Funcionales**

- RF01: Formulario de matrícula en línea con validación de documentos.
- RF02: Módulo de registro de calificaciones por periodo académico. •

  Calificación - Numero de Ausencias - Escala de Valoración -
  Profesor - Estudiante - Debilidades - Fortalezas - Grado - Jornada -
  Porcentaje periodo - Superación de competencias - Puesto académico -
  Promedio periodo alumno - Nivel de desempe;o (escala valorativa) -
  Firma de rector y titular

- RF03: Generación automática de boletines en formato PDF.

- RF04: Portal para padres de familia con consulta de notas y asistencia

- RF05: Reportes estadísticos de rendimiento por grado, materia y
  periodo

**Reglas de Usuarios / Responsabilidades**

- **Estudiante**
  - consulta de notas por periodo académico

  - Descargar boletines

  - Consultar historial académico

- **Padres de Familia**
  - Consultar notas por periodo académico

  - Consultar asistencias del estudiante

  - Descargar boletines académicos

  - Visualizar observaciones del docente

- **Docentes**
  - Registrar Asistencia Diaria de estudiantes
    - Opción para descargar formato físico de asistencia diaria

  - registrar calificaciones por periodos académicos de los estudiantes

  - Modificar calificaciones (mientras el periodo esté abierto)

  - Cerrar notas del periodo

  - Registrar observaciones (debilidades/fortalezas)

  - Consultar listado de estudiantes por curso

  - Ver historial académico del estudiante (planes de mejoramiento)

- **Directivos**
  - **Gestión Académica**
    - Crear y gestionar grados

    - Definir cupos de grado

    - Configurar
      - Periodos Académicos

      - Escalas de Valoración

  - **Gestión de Usuarios**
    - CRUD docente

    - Asociar Docentes a Diferentes grados y materias

    - Asignar roles y permisos

  - **Gestionar estudiantes**
    - CRUD estudiante

    - Asociar estudiante a un grado

    - Cambiar estudiante de grado

    - Sancionar a un estudiante

    - Expulsar a un estudiante (No eliminarlo de la bd)

    - Estado del estudiante
      - Activo

      - Sancionado

      - Expulsado

      - Retirado

  - **Gestión de Matricula e inscripciones**
    - Rechazar/aceptar solicitudes

    - Configurar fechas de inscripción

    - Validación de Documentos

  - **Reportes**
    - Generación de reportes académicos

    - Consultar estadísticas globales

    - Generar certificados académicos

**Reglas de Negocio**

Nivel Horas diarias Materias diarias recomendadas
Primaria 5-6 4-6
Secundaria 6-7 5-7
Media (10°-11°) 6-8 5-7

Además, desde el punto de vista de la base de datos y la programación del horario, suele ser útil validar que:

Un estudiante no tenga más de 7 bloques académicos al día.

## Sistema multi-colegio

El sistema debe operar bajo arquitectura multi-colegio (multi-tenant)
Toda matrícula debe estar asociada a un id_colegio
El colegio puede ser:
Determinado por landing page (preferido)
Seleccionado manualmente en formulario (fallback)
El sistema debe mostrar confirmación explícita antes de enviar la matrícula indicando la institución seleccionada
No se permite enviar una matrícula sin asociación válida a un colegio activo

El usuario siempre debe saber dónde está matriculando
El sistema nunca debe asumir silenciosamente el colegio sin mostrarlo en UI

Un colegio NO puede usar el sistema sin ser registrado/aprobado
Cada colegio es una unidad independiente de datos (aislamiento total)
Un usuario siempre pertenece a un colegio
El sistema debe resolver datos por id_colegio
La autenticación debe validar contexto de institución antes del login final

**1. Acceso y seguridad**

- El acceso a la información del sistema está restringido según el rol
  del usuario.

- Ningún usuario puede acceder o modificar información de otra
  institución (id_colegio).

- Los usuarios solo pueden interactuar con los datos asociados a su
  colegio.

**2. Gestión académica (docentes)**

- Un docente solo puede registrar información académica de los
  estudiantes asignados a sus materias y grados.

- Un docente no puede modificar calificaciones ni observaciones de
  periodos cerrados.

- Un docente solo puede registrar asistencia y calificaciones en
  periodos académicos activos.

- Un docente no puede cerrar una materia si:
  - Existen actividades sin calificación.

  - La suma de porcentajes de las actividades no es igual a 100%.

- Una vez cerrada una materia:
  - No se permite registrar, modificar ni eliminar calificaciones.

  - No se permite modificar observaciones del estudiante.

**3. Calificaciones y evaluación**

- Las calificaciones deben estar dentro de la escala de valoración
  definida por la institución.

- La suma de los porcentajes de las actividades por materia y periodo
  debe ser igual a 100%.

- El promedio de una materia se calcula como:
  - (Notas × porcentaje de actividad) acumulado.

- El promedio solo puede calcularse si todas las actividades tienen
  calificación registrada.

- Cada materia debe tener al menos una actividad evaluativa registrada.

**4. Periodos académicos**

- Solo se pueden registrar calificaciones y asistencia dentro de
  periodos académicos activos.

- No se permite registrar información fuera del rango temporal del
  periodo académico.

- Un boletín solo puede generarse con periodos académicos cerrados.

**5. Boletines académicos**

- Un boletín solo puede generarse si:
  - Todas las materias del estudiante tienen calificaciones registradas.

  - Todas las materias del periodo están cerradas.

- El boletín refleja únicamente información de periodos cerrados.

- El boletín se genera de forma dinámica a partir de los datos
  registrados en el sistema.

**6. Estado del estudiante**

- Un estudiante debe estar asociado a un grado para registrar asistencia
  y calificaciones.

- Un estudiante en estado:
  - Activo: puede realizar todas las actividades académicas.

  - Sancionado: puede continuar con actividades académicas.

  - Retirado o Expulsado:
    - No puede registrar asistencia.

    - No puede registrar calificaciones.

    - No puede generar nuevas matrículas en el mismo año lectivo.

**7. Asistencia**

- La asistencia debe registrarse diariamente por docente.

- Un estudiante no puede tener múltiples registros de asistencia en el
  mismo día para la misma materia.

- No se puede registrar asistencia fuera del periodo académico activo.

**8. Matrícula**

- Una matrícula solo puede ser creada si no existe otra matrícula activa
  del estudiante en el mismo año lectivo.

- Una matrícula puede estar en estado:
  - Activa

  - Cancelada

  - Trasladada

- Una matrícula cancelada o trasladada no puede volver a estado activo.

- Una matrícula solo puede ser aprobada si:
  - Todos los documentos requeridos están validados.

  - Existe disponibilidad de cupos en el grado.

- El sistema debe actualizar automáticamente los cupos del grado al
  aprobar, cancelar o trasladar una matrícula.

- Un estudiante expulsado o retirado no puede tener una matrícula activa
  en el mismo año lectivo.

**9. Documentos de matrícula**

- Los documentos requeridos dependen del nivel del estudiante.

- Una matrícula no puede ser aprobada si falta algún documento
  obligatorio.

- Cada documento debe tener un estado:
  - Pendiente

  - Validado

  - Rechazado

**10. Padres de familia**

- El rol de padre de familia y estudiante se crea automáticamente al
  aprobar la matrícula.

- Un padre de familia solo puede:
  - Consultar notas del estudiante asociado.

  - Consultar asistencia.

  - Descargar boletines.

  - Ver observaciones académicas.

**11. Estudiantes**

- Un estudiante solo puede:
  - Consultar sus notas por periodo académico.

  - Descargar sus boletines.

  - Consultar su historial académico.

**12. Resultados académicos**

- El resultado académico se genera automáticamente al cerrar una
  materia.

- El resultado académico no puede ser modificado manualmente.

- El estado académico del estudiante (aprobado/reprobado) se determina
  automáticamente según su promedio.

**13. Escala de valoración**

- Los rangos de la escala de valoración no deben solaparse.

- Los valores mínimo y máximo deben ser coherentes y continuos.

**14. Gestión de grados**

- Cada grado debe tener un cupo máximo definido.

- No se pueden aceptar matrículas cuando el cupo del grado esté
  completo.

**Modelo de base de datos**

**Arquitectura del sistema**

🧱 Stack Tecnológico del Sistema

El sistema de matrícula y seguimiento académico se desarrolla bajo una arquitectura desacoplada cliente-servidor, con separación clara entre frontend, backend y persistencia de datos, garantizando escalabilidad, mantenibilidad y modularidad.

🎨 Frontend
Vue.js (con Vite)

Framework progresivo para la construcción de interfaces de usuario.

Permite desarrollo basado en componentes reutilizables.
Arquitectura reactiva para actualización eficiente de vistas.
Integración sencilla con APIs REST.
Compatible con TypeScript para mayor robustez.
Tailwind CSS

Framework de utilidades para estilos.

Diseño rápido mediante clases utilitarias.
Consistencia visual sin depender de CSS complejo.
Facilita creación de interfaces responsivas.

📌 Justificación:
Se prioriza velocidad de desarrollo y claridad visual, manteniendo control total sobre la UI sin depender de frameworks pesados.

⚙️ Backend
Node.js + Express

Entorno de ejecución y framework backend.

Arquitectura basada en APIs REST.
Manejo eficiente de solicitudes concurrentes.
Alta flexibilidad para estructurar lógica de negocio.
TypeScript

Superset de JavaScript con tipado estático.

Reduce errores en tiempo de desarrollo.
Mejora la mantenibilidad del código.
Facilita escalabilidad del sistema.

📌 Justificación:
Se selecciona TypeScript para garantizar robustez en un sistema con múltiples entidades y reglas de negocio complejas.

🗄️ Base de Datos
PostgreSQL

Sistema de gestión de bases de datos relacional.

Soporte avanzado para relaciones complejas.
Integridad referencial mediante claves foráneas.
Escalabilidad para grandes volúmenes de datos.
Alta confiabilidad en entornos productivos.

📌 Justificación:
El sistema académico requiere consistencia de datos (notas, matrículas, periodos), por lo cual una base relacional es indispensable.

**Diagramas**

**Consideraciones Legales**

**Manual Basico**

**Alcances Futuros**
