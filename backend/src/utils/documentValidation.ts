import { PoolClient } from "pg";

export interface DocumentExclusion {
  excludeEstudianteId?: number | null;
  excludePadreId?: number | null;
  excludeDocenteId?: number | null;
  excludeUsuarioId?: number | null;
}

export interface DocumentValidationResult {
  isValid: boolean;
  error?: string;
  normalizedDocument: string;
}

/**
 * Normaliza un número de documento removiendo espacios y convirtiendo letras a mayúsculas.
 */
export function normalizeDocument(doc: string | number | null | undefined): string {
  if (!doc) return "";
  return String(doc).trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Valida el formato de un número de documento según el tipo de documento.
 * CC (3): Solo números, 6-10 dígitos
 * TI (2): Solo números, 6-11 dígitos
 * RC (1): Solo números, 6-11 dígitos
 * CE (4): Solo números, 1-10 dígitos
 * PEP/PPT (5): Solo números, 1-10 dígitos
 * Pasaporte (6): Alfanumérico, 1-15 caracteres
 */
export function validateDocumentFormatByTipo(
  documentNum: string | number | null | undefined,
  tipoDoc: number | string | null | undefined
): DocumentValidationResult {
  const norm = normalizeDocument(documentNum);
  if (!norm) {
    return { isValid: false, error: "El número de documento de identidad es requerido.", normalizedDocument: "" };
  }

  const strType = String(tipoDoc || "").trim().toLowerCase();
  const numType = Number(tipoDoc);

  // CC: Cédula de Ciudadanía (ID 3 o "cc" o incluye "cédula" / "cedula")
  if (numType === 3 || strType === "3" || strType === "cc" || strType.includes("ciudadan") || (strType.includes("cedula") && !strType.includes("extranj"))) {
    if (!/^\d{6,10}$/.test(norm)) {
      return {
        isValid: false,
        error: `La Cédula de Ciudadanía '${norm}' no es válida: debe contener únicamente números (entre 6 y 10 dígitos).`,
        normalizedDocument: norm
      };
    }
    return { isValid: true, normalizedDocument: norm };
  }

  // TI: Tarjeta de Identidad (ID 2 o "ti" o incluye "tarjeta")
  if (numType === 2 || strType === "2" || strType === "ti" || strType.includes("tarjeta")) {
    if (!/^\d{6,11}$/.test(norm)) {
      return {
        isValid: false,
        error: `La Tarjeta de Identidad '${norm}' no es válida: debe contener únicamente números (entre 6 y 11 dígitos).`,
        normalizedDocument: norm
      };
    }
    return { isValid: true, normalizedDocument: norm };
  }

  // RC: Registro Civil (ID 1 o "rc" o incluye "registro civil")
  if (numType === 1 || strType === "1" || strType === "rc" || strType.includes("registro")) {
    if (!/^\d{6,11}$/.test(norm)) {
      return {
        isValid: false,
        error: `El Registro Civil '${norm}' no es válido: debe contener únicamente números (entre 6 y 11 dígitos).`,
        normalizedDocument: norm
      };
    }
    return { isValid: true, normalizedDocument: norm };
  }

  // CE: Cédula de Extranjería (ID 4 o "ce" o incluye "extranjer")
  if (numType === 4 || strType === "4" || strType === "ce" || strType.includes("extranjer")) {
    if (!/^\d{1,10}$/.test(norm)) {
      return {
        isValid: false,
        error: `La Cédula de Extranjería '${norm}' no es válida: debe contener únicamente números (hasta 10 dígitos).`,
        normalizedDocument: norm
      };
    }
    return { isValid: true, normalizedDocument: norm };
  }

  // PEP / PPT: Permiso de Protección (ID 5 o "pep" / "ppt")
  if (numType === 5 || strType === "5" || strType === "pep" || strType === "ppt" || strType.includes("pep") || strType.includes("ppt")) {
    if (!/^\d{1,10}$/.test(norm)) {
      return {
        isValid: false,
        error: `El documento PEP / PPT '${norm}' no es válido: debe contener únicamente números (hasta 10 dígitos).`,
        normalizedDocument: norm
      };
    }
    return { isValid: true, normalizedDocument: norm };
  }

  // Pasaporte (ID 6 o "pas" / "pasaporte")
  if (numType === 6 || strType === "6" || strType === "pas" || strType.includes("pasaporte")) {
    if (!/^[a-zA-Z0-9]{1,15}$/.test(norm)) {
      return {
        isValid: false,
        error: `El Pasaporte '${norm}' no es válido: debe ser alfanumérico (entre 1 y 15 caracteres, sin espacios ni símbolos).`,
        normalizedDocument: norm
      };
    }
    return { isValid: true, normalizedDocument: norm };
  }

  // Fallback genérico para tipos no especificados
  if (!/^[a-zA-Z0-9]{1,50}$/.test(norm)) {
    return {
      isValid: false,
      error: `El número de documento '${norm}' no es válido: debe contener caracteres alfanuméricos (letras o números, sin guiones ni espacios).`,
      normalizedDocument: norm
    };
  }

  return { isValid: true, normalizedDocument: norm };
}

/**
 * Valida la unicidad absoluta y el formato de un número de documento de identidad en la base de datos (tabla usuario).
 * Lanza un error expresivo si el formato no cumple o si el documento ya se encuentra registrado.
 */
export async function validateDocumentUniqueness(
  client: any,
  documentNum: string,
  entityLabel: string, // ej: "estudiante", "acudiente", "docente"
  exclude?: DocumentExclusion,
  tipoDoc?: number | string | null
): Promise<void> {
  const check = validateDocumentFormatByTipo(documentNum, tipoDoc);
  if (!check.isValid) {
    throw new Error(`Error en documento (${entityLabel}): ${check.error}`);
  }

  const normDoc = check.normalizedDocument;

  let usrQuery = `SELECT id_usuario, nombre, apellido FROM usuario WHERE UPPER(TRIM(documento)) = $1`;
  const usrParams: any[] = [normDoc];

  if (exclude?.excludeUsuarioId) {
    usrQuery += ` AND id_usuario != $2`;
    usrParams.push(exclude.excludeUsuarioId);
  }

  const usrRes = await client.query(usrQuery, usrParams);
  if (usrRes.rows.length > 0) {
    const holder = `${usrRes.rows[0].nombre || ''} ${usrRes.rows[0].apellido || ''}`.trim();
    throw new Error(
      `El número de documento de identidad '${documentNum}' (${entityLabel}) no está permitido: ya se encuentra registrado en la plataforma a nombre de '${holder || 'otro usuario'}'.`
    );
  }
}

/**
 * Convierte cualquier representación de tipo de documento (string como "CC", "TI", "CE", "RC", "PEP", "PASAPORTE", o nombre completo, o número) al ID entero correspondiente en la tabla tipo_documento (1-6).
 */
export function resolveTipoDocumentoId(tipoDoc: number | string | null | undefined): number {
  if (typeof tipoDoc === "number" && tipoDoc >= 1 && tipoDoc <= 6) {
    return tipoDoc;
  }
  const str = String(tipoDoc || "").trim().toLowerCase();
  const num = Number(tipoDoc);
  if (!isNaN(num) && num >= 1 && num <= 6) return num;

  if (str === "rc" || str.includes("registro")) return 1;
  if (str === "ti" || str.includes("tarjeta")) return 2;
  if (str === "cc" || str.includes("ciudadan") || str.includes("cedula")) return 3;
  if (str === "ce" || str.includes("extranjer")) return 4;
  if (str === "pep" || str === "ppt" || str.includes("pep") || str.includes("ppt")) return 5;
  if (str === "pasaporte" || str === "pas" || str.includes("pasaporte")) return 6;

  return 3; // Cédula de Ciudadanía por defecto
}
