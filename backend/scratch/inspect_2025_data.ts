import { pool } from '../src/config/db';

async function main() {
  console.log("=== 1. ANIOS LECTIVOS ===");
  const years = await pool.query(`SELECT id_anio, calendario, estado, id_colegio FROM anio_lectivo ORDER BY id_anio`);
  console.table(years.rows);

  console.log("=== 2. DETALLE_GRADOS (CURSOS/ASIGNACIONES) POR AÑO ===");
  const dgCount = await pool.query(`SELECT id_anio, id_colegio, COUNT(*) FROM detalle_grados GROUP BY id_anio, id_colegio ORDER BY id_anio`);
  console.table(dgCount.rows);

  console.log("=== 3. RESULTADO ACADEMICO POR PERIODO ===");
  const raCount = await pool.query(`SELECT ra.id_periodo, pa.nombre as periodo_nombre, pa.id_anio, COUNT(*) 
                                    FROM resultado_academico ra 
                                    JOIN periodo_academico pa ON ra.id_periodo = pa.id_periodo 
                                    GROUP BY ra.id_periodo, pa.nombre, pa.id_anio ORDER BY pa.id_anio, ra.id_periodo`);
  console.table(raCount.rows);

  console.log("=== 4. NOTAS ACTIVIDAD POR PERIODO ===");
  const naCount = await pool.query(`SELECT am.id_periodo, pa.nombre as periodo_nombre, pa.id_anio, COUNT(*) 
                                    FROM notas_actividad na 
                                    JOIN actividad_materia am ON na.id_actividadmateria = am.id_actividadmateria 
                                    JOIN periodo_academico pa ON am.id_periodo = pa.id_periodo 
                                    GROUP BY am.id_periodo, pa.nombre, pa.id_anio ORDER BY pa.id_anio, am.id_periodo`);
  console.table(naCount.rows);

  await pool.end();
}

main().catch(console.error);
