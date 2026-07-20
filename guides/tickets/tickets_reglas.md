RN-001. Estado inicial

Todo ticket nuevo debe crearse con:

Estado = ABIERTO
fecha_escalado TIMESTAMPTZ

¿Por qué?

Porque obtienes el booleano gratis.

NULL

↓

No fue escalado
2026-07-20 08:35

↓

Sí fue escalado

Y además sabes cuándo ocurrió.

Si en algún momento quieres medir cu
RN-002. Estado ABIERTO

Un ticket solo puede permanecer en estado ABIERTO cuando:

no tiene observaciones del colegio o del administrador;
no ha sido escalado.

En cualquier otro caso deberá cambiar automáticamente a EN_PROCESO.

RN-003. Observaciones

Cuando un directivo o administrador agrega la primera observación a un ticket en estado ABIERTO, el sistema deberá cambiar automáticamente el estado a EN_PROCESO.

RN-004. Escalamiento

Cuando un directivo escale un ticket al Administrador General:

fecha_escalado = xxx

y, si el estado era ABIERTO, deberá cambiar automáticamente a:

EN_PROCESO
RN-005. Estado visible al directivo

Cuando un ticket esté escalado:

el directivo no podrá modificar el estado;
el estado se mostrará únicamente como texto;
el botón de escalamiento cambiará su apariencia indicando:
ESCALADO

y permanecerá deshabilitado.

RN-006. Responsabilidad del Administrador General

Solo el Administrador General podrá cambiar el estado de un ticket escalado a:

RESUELTO
CERRADO (si decides implementarlo)
RN-007. Ticket resuelto

Un ticket podrá marcarse como RESUELTO únicamente cuando:

exista al menos una acción administrativa registrada;
el problema reportado haya sido atendido.
RN-008. Reapertura

Si un usuario responde un ticket ya resuelto (si decides permitirlo), el estado volverá automáticamente a:

EN_PROCESO
RN-009. Auditoría

Todo cambio de:

estado;
escalamiento;
modificación de credenciales;

deberá generar automáticamente una observación de auditoría.

RN-010. Inmutabilidad

Las observaciones generadas automáticamente por el sistema no podrán editarse ni eliminarse.

Hay una regla que agregaría

Cuando un ticket es escalado:

escalado = TRUE

No debería poder volver a FALSE.

¿Por qué?

Porque el hecho histórico de que fue escalado no desaparece.

Aunque el administrador lo resuelva.

Sería algo como:

Estado: RESUELTO

Escalado:
✔ Sí

Eso le dice al directivo:

"Este caso sí llegó hasta el Administrador General."

Es información útil.
