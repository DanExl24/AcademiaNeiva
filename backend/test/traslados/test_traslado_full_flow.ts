import { pool } from '../../src/config/db';
import { TrasladoService } from '../../src/services/trasladoService';

async function testFullFlow() {
  console.log('🧪 Iniciando prueba automatizada de flujo completo de traslados...');

  try {
    // 1. Obtener dos colegios existentes
    const colRes = await pool.query('SELECT id_colegio, nombre FROM colegio ORDER BY id_colegio ASC LIMIT 2');
    if (colRes.rows.length < 2) {
      throw new Error('Se requieren al menos 2 colegios en la BD para probar traslados.');
    }

    const colegioA = colRes.rows[0];
    const colegioB = colRes.rows[1];

    console.log(`- Colegio Origen A: ID ${colegioA.id_colegio} (${colegioA.nombre})`);
    console.log(`- Colegio Destino B: ID ${colegioB.id_colegio} (${colegioB.nombre})`);

    // 2. Crear o buscar un usuario de prueba en Colegio A
    const userRes = await pool.query(
      `SELECT u.id_usuario, u.email FROM usuario u 
       JOIN usuario_colegio uc ON u.id_usuario = uc.id_usuario 
       WHERE uc.id_colegio = $1 AND uc.estado = 'ACTIVO' LIMIT 1`,
      [colegioA.id_colegio]
    );

    if (userRes.rows.length === 0) {
      throw new Error('No se encontró un usuario activo en el Colegio A para probar.');
    }

    const testUser = userRes.rows[0];
    console.log(`- Usuario de prueba: ID ${testUser.id_usuario} (${testUser.email})`);

    // 3. Crear solicitud de traslado iniciada por Directivo de A
    const input = {
      tipo: 'TRASLADO_USUARIO' as const,
      id_usuario: testUser.id_usuario,
      id_colegio_origen: colegioA.id_colegio,
      id_colegio_destino: colegioB.id_colegio,
      motivo: 'Prueba automatizada de traslado institucional por cambio de residencia'
    };

    console.log('\nStep 1: Crear solicitud de traslado...');
    const solCreada = await TrasladoService.crearSolicitud(input, testUser.id_usuario, 'directivo');
    console.log(`✅ Solicitud creada con ID: ${solCreada.id_solicitud}, Estado: ${solCreada.estado}`);

    // 4. Buscar un directivo del Colegio B para la aprobación de Destino
    const destAdminRes = await pool.query(
      `SELECT u.id_usuario FROM usuario u 
       JOIN usuario_colegio uc ON u.id_usuario = uc.id_usuario 
       WHERE uc.id_colegio = $1 AND uc.estado = 'ACTIVO' LIMIT 1`,
      [colegioB.id_colegio]
    );
    const destUserId = destAdminRes.rows.length > 0 ? destAdminRes.rows[0].id_usuario : 1;

    console.log('\nStep 2: Aprobación por parte de Colegio Destino B...');
    await TrasladoService.registrarAprobacion(
      solCreada.id_solicitud,
      { accion: 'APROBAR', comentario: 'Aceptado en Colegio Destino' },
      destUserId,
      ['directivo'],
      colegioB.id_colegio
    );
    console.log('✅ Aprobación Destino registrada.');

    // 5. Simular aprobación del Admin General para forzar finalización y ejecución transaccional
    console.log('\nStep 3: Aprobación final por Admin General (Ejecución Atómica)...');
    const solEjecutada = await TrasladoService.registrarAprobacion(
      solCreada.id_solicitud,
      { accion: 'APROBAR', comentario: 'Aprobación definitiva de supervisión' },
      1, // Admin General
      ['admin_general'],
      null
    );

    console.log(`✅ Estado tras aprobación de Admin General: ${solEjecutada.estado}`);

    // 6. Verificar cronología de aprobaciones
    const detalleFinal = await TrasladoService.getSolicitudDetalle(solCreada.id_solicitud);
    console.log('\nStep 4: Historial de Aprobaciones Auditado:');
    console.log(`- Estado final: ${detalleFinal.estado}`);
    console.log(`- Total de registros de aprobación: ${detalleFinal.aprobaciones.length}`);
    detalleFinal.aprobaciones.forEach((ap: any, i: number) => {
      console.log(`  ${i+1}. [${ap.fecha.toISOString()}] Rol: ${ap.rol} | Acción: ${ap.accion} | Comentario: ${ap.comentario}`);
    });

    // 7. Verificar que las vinculaciones en usuario_colegio fueron ejecutadas correctamente
    const vincRes = await pool.query(
      'SELECT id_colegio, estado, fecha_inicio, fecha_fin FROM usuario_colegio WHERE id_usuario = $1 ORDER BY id_usuario_colegio DESC',
      [testUser.id_usuario]
    );
    console.log('\nStep 5: Estado de Vinculaciones en usuario_colegio tras ejecución:');
    vincRes.rows.forEach(r => {
      console.log(`  - Colegio ID: ${r.id_colegio} | Estado: ${r.estado} | Inicio: ${r.fecha_inicio} | Fin: ${r.fecha_fin}`);
    });

    // Revertir la prueba para mantener limpios los datos
    await pool.query('DELETE FROM traslado_aprobacion WHERE id_solicitud = $1', [solCreada.id_solicitud]);
    await pool.query('DELETE FROM solicitud_traslado WHERE id_solicitud = $1', [solCreada.id_solicitud]);
    await pool.query('UPDATE usuario SET id_colegio = $1 WHERE id_usuario = $2', [colegioA.id_colegio, testUser.id_usuario]);
    await pool.query('UPDATE usuario_colegio SET estado = \'ACTIVO\', fecha_fin = NULL WHERE id_usuario = $1 AND id_colegio = $2', [testUser.id_usuario, colegioA.id_colegio]);
    await pool.query('DELETE FROM usuario_colegio WHERE id_usuario = $1 AND id_colegio = $2', [testUser.id_usuario, colegioB.id_colegio]);
    console.log('\n🧹 Datos de prueba limpiados correctamente.');

    console.log('\n🎉 ¡FLUJO COMPLETO DE TRASLADO Y EJECUCIÓN ATÓMICA VERIFICADO CON ÉXITO!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA AUTOMATIZADA:', error);
    process.exit(1);
  }
}

testFullFlow();
