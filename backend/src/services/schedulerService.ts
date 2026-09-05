import { db } from "../config/kysely";
import { sql } from "kysely";
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
    try {
      // Obtener periodos pendientes con información del año lectivo
      const pendingPeriods = await db
        .selectFrom("periodo_academico as pa")
        .innerJoin("anio_lectivo as al", "pa.id_anio", "al.id_anio")
        .selectAll("pa")
        .select(["al.calendario", "al.tipo_calendario"])
        .where("pa.estado", "=", "PENDIENTE")
        .execute();

      for (const pa of pendingPeriods) {
        if (!pa.mes_inicio || !pa.dia_inicio) continue;

        // Calcular el año correspondiente según calendario Tipo A o Tipo B
        let year: number;
        if (pa.tipo_calendario === 'B' && pa.calendario && pa.calendario.includes('-')) {
          const parts = pa.calendario.split('-');
          year = pa.mes_inicio >= 8 ? Number(parts[0]) : Number(parts[1]);
        } else {
          year = Number((pa.calendario || "").split('-')[0]);
        }

        const startDate = new Date(year, pa.mes_inicio - 1, pa.dia_inicio, 0, 0, 0);
        const now = new Date();

        if (startDate <= now) {
          let canActivate = false;

          if (!pa.trimestre || pa.trimestre === 1) {
            canActivate = true;
          } else {
            // Verificar si el periodo anterior (trimestre - 1) está CERRADO
            const prevRes = await db
              .selectFrom("periodo_academico")
              .select("estado")
              .where("id_colegio", "=", pa.id_colegio)
              .where("id_anio", "=", pa.id_anio)
              .where("trimestre", "=", pa.trimestre - 1)
              .executeTakeFirst();
            if (prevRes?.estado === 'CERRADO') {
              canActivate = true;
            }
          }

          if (canActivate) {
            console.log(`[Scheduler] Activando periodo académico automático: ${pa.nombre} (ID: ${pa.id_periodo}) del colegio ID: ${pa.id_colegio}`);
            
            await db.transaction().execute(async (trx) => {
              // 1. Activar este periodo
              await trx
                .updateTable("periodo_academico")
                .set({ estado: "ABIERTO" })
                .where("id_periodo", "=", pa.id_periodo)
                .execute();

              // 2. Por seguridad, asegurarse de que otros periodos del mismo año queden como cerrados
              await trx
                .updateTable("periodo_academico")
                .set({ estado: "CERRADO" })
                .where("id_colegio", "=", pa.id_colegio)
                .where("id_anio", "=", pa.id_anio)
                .where("id_periodo", "!=", pa.id_periodo)
                .where("estado", "=", "ABIERTO")
                .execute();
            });
          }
        }
      }
    } catch (error) {
      console.error("Error al activar periodos académicos pendientes:", error);
    }
  }

  /**
   * Tarea 2: Terminar (EXPIRAR) supervisiones activas de administrador general que 
   * hayan superado la duración máxima configurada.
   */
  private static async expireSupervisions() {
    try {
      // Consultar supervisiones activas expiradas
      const expiredSupervisions = await db
        .selectFrom("auditoria_supervision as a")
        .innerJoin("colegio as c", "c.id_colegio", "a.id_colegio")
        .innerJoin("usuario as u", "u.id_usuario", "a.id_admin_general")
        .selectAll("a")
        .select([
          "c.nombre as colegio_nombre",
          "u.email as admin_email",
          "u.nombre as admin_firstname",
          "u.apellido as admin_lastname",
        ])
        .where("a.estado_supervision", "=", "ACTIVA")
        .where("a.eliminado", "=", false)
        .where(sql<boolean>`a.fecha_entrada + (a.duracion_maxima_minutos || ' minutes')::interval < NOW()`)
        .execute();

      for (const aud of expiredSupervisions) {
        console.log(`[Scheduler] Expirando supervisión ID: ${aud.id_auditoria} en el colegio: ${aud.colegio_nombre}`);
        
        await db.transaction().execute(async (trx) => {
          // 1. Cambiar estado a EXPIRADA
          await trx
            .updateTable("auditoria_supervision")
            .set({
              estado_supervision: "EXPIRADA",
              fecha_salida: sql`NOW()`,
            })
            .where("id_auditoria", "=", aud.id_auditoria)
            .execute();

          // 2. Contar acciones realizadas durante esta supervisión
          const accionesRes = await trx
            .selectFrom("auditoria_acciones_realizadas")
            .select((eb) => eb.fn.count("id_accion").as("total"))
            .where("id_auditoria", "=", aud.id_auditoria)
            .executeTakeFirst();
          const totalAcciones = Number(accionesRes?.total || 0);

          // Calcular duración
          const entryDate = aud.fecha_entrada ? new Date(aud.fecha_entrada) : new Date();
          const diffMs = new Date().getTime() - entryDate.getTime();
          const diffMin = Math.round(diffMs / 60000);
          const duracionStr = diffMin < 60 ? `${diffMin} minutos` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;

          // 3. Obtener directivos activos del colegio para notificarles
          const directivos = await trx
            .selectFrom("directivo as d")
            .innerJoin("usuario as u", "d.id_usuario", "u.id_usuario")
            .select(["d.id", "u.email", "u.nombre", "u.apellido"])
            .where("d.id_colegio", "=", aud.id_colegio)
            .where("d.estado", "=", "ACTIVO")
            .execute();

          const adminFullName = `${aud.admin_firstname} ${aud.admin_lastname || ''}`.trim();

          for (const dir of directivos) {
            // Insertar en tabla de notificaciones de supervisión
            await trx
              .insertInto("notificacion_supervision")
              .values({
                id_auditoria: aud.id_auditoria,
                id_directivo: dir.id,
                tipo_notificacion: "SALIDA",
                mensaje: `La supervisión del Admin General ${adminFullName} ha EXPIRADO automáticamente. Duración: ${duracionStr}. Acciones: ${totalAcciones}`,
              })
              .execute();

            // Enviar correo de notificación
            if (dir.email) {
              AdminGeneralNotificationService.sendSupervisionFinalizada(
                dir.email,
                `${dir.nombre} ${dir.apellido || ''}`.trim(),
                aud.admin_email || "",
                aud.colegio_nombre || "",
                `${duracionStr} (Expiración automática)`,
                totalAcciones
              ).catch(err => console.error(`Error enviando correo de expiración de supervisión al directivo ${dir.email}:`, err));
            }
          }
        });
      }
    } catch (error) {
      console.error("Error al procesar la expiración de supervisión:", error);
    }
  }
}
