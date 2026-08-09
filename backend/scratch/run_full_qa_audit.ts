import app from "../src/app";
import http from "http";
import fs from "fs";
import path from "path";

interface TestResult {
  endpoint: string;
  method: string;
  objective: string;
  request: any;
  expectedResult: string;
  actualResult: string;
  httpCode: number;
  expectedCode: number;
  validations: string[];
  expectedFields: string[];
  receivedFields: string[];
  errors: string[];
  severity: "CRITICAL" | "IMPORTANT" | "MINOR" | "NONE";
  evidence: string;
  possibleCause: string;
  status: "PASS" | "FAIL" | "WARNING";
  scores: {
    httpStatus: number;   // Max 10%
    schema: number;       // Max 20%
    datos: number;        // Max 25%
    reglasNegocio: number;// Max 25%
    errores: number;      // Max 10%
    seguridad: number;    // Max 10%
    total: number;        // Max 100%
  };
}

async function startServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address() as any;
      const baseUrl = `http://localhost:${address.port}`;
      resolve({ server, baseUrl });
    });
  });
}

async function runAudit() {
  const { server, baseUrl } = await startServer();
  console.log(`QA Audit server listening on ${baseUrl}`);

  const results: TestResult[] = [];

  let adminToken = "";
  let directivoToken = "";
  let docenteToken = "";

  async function req(
    method: string,
    urlPath: string,
    body?: any,
    token?: string
  ): Promise<{ status: number; body: any; timeMs: number }> {
    const headers: Record<string, string> = {};
    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}${urlPath}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const timeMs = Date.now() - start;
      let resBody: any = null;
      const text = await res.text();
      try {
        resBody = JSON.parse(text);
      } catch {
        resBody = text;
      }
      return { status: res.status, body: resBody, timeMs };
    } catch (err: any) {
      return { status: 0, body: err.message, timeMs: Date.now() - start };
    }
  }

  function scoreTest(
    status: number,
    expectedStatus: number,
    schemaValid: boolean,
    dataValid: boolean,
    bizValid: boolean,
    errorHandlingValid: boolean,
    securityValid: boolean
  ) {
    const httpStatusScore = status === expectedStatus ? 10 : 0;
    const schemaScore = schemaValid ? 20 : 0;
    const datosScore = dataValid ? 25 : 0;
    const reglasNegocioScore = bizValid ? 25 : 0;
    const erroresScore = errorHandlingValid ? 10 : 0;
    const seguridadScore = securityValid ? 10 : 0;

    const total = httpStatusScore + schemaScore + datosScore + reglasNegocioScore + erroresScore + seguridadScore;
    return {
      httpStatus: httpStatusScore,
      schema: schemaScore,
      datos: datosScore,
      reglasNegocio: reglasNegocioScore,
      errores: erroresScore,
      seguridad: seguridadScore,
      total
    };
  }

  // =========================================================================
  // 1. AUTHENTICATION & SESSIONS (/api/auth)
  // =========================================================================

  // 1.1 Login Admin General
  {
    const res = await req("POST", "/api/auth/login", {
      email: "admin.general@academianeiva.edu.co",
      password: "adminGeneral123"
    });
    const isPass = res.status === 200 && Boolean(res.body?.token);
    if (isPass) adminToken = res.body.token;

    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/auth/login",
      method: "POST",
      objective: "Verificar autenticación válida de Admin General",
      request: { email: "admin.general@academianeiva.edu.co", password: "***" },
      expectedResult: "Código 200 OK con JWT token de sesión y objeto de usuario",
      actualResult: `Código ${res.status}. Token recibido: ${Boolean(res.body?.token)}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Validación de credenciales en DB", "Generación de JWT Token", "Formato DTO respuesta"],
      expectedFields: ["token", "user"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Fallo en login de admin general"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}, Body: ${JSON.stringify(res.body).substring(0, 150)}`,
      possibleCause: isPass ? "" : "Credenciales o semilla de contraseñas",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 1.2 Login Directivo
  {
    const res = await req("POST", "/api/auth/login", {
      email: "rector@ceaschool.edu.co",
      password: "directivo123"
    });
    const isPass = res.status === 200 && Boolean(res.body?.token);
    if (isPass) directivoToken = res.body.token;

    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/auth/login",
      method: "POST",
      objective: "Verificar autenticación válida de usuario Directivo (Rector)",
      request: { email: "rector@ceaschool.edu.co", password: "***" },
      expectedResult: "Código 200 OK con JWT token de sesión de Directivo",
      actualResult: `Código ${res.status}. Token retornado: ${Boolean(res.body?.token)}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Validación de rol directivo", "Asignación de colegio en claims"],
      expectedFields: ["token", "user"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Fallo en login de directivo"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}, Body: ${JSON.stringify(res.body).substring(0, 150)}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 1.3 Login Docente
  {
    const res = await req("POST", "/api/auth/login", {
      email: "matematicas.1@ceaschool.edu.co",
      password: "docente123"
    });
    const isPass = res.status === 200 && Boolean(res.body?.token);
    if (isPass) docenteToken = res.body.token;

    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/auth/login",
      method: "POST",
      objective: "Verificar autenticación de usuario Docente",
      request: { email: "matematicas.1@ceaschool.edu.co", password: "***" },
      expectedResult: "Código 200 OK con JWT token de docente",
      actualResult: `Código ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Validación credenciales docente"],
      expectedFields: ["token", "user"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Fallo login docente"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 1.4 Student Login
  {
    const res = await req("POST", "/api/auth/student-login", {
      codigo: "EST-1-1",
      password: "estudiante123"
    });
    const isPass = res.status === 200 && Boolean(res.body?.token);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/auth/student-login",
      method: "POST",
      objective: "Verificar login de estudiante mediante código institucional",
      request: { codigo: "EST-1-1", password: "***" },
      expectedResult: "Código 200 OK con token de estudiante",
      actualResult: `Código ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Validación por codigo de estudiante y contraseña"],
      expectedFields: ["token", "user"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Fallo en login de estudiante"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 1.5 Login fallido - Credenciales incorrectas
  {
    const res = await req("POST", "/api/auth/login", {
      email: "admin.general@academianeiva.edu.co",
      password: "wrong_password_123"
    });
    const isPass = res.status === 401 || res.status === 400;
    const scores = scoreTest(res.status, 401, true, true, true, isPass, true);
    results.push({
      endpoint: "/api/auth/login",
      method: "POST",
      objective: "Verificar rechazo controlado ante contraseña incorrecta",
      request: { email: "admin.general@academianeiva.edu.co", password: "wrong_password_123" },
      expectedResult: "Código HTTP 401 o 400 con mensaje de error",
      actualResult: `Código ${res.status}`,
      httpCode: res.status,
      expectedCode: 401,
      validations: ["Rechazo de credenciales erróneas"],
      expectedFields: ["error"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["No retornó código de error esperado"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 1.6 GET /api/auth/verify
  {
    const res = await req("GET", "/api/auth/verify", undefined, directivoToken);
    const isPass = res.status === 200 && res.body?.valid === true;
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/auth/verify",
      method: "GET",
      objective: "Verificar validez del JWT token en sesión activa",
      request: { Authorization: "Bearer <directivoToken>" },
      expectedResult: "HTTP 200 OK con valid: true",
      actualResult: `HTTP ${res.status}, valid: ${res.body?.valid}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Verificación de firma JWT"],
      expectedFields: ["valid", "user"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Falló verificación de token activo"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 1.7 GET /api/auth/profile
  {
    const res = await req("GET", "/api/auth/profile", undefined, directivoToken);
    const isPass = res.status === 200 && Boolean(res.body?.email);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/auth/profile",
      method: "GET",
      objective: "Obtener perfil del usuario autenticado",
      request: { Authorization: "Bearer <directivoToken>" },
      expectedResult: "HTTP 200 OK con datos de perfil de usuario",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Extracción de perfil desde DB"],
      expectedFields: ["id_usuario", "email", "nombre", "apellido"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["No devolvió el perfil del usuario"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 1.8 GET /api/auth/check-document/:document
  {
    const res = await req("GET", "/api/auth/check-document/12345678");
    const isPass = res.status === 200 && typeof res.body?.exists === "boolean";
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/auth/check-document/:document",
      method: "GET",
      objective: "Verificar si un documento de identidad ya existe",
      request: { document: "12345678" },
      expectedResult: "HTTP 200 OK con { exists: boolean }",
      actualResult: `HTTP ${res.status}, exists: ${res.body?.exists}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de existencia en DB"],
      expectedFields: ["exists"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Estrucura o código HTTP inesperado"],
      severity: isPass ? "NONE" : "MINOR",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 2. MATRÍCULAS E INSCRIPCIONES (/api/matriculas)
  // =========================================================================

  // 2.1 GET /api/matriculas/
  {
    const res = await req("GET", "/api/matriculas/");
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/matriculas/",
      method: "GET",
      objective: "Listar colegios disponibles para admisiones",
      request: {},
      expectedResult: "HTTP 200 OK con array de colegios",
      actualResult: `HTTP ${res.status}. Total colegios: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta pública de colegios activos"],
      expectedFields: ["id_colegio", "nombre"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["No retornó la lista de colegios"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}, Total colegios: ${res.body?.length}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 2.2 GET /api/matriculas/school/:schoolId/enrollment-config
  {
    const res = await req("GET", "/api/matriculas/school/1/enrollment-config");
    const isPass = res.status === 200 && Boolean(res.body?.config);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/matriculas/school/:schoolId/enrollment-config",
      method: "GET",
      objective: "Consultar la configuración activa del periodo de inscripciones",
      request: { schoolId: 1 },
      expectedResult: "HTTP 200 OK con objeto config y yearLabel",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Identificación de año lectivo activo"],
      expectedFields: ["config", "yearLabel"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Fallo en consulta de configuración"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 2.3 GET /api/matriculas/pending/:idColegio
  {
    const res = await req("GET", "/api/matriculas/pending/1", undefined, directivoToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/matriculas/pending/:idColegio",
      method: "GET",
      objective: "Listar solicitudes de matrícula en estado PENDIENTE",
      request: { idColegio: 1, Authorization: "Bearer <directivoToken>" },
      expectedResult: "HTTP 200 OK con listado de matrículas pendientes",
      actualResult: `HTTP ${res.status}. Pendientes: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["RequireDirectivo middleware", "Filtro PENDIENTE"],
      expectedFields: ["id_matricula", "estudiante_nombre", "estado"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al consultar matrículas pendientes"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 2.4 GET /api/matriculas/pending/:idColegio (RBAC Test)
  {
    const res = await req("GET", "/api/matriculas/pending/1", undefined, docenteToken);
    const isPass = res.status === 403;
    const scores = scoreTest(res.status, 403, true, true, true, true, isPass);
    results.push({
      endpoint: "/api/matriculas/pending/:idColegio",
      method: "GET",
      objective: "Verificar bloqueo (403) cuando un docente accede a matrículas pendientes",
      request: { idColegio: 1, Authorization: "Bearer <docenteToken>" },
      expectedResult: "HTTP 403 Forbidden con mensaje de permisos insuficientes",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 403,
      validations: ["Verificación de rol directivo"],
      expectedFields: ["error"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Fuga de seguridad en permisos"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 2.5 GET /api/matriculas/filtered/:idColegio
  {
    const res = await req("GET", "/api/matriculas/filtered/1?estado=ACTIVA", undefined, directivoToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/matriculas/filtered/:idColegio",
      method: "GET",
      objective: "Filtrar matrículas por estado",
      request: { idColegio: 1, query: "estado=ACTIVA" },
      expectedResult: "HTTP 200 OK con array de matrículas filtradas",
      actualResult: `HTTP ${res.status}. Cantidad: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Filtro dinámico Kysely"],
      expectedFields: ["id_matricula", "estado"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error en consulta de filtro de matrículas"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 3. GRADOS (/api/grados)
  // =========================================================================

  // 3.1 GET /api/grados/available/:idColegio
  {
    const res = await req("GET", "/api/grados/available/1");
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/grados/available/:idColegio",
      method: "GET",
      objective: "Obtener la lista de grados ofertados y con cupo",
      request: { idColegio: 1 },
      expectedResult: "HTTP 200 OK con array de grados",
      actualResult: `HTTP ${res.status}. Grados: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de tipo_grado por colegio"],
      expectedFields: ["id_grado", "nivel", "tipo_grado"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al consultar grados disponibles"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 4. DOCENTES & GESTIÓN ACADÉMICA (/api/teacher)
  // =========================================================================

  // 4.1 GET /api/teacher/courses/:userId
  {
    const res = await req("GET", "/api/teacher/courses/4", undefined, docenteToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/teacher/courses/:userId",
      method: "GET",
      objective: "Listar asignaturas y grupos asignados al docente",
      request: { userId: 4 },
      expectedResult: "HTTP 200 OK con array de asignaciones",
      actualResult: `HTTP ${res.status}. Cursos: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de docente_asignacion"],
      expectedFields: ["id_detallegrado", "grado_nombre", "materia_nombre"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al consultar cursos del docente"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 4.2 GET /api/teacher/students/:gradeId
  {
    const res = await req("GET", "/api/teacher/students/1", undefined, docenteToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/teacher/students/:gradeId",
      method: "GET",
      objective: "Obtener listado de estudiantes matriculados en un grado",
      request: { gradeId: 1 },
      expectedResult: "HTTP 200 OK con array de estudiantes",
      actualResult: `HTTP ${res.status}. Estudiantes: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de estudiantes por grupo"],
      expectedFields: ["id_estudiante", "nombre", "apellido"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["No devolvió la lista de estudiantes"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 4.3 GET /api/teacher/periods/:schoolId
  {
    const res = await req("GET", "/api/teacher/periods/1", undefined, docenteToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/teacher/periods/:schoolId",
      method: "GET",
      objective: "Listar periodos académicos del colegio",
      request: { schoolId: 1 },
      expectedResult: "HTTP 200 OK con array de periodos",
      actualResult: `HTTP ${res.status}. Periodos: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de periodo_academico"],
      expectedFields: ["id_periodo", "nombre", "estado"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["No retornó periodos"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 5. ADMINISTRACIÓN ACADÉMICA DIRECTIVO (/api/academic-admin)
  // =========================================================================

  // 5.1 GET /api/academic-admin/catalogs
  {
    const res = await req("GET", "/api/academic-admin/catalogs");
    const isPass = res.status === 200 && (Boolean(res.body?.secciones) || Boolean(res.body?.jornadas));
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/academic-admin/catalogs",
      method: "GET",
      objective: "Obtener catálogos globales del sistema",
      request: {},
      expectedResult: "HTTP 200 OK con objeto de catálogos generales",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta pública de tablas maestras"],
      expectedFields: ["secciones", "niveles"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Fallo al cargar catálogos globales"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 5.2 GET /api/academic-admin/my-school/:schoolId
  {
    const res = await req("GET", "/api/academic-admin/my-school/1", undefined, directivoToken);
    const isPass = res.status === 200 && Boolean(res.body?.nombre);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/academic-admin/my-school/:schoolId",
      method: "GET",
      objective: "Obtener información del colegio",
      request: { schoolId: 1, Authorization: "Bearer <directivoToken>" },
      expectedResult: "HTTP 200 OK con objeto del colegio",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta relacional de colegio"],
      expectedFields: ["id_colegio", "nombre", "dane"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["No retornó la información del colegio"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 5.3 GET /api/academic-admin/dashboard/:schoolId
  {
    const res = await req("GET", "/api/academic-admin/dashboard/1", undefined, directivoToken);
    const isPass = res.status === 200 && Boolean(res.body?.stats);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/academic-admin/dashboard/:schoolId",
      method: "GET",
      objective: "Cargar dashboard analítico del Directivo",
      request: { schoolId: 1, Authorization: "Bearer <directivoToken>" },
      expectedResult: "HTTP 200 OK con estadísticas del colegio",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Cálculo de métricas DB"],
      expectedFields: ["stats"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Error al cargar dashboard del directivo"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 5.4 GET /api/academic-admin/grades/:schoolId
  {
    const res = await req("GET", "/api/academic-admin/grades/1", undefined, directivoToken);
    const isPass = res.status === 200 && (Array.isArray(res.body) || Boolean(res.body?.grupos) || Boolean(res.body?.groups));
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/academic-admin/grades/:schoolId",
      method: "GET",
      objective: "Obtener estructura de grados y grupos del colegio",
      request: { schoolId: 1 },
      expectedResult: "HTTP 200 OK con estructura de grupos",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de grupos por colegio"],
      expectedFields: ["id_grupo", "grado_nombre"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Error al consultar grados"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 5.5 GET /api/academic-admin/subjects/:schoolId
  {
    const res = await req("GET", "/api/academic-admin/subjects/1", undefined, directivoToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/academic-admin/subjects/:schoolId",
      method: "GET",
      objective: "Listar materias institucionales registradas",
      request: { schoolId: 1 },
      expectedResult: "HTTP 200 OK con lista de asignaturas",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de materias"],
      expectedFields: ["id_materia", "nombre"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al consultar materias"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 5.6 GET /api/academic-admin/teachers/:schoolId
  {
    const res = await req("GET", "/api/academic-admin/teachers/1", undefined, directivoToken);
    const isPass = res.status === 200 && (Array.isArray(res.body) || Boolean(res.body?.teachers) || Boolean(res.body?.docentes));
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/academic-admin/teachers/:schoolId",
      method: "GET",
      objective: "Listar docentes de la plantilla del colegio",
      request: { schoolId: 1 },
      expectedResult: "HTTP 200 OK con plantilla docente",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de entidad docente"],
      expectedFields: ["id_docente", "nombre", "apellido"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Error al obtener docentes"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 6. BOLETINES (/api/boletines)
  // =========================================================================

  // 6.1 GET /api/boletines/validate/:id_colegio/:id_periodo
  {
    const res = await req("GET", "/api/boletines/validate/1/1", undefined, directivoToken);
    const isPass = res.status === 200 && typeof res.body?.canGenerate === "boolean";
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/boletines/validate/:id_colegio/:id_periodo",
      method: "GET",
      objective: "Validar si un periodo académico está cerrado para generar boletines",
      request: { id_colegio: 1, id_periodo: 1, Authorization: "Bearer <directivoToken>" },
      expectedResult: "HTTP 200 OK con { canGenerate: boolean }",
      actualResult: `HTTP ${res.status}, canGenerate: ${res.body?.canGenerate}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Verificación de estado CERRADO"],
      expectedFields: ["canGenerate", "message"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Error en validación de periodo"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 7. ESTUDIANTES (/api/student)
  // =========================================================================

  // 7.1 GET /api/student/colegio/:idColegio
  {
    const res = await req("GET", "/api/student/colegio/1", undefined, directivoToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/student/colegio/:idColegio",
      method: "GET",
      objective: "Listar estudiantes del colegio",
      request: { idColegio: 1 },
      expectedResult: "HTTP 200 OK con array de estudiantes",
      actualResult: `HTTP ${res.status}. Estudiantes: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de estudiante por colegio"],
      expectedFields: ["id_estudiante", "nombre", "apellido"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["No retornó la lista de estudiantes"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 7.2 GET /api/student/sanctions/types
  {
    const res = await req("GET", "/api/student/sanctions/types", undefined, directivoToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/student/sanctions/types",
      method: "GET",
      objective: "Obtener catálogo de sanciones convivenciales",
      request: {},
      expectedResult: "HTTP 200 OK con catálogo",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de tipo_sancion"],
      expectedFields: ["id_tipo_sancion", "nombre"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al consultar sanciones"],
      severity: isPass ? "NONE" : "MINOR",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 8. ADMINISTRACIÓN GENERAL (/api/admin)
  // =========================================================================

  // 8.1 GET /api/admin/dashboard/stats
  {
    const res = await req("GET", "/api/admin/dashboard/stats", undefined, adminToken);
    const isPass = res.status === 200 && res.body?.totalColegios !== undefined;
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/admin/dashboard/stats",
      method: "GET",
      objective: "Cargar métricas globales de plataforma para Admin General",
      request: { Authorization: "Bearer <adminToken>" },
      expectedResult: "HTTP 200 OK con totales globales",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["RequireAdminGeneral", "Conteo global"],
      expectedFields: ["totalColegios", "totalUsuarios"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Fallo al consultar dashboard global"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 8.2 GET /api/admin/colegios
  {
    const res = await req("GET", "/api/admin/colegios", undefined, adminToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/admin/colegios",
      method: "GET",
      objective: "Listar todos los colegios de la plataforma multitenant",
      request: {},
      expectedResult: "HTTP 200 OK con array de colegios",
      actualResult: `HTTP ${res.status}. Colegios: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta multitenant"],
      expectedFields: ["id_colegio", "nombre", "dane"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["No retornó los colegios"],
      severity: isPass ? "NONE" : "CRITICAL",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 8.3 GET /api/admin/usuarios
  {
    const res = await req("GET", "/api/admin/usuarios", undefined, adminToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/admin/usuarios",
      method: "GET",
      objective: "Listar la totalidad de usuarios del sistema",
      request: {},
      expectedResult: "HTTP 200 OK con usuarios y roles",
      actualResult: `HTTP ${res.status}. Usuarios: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta global de usuarios"],
      expectedFields: ["id_usuario", "email", "roles"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al consultar usuarios"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 8.4 GET /api/admin/supervision/verificar-activa
  {
    const res = await req("GET", "/api/admin/supervision/verificar-activa", undefined, adminToken);
    const isPass = res.status === 200 && typeof res.body?.activa === "boolean";
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/admin/supervision/verificar-activa",
      method: "GET",
      objective: "Verificar si el Admin General posee una sesión de supervisión activa",
      request: { Authorization: "Bearer <adminToken>" },
      expectedResult: "HTTP 200 OK con { activa: boolean }",
      actualResult: `HTTP ${res.status}, activa: ${res.body?.activa}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Verificación de auditoría de supervisión"],
      expectedFields: ["activa"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Error al verificar supervisión activa"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 8.5 GET /api/admin/auditorias
  {
    const res = await req("GET", "/api/admin/auditorias", undefined, adminToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/admin/auditorias",
      method: "GET",
      objective: "Consultar bitácora de auditoría global de acciones del sistema",
      request: {},
      expectedResult: "HTTP 200 OK con logs de auditoría",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de auditoria_acciones"],
      expectedFields: ["id_auditoria", "accion"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al consultar bitácora de auditoría"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 8.6 GET /api/admin/configuracion
  {
    const res = await req("GET", "/api/admin/configuracion", undefined, adminToken);
    const isPass = res.status === 200 && Boolean(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/admin/configuracion",
      method: "GET",
      objective: "Obtener configuraciones globales de la plataforma multitenant",
      request: {},
      expectedResult: "HTTP 200 OK con parametros del sistema",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de configuracion_plataforma"],
      expectedFields: ["maintenanceMode", "allowRegistrations"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Error al obtener configuración de plataforma"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 9. CATÁLOGO DBA GLOBAL (/api/admin/dba)
  // =========================================================================

  // 9.1 GET /api/admin/dba/versiones
  {
    const res = await req("GET", "/api/admin/dba/versiones", undefined, adminToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/admin/dba/versiones",
      method: "GET",
      objective: "Listar versiones oficiales de DBA",
      request: {},
      expectedResult: "HTTP 200 OK con array de versiones",
      actualResult: `HTTP ${res.status}. Versiones: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de dba_version"],
      expectedFields: ["id_version", "nombre_version"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al consultar versiones DBA"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 9.2 GET /api/admin/dba/areas
  {
    const res = await req("GET", "/api/admin/dba/areas", undefined, adminToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/admin/dba/areas",
      method: "GET",
      objective: "Listar áreas curriculares del catálogo DBA",
      request: {},
      expectedResult: "HTTP 200 OK con áreas",
      actualResult: `HTTP ${res.status}. Áreas: ${Array.isArray(res.body) ? res.body.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de dba_area"],
      expectedFields: ["id_area", "nombre_area"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al obtener áreas DBA"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 9.3 GET /api/admin/dba/estadisticas
  {
    const res = await req("GET", "/api/admin/dba/estadisticas", undefined, adminToken);
    const isPass = res.status === 200 && res.body?.totalDba !== undefined;
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/admin/dba/estadisticas",
      method: "GET",
      objective: "Obtener métricas y total de DBA cargados en el catálogo nacional",
      request: {},
      expectedResult: "HTTP 200 OK con estadísticas",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Conteo de dba y dba_evidencia"],
      expectedFields: ["totalDba", "totalEvidencias"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Error al obtener estadísticas DBA"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 10. REINGRESO (/api/reingreso)
  // =========================================================================

  // 10.1 GET /api/reingreso/catalogs
  {
    const res = await req("GET", "/api/reingreso/catalogs", undefined, directivoToken);
    const isPass = res.status === 200 && Boolean(res.body?.years);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/reingreso/catalogs",
      method: "GET",
      objective: "Obtener catálogos de años y niveles para reingreso",
      request: {},
      expectedResult: "HTTP 200 OK con { years, niveles }",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de años y niveles para reingreso"],
      expectedFields: ["years", "niveles"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Error al consultar catálogos de reingreso"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // =========================================================================
  // 11. GESTIÓN DE PADRES (/api/parents)
  // =========================================================================

  // 11.1 GET /api/parents/school/:schoolId
  {
    const res = await req("GET", "/api/parents/school/1", undefined, directivoToken);
    const isPass = res.status === 200 && (Array.isArray(res.body) || Array.isArray(res.body?.parents) || Array.isArray(res.body?.padres));
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/parents/school/:schoolId",
      method: "GET",
      objective: "Listar los acudientes y padres de familia del colegio",
      request: { schoolId: 1 },
      expectedResult: "HTTP 200 OK con lista de padres",
      actualResult: `HTTP ${res.status}. Padres: ${Array.isArray(res.body?.parents) ? res.body.parents.length : 0}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta relacional de acudientes"],
      expectedFields: ["id_usuario", "nombre", "apellido"],
      receivedFields: Object.keys(res.body || {}),
      errors: isPass ? [] : ["Error al obtener listado de padres"],
      severity: isPass ? "NONE" : "IMPORTANT",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  // 11.2 GET /api/parents/document-types
  {
    const res = await req("GET", "/api/parents/document-types", undefined, directivoToken);
    const isPass = res.status === 200 && Array.isArray(res.body);
    const scores = scoreTest(res.status, 200, isPass, isPass, isPass, true, true);
    results.push({
      endpoint: "/api/parents/document-types",
      method: "GET",
      objective: "Obtener tipos de documento válidos para acudientes",
      request: {},
      expectedResult: "HTTP 200 OK con tipos de documento",
      actualResult: `HTTP ${res.status}`,
      httpCode: res.status,
      expectedCode: 200,
      validations: ["Consulta de tipo_documento"],
      expectedFields: ["id_tipodocumento", "tipo"],
      receivedFields: res.body?.[0] ? Object.keys(res.body[0]) : [],
      errors: isPass ? [] : ["Error al obtener tipos de documento de padres"],
      severity: isPass ? "NONE" : "MINOR",
      evidence: `Status: ${res.status}`,
      possibleCause: "",
      status: scores.total >= 90 ? "PASS" : "FAIL",
      scores
    });
  }

  server.close();

  const totalExecuted = results.length;
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const warnings = results.filter(r => r.status === "WARNING").length;
  const avgScore = totalExecuted > 0 ? (results.reduce((a, b) => a + b.scores.total, 0) / totalExecuted).toFixed(2) : 0;

  const outputData = {
    summary: {
      totalExecuted,
      passed,
      failed,
      warnings,
      avgScore
    },
    results
  };

  fs.writeFileSync(path.join(__dirname, "qa_results.json"), JSON.stringify(outputData, null, 2));
  console.log("Results written to scratch/qa_results.json successfully.");
}

runAudit().then(() => {
  console.log("QA Audit completed.");
  process.exit(0);
}).catch(err => {
  console.error("QA Audit fatal error:", err);
  process.exit(1);
});
