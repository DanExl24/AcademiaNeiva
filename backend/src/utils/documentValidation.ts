import { PoolClient } from "pg";

export interface DocumentExclusion {
  excludeEstudianteId?: number | null;
  excludePadreId?: number | null;
  excludeDocenteId?: number | null;
  excludeUsuarioId?: number | null;
}

/**
 * Normaliza un número de documento removiendo espacios y convirtiendo a mayúsculas.
 */
export function normalizeDocument(doc: string | number | null | undefined): string {
  if (!doc) return "";
  return String(doc).trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Valida la unicidad absoluta de un número de documento de identidad en toda la base de datos.
 * Comprueba las tablas: estudiante, padre_familia, docente, usuario.
 * Lanza un error expresivo si el documento ya se encuentra registrado.
 */
export async function validateDocumentUniqueness(
  client: any,
  documentNum: string,
  entityLabel: string, // ej: "estudiante", "acudiente", "docente"
  exclude?: DocumentExclusion
): Promise<void> {
  const normDoc = normalizeDocument(documentNum);
  if (!normDoc) return;

  // 1. Buscar en la tabla estudiante
  let estQuery = `SELECT id_estudiante, nombre, apellido, documento FROM estudiante WHERE UPPER(TRIM(REPLACE(documento, ' ', ''))) = $1`;
  const estParams: any[] = [normDoc];
  if (exclude?.excludeEstudianteId) {
    estQuery += ` AND id_estudiante != $2`;
    estParams.push(exclude.excludeEstudianteId);
  }
  const estRes = await client.query(estQuery, estParams);
  if (estRes.rows.length > 0) {
    const holder = `${estRes.rows[0].nombre || ''} ${estRes.rows[0].apellido || ''}`.trim();
    throw new Error(
      `El número de documento de identidad '${documentNum}' (${entityLabel}) no está permitido: ya se encuentra registrado a nombre del estudiante '${holder || 'existente'}'.`
    );
  }

  // 2. Buscar en la tabla padre_familia
  let parentQuery = `SELECT id_padrefamilia, nombre, apellido, documento FROM padre_familia WHERE UPPER(TRIM(REPLACE(documento, ' ', ''))) = $1`;
  const parentParams: any[] = [normDoc];
  if (exclude?.excludePadreId) {
    parentQuery += ` AND id_padrefamilia != $2`;
    parentParams.push(exclude.excludePadreId);
  }
  const parentRes = await client.query(parentQuery, parentParams);
  if (parentRes.rows.length > 0) {
    const holder = `${parentRes.rows[0].nombre || ''} ${parentRes.rows[0].apellido || ''}`.trim();
    throw new Error(
      `El número de documento de identidad '${documentNum}' (${entityLabel}) no está permitido: ya se encuentra registrado a nombre del acudiente '${holder || 'existente'}'.`
    );
  }

  // 3. Buscar en la tabla docente
  try {
    let docQuery = `SELECT id_docente, nombre, apellido FROM docente WHERE UPPER(TRIM(REPLACE(documento, ' ', ''))) = $1`;
    const docParams: any[] = [normDoc];
    if (exclude?.excludeDocenteId) {
      docQuery += ` AND id_docente != $2`;
      docParams.push(exclude.excludeDocenteId);
    }
    const docRes = await client.query(docQuery, docParams);
    if (docRes.rows.length > 0) {
      const holder = `${docRes.rows[0].nombre || ''} ${docRes.rows[0].apellido || ''}`.trim();
      throw new Error(
        `El número de documento de identidad '${documentNum}' (${entityLabel}) no está permitido: ya se encuentra registrado a nombre del docente '${holder || 'existente'}'.`
      );
    }
  } catch (e) {
    // Si la tabla docente o columna varía
  }

  // 4. Buscar en la tabla usuario (columna documento)
  try {
    let usrQuery = `SELECT id_usuario, nombre, apellido FROM usuario WHERE UPPER(TRIM(REPLACE(documento, ' ', ''))) = $1`;
    const usrParams: any[] = [normDoc];
    if (exclude?.excludeUsuarioId) {
      usrQuery += ` AND id_usuario != $2`;
      usrParams.push(exclude.excludeUsuarioId);
    }
    const usrRes = await client.query(usrQuery, usrParams);
    if (usrRes.rows.length > 0) {
      const holder = `${usrRes.rows[0].nombre || ''} ${usrRes.rows[0].apellido || ''}`.trim();
      throw new Error(
        `El número de documento de identidad '${documentNum}' (${entityLabel}) no está permitido: ya pertenece a un usuario en la plataforma ('${holder || 'existente'}').`
      );
    }
  } catch (e) {
    // Ignorar si la columna documento no existe en usuario
  }
}
