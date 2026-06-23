import { pool } from "../config/db";
import { AdminGeneralNotificationService } from "./adminGeneralNotificationService";

export class SchedulerService {
  private static intervalId: NodeJS.Timeout | null = null;

  static start() {
    if (this.intervalId) return;

    console.log("⏰ Inicializando planificador de tareas (Scheduler)...");
    
    // Ejecutar inmediatamente al iniciar
    this.runTasks().catch(err => console.error("Error en tareas iniciales del scheduler:", err));

    // Ejecutar cada hora
    this.intervalId = setInterval(async () => {
      try {
        await this.runTasks();
      } catch (error) {
        console.error("Error ejecutando tareas programadas:", error);
      }
    }, 60 * 60 * 1000); // 1 hora
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private static async runTasks() {
    console.log(`[Scheduler] Ejecutando tareas automáticas a las ${new Date().toISOString()}`);
    await this.activatePendingPeriods();
    await this.expireSupervisions();
  }

  /**
   * Tarea 1: Activar periodos académicos PENDIENTES cuya fecha de inicio ya llegó,
   * siempre y cuando el periodo anterior del mismo año esté CERRADO.
   */
  private static async activatePendingPeriods() {
    const client = await pool.connect();
    try {
      // Obtener periodos pendientes con información del año lectivo
      const pendingPeriods = await client.query(
        `SELECT pa.*, al.calendario, al.tipo_calendario
         FROM periodo_academico pa
         JOIN "año_lectivo" al ON pa.id_año = al.id_año
         WHERE pa.estado = 'PENDIENTE'`
      );

      for (const pa of pendingPeriods.rows) {
        if (!pa.mes_inicio || !pa.dia_inicio) continue;

        // Calcular el año correspondiente según calendario Tipo A o Tipo B
        let year: number;
        if (pa.tipo_calendario === 'B' && pa.calendario.includes('-')) {
          const parts = pa.calendario.split('-');
          year = pa.mes_inicio >= 8 ? Number(parts[0]) : Number(parts[1]);
        } else {
          year = Number(pa.calendario.split('-')[0]);
        }

        const startDate = new Date(year, pa.mes_inicio - 1, pa.dia_inicio, 0, 0, 0);
        const now = new Date();

        if (startDate <= now) {
          let canActivate = false;

          if (!pa.trimestre || pa.trimestre === 1) {
            canActivate = true;
          } else {
            // Verificar si el periodo anterior (trimestre - 1) está CERRADO
            const prevRes = await client.query(
              `SELECT estado FROM periodo_academico 
               WHERE id_colegio = $1 AND "id_año" = $2 AND trimestre = $3`,
              [pa.id_colegio, pa.id_año, pa.trimestre - 1]
            );
            if (prevRes.rows.length > 0 && prevRes.rows[0].estado === 'CERRADO') {
              canActivate = true;
            }
          }

          if (canActivate) {
            console.log(`[Scheduler] Activando periodo académico automático: ${pa.nombre} (ID: ${pa.id_periodo}) del colegio ID: ${pa.id_colegio}`);
            
            await client.query('BEGIN');
            
            // 1. Activar este periodo
            await client.query(
              "UPDATE periodo_academico SET estado = 'ABIERTO' WHERE id_periodo = $1",
              [pa.id_periodo]
            );

            // 2. Por seguridad, asegurarse de que otros periodos del mismo año queden como cerrados
            await client.query(
              `UPDATE periodo_academico 
               SET estado = 'CERRADO' 
               WHERE id_colegio = $1 AND "id_año" = $2 AND id_periodo != $3 AND estado = 'ABIERTO'`,
              [pa.id_colegio, pa.id_año, pa.id_periodo]
            );

            await client.query('COMMIT');
          }
        }
      }
    } catch (error) {
      console.error("Error al activar periodos académicos pendientes:", error);
    } finally {
      client.release();
    }
  }

  /**
   * Tarea 2: Terminar (EXPIRAR) supervisiones activas de administrador general que 
   * hayan superado la duración máxima configurada.
   */
  private static async expireSupervisions() {
    const client = await pool.connect();
    try {
      // Consultar supervisiones activas expiradas
      const expiredSupervisions = await client.query(
        `SELECT a.*, c.nombre AS colegio_nombre, u.email AS admin_email, u.nombre AS admin_firstname, u.apellido AS admin_lastname
         FROM auditoria_supervision a
         JOIN colegio c ON c.id_colegio = a.id_colegio
         JOIN usuario u ON u.id_usuario = a.id_admin_general
         WHERE a.estado_supervision = 'ACTIVA' 
           AND a.eliminado = FALSE
           AND a.fecha_entrada + (a.duracion_maxima_minutos || ' minutes')::interval < NOW()`
      );

      for (const aud of expiredSupervisions.rows) {
        console.log(`[Scheduler] Expirando supervisión ID: ${aud.id_auditoria} en el colegio: ${aud.colegio_nombre}`);
        
        await client.query('BEGIN');

        // 1. Cambiar estado a EXPIRADA
        await client.query(
          `UPDATE auditoria_supervision
           SET estado_supervision = 'EXPIRADA',
               fecha_salida = NOW()
           WHERE id_auditoria = $1`,
          [aud.id_auditoria]
        );

        // 2. Contar acciones realizadas durante esta supervisión
        const accionesRes = await client.query(
          'SELECT COUNT(*)::int AS total FROM auditoria_acciones_realizadas WHERE id_auditoria = $1',
          [aud.id_auditoria]
        );
        const totalAcciones = accionesRes.rows[0].total || 0;

        // Calcular duración
        const diffMs = new Date().getTime() - new Date(aud.fecha_entrada).getTime();
        const diffMin = Math.round(diffMs / 60000);
        const duracionStr = diffMin < 60 ? `${diffMin} minutos` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;

        // 3. Obtener directivos activos del colegio para notificarles
        const directivos = await client.query(
          `SELECT d.id, u.email, u.nombre, u.apellido
           FROM directivo d
           JOIN usuario u ON d.id_usuario = u.id_usuario
           WHERE d.id_colegio = $1 AND d.estado = 'ACTIVO'`,
          [aud.id_colegio]
        );

        const adminFullName = `${aud.admin_firstname} ${aud.admin_lastname || ''}`.trim();

        for (const dir of directivos.rows) {
          // Insertar en tabla de notificaciones de supervisión
          await client.query(
            `INSERT INTO notificacion_supervision (id_auditoria, id_directivo, tipo_notificacion, mensaje)
             VALUES ($1, $2, 'SALIDA', $3)`,
            [
              aud.id_auditoria, 
              dir.id, 
              `La supervisión del Admin General ${adminFullName} ha EXPIRADO automáticamente. Duración: ${duracionStr}. Acciones: ${totalAcciones}`
            ]
          );

          // Enviar correo de notificación
          AdminGeneralNotificationService.sendSupervisionFinalizada(
            dir.email,
            `${dir.nombre} ${dir.apellido || ''}`.trim(),
            aud.admin_email,
            aud.colegio_nombre,
            `${duracionStr} (Expiración automática)`,
            totalAcciones
          ).catch(err => console.error(`Error enviando correo de expiración de supervisión al directivo ${dir.email}:`, err));
        }

        await client.query('COMMIT');
      }
    } catch (error) {
      console.error("Error al procesar la expiración de supervisión:", error);
    } finally {
      client.release();
    }
  }
}
