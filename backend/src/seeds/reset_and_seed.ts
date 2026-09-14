import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { Kysely, Transaction, sql } from "kysely";
import { db } from "../config/kysely";
import { DB } from "../types/db.types";

export type DBClient = Kysely<DB> | Transaction<DB>;

// ─── TYPES ───────────────────────────────────────────────────────────────────

type SchoolSeed = {
  id: number;
  nombre: string;
  tipo: string;
  sede: string;
  contacto: number;
  correo: string;
  dane: string;
  domain: string;
  tipo_calendario: "A" | "B";
};

type TeacherSeed = {
  firstName: string;
  lastName: string;
  subject: string;
};

type CredentialEntry = {
  colegio: string;
  seccion: "staff" | "familia" | "general";
  rol: string;
  nombre: string;
  correo: string;
  password: string;
  materia?: string;
  codigo?: string;
  hijos?: string[];
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DOCUMENT_TYPE_CC = 3;
const CURRENT_YEAR = "2025";
const DIRECTIVO_PASSWORD = "directivo123";
const DOCENTE_PASSWORD = "docente123";
const CUPOS_POR_CURSO = 30;
const STUDENTS_PER_GROUP = 5;

// ─── SCHOOL DEFINITIONS ───────────────────────────────────────────────────────

const schools: SchoolSeed[] = [
  { id: 1, nombre: "CEA School Empresarial de los Andes", tipo: "Privado", sede: "Sede Principal", contacto: 3183118044, correo: "rectoria@cea.edu.co", dane: "341001005652", domain: "ceaschool.edu.co", tipo_calendario: "A" },
  { id: 2, nombre: "Institución Educativa El Caguán", tipo: "Oficial", sede: "Sede Principal", contacto: 3180000000, correo: "iecaguan@alcaldianeiva.gov.co", dane: "441001002747", domain: "iecaguan.edu.co", tipo_calendario: "A" },
  { id: 3, nombre: "Colegio Heisenberg Neiva", tipo: "Privado", sede: "Sede Principal", contacto: 3169100003, correo: "colegioheisenberg@hotmail.com", dane: "DANE-H-001", domain: "heisenberg.edu.co", tipo_calendario: "A" },
];

// ─── ACADEMIC CATALOGS ──────────────────────────────────────────────────────────

const sectionNames = ["A", "B"];
const jornadaNames: Array<"MAÑANA" | "TARDE" | "UNICA"> = ["MAÑANA", "TARDE", "UNICA"];

const periodSeeds = [
  { nombre: "Primer Periodo", estado: "CERRADO", porcentaje: 25, trimestre: 1 },
  { nombre: "Segundo Periodo", estado: "ABIERTO", porcentaje: 25, trimestre: 2 },
  { nombre: "Tercer Periodo", estado: "PENDIENTE", porcentaje: 25, trimestre: 3 },
  { nombre: "Cuarto Periodo", estado: "PENDIENTE", porcentaje: 25, trimestre: 4 },
];

const scaleSeeds = [
  { nivel: "SUPERIOR", min: 4.6, max: 5.0 },
  { nivel: "ALTO", min: 4.0, max: 4.5 },
  { nivel: "BASICO", min: 3.0, max: 3.9 },
  { nivel: "BAJO", min: 0.0, max: 2.9 },
];

const levelSeeds = [
  { nombre: "PREESCOLAR", grades: ["PREJARDIN", "JARDIN", "TRANSICION"] },
  { nombre: "PRIMARIA", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO"] },
  { nombre: "SECUNDARIA", grades: ["SEXTO", "SEPTIMO", "OCTAVO", "NOVENO"] },
  { nombre: "MEDIA", grades: ["DECIMO", "ONCE"] },
];

const teacherSeeds: TeacherSeed[] = [
  { firstName: "Andrea", lastName: "Rojas", subject: "Matemáticas" },
  { firstName: "Carlos", lastName: "Mendoza", subject: "Español" },
  { firstName: "Laura", lastName: "Pineda", subject: "Inglés" },
  { firstName: "Julián", lastName: "Perdomo", subject: "Ciencias Naturales" },
  { firstName: "Diana", lastName: "Trujillo", subject: "Ciencias Sociales" },
  { firstName: "Mateo", lastName: "Luna", subject: "Educación Física" },
  { firstName: "Paula", lastName: "Bastidas", subject: "Tecnología e Informática" },
  { firstName: "Santiago", lastName: "Sterling", subject: "Ética y Valores" },
];

// ─── STUDENT NAME POOLS (Colombian names) ──────────────────────────────────────

const studentFirstNames = [
  "Valentina", "Santiago", "Isabella", "Matías", "Sofía", "Samuel", "Gabriela", "Nicolás",
  "Mariana", "Sebastián", "Camila", "Alejandro", "Daniela", "Diego", "Luciana", "Andrés",
  "Sara", "Tomás", "Paula", "David", "Ana María", "Juan", "Laura", "Felipe",
  "María José", "Carlos", "Natalia", "Emilio", "Juliana", "Miguel", "Catalina", "José",
  "Manuela", "Ricardo", "Valeria", "Daniel", "Antonella", "Eduardo", "Salomé", "Martín",
];

const studentLastNames = [
  "García", "Rodríguez", "Martínez", "López", "Hernández", "González", "Díaz", "Pérez",
  "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Morales", "Vargas",
  "Castillo", "Jiménez", "Reyes", "Cruz", "Mendoza", "Ortiz", "Guerrero", "Ramos",
  "Medina", "Castro", "Herrera", "Guzmán", "Rojas", "Ruiz",
];

// ─── HELPER: ENROLLMENT CONFIG SEEDING ─────────────────────────────────────────

async function seedEnrollmentConfigs(client: DBClient): Promise<void> {
  const schoolsRes = await client.selectFrom("colegio").select("id_colegio").execute();
  for (const s of schoolsRes) {
    const yearRes = await client
      .selectFrom("anio_lectivo")
      .select(["id_anio", "calendario"])
      .where("id_colegio", "=", s.id_colegio)
      .execute();

    for (const yearRow of yearRes) {
      const yearId = yearRow.id_anio;
      const calStr = yearRow.calendario || "2026";
      const yearMatch = calStr.match(/\d{4}/g);
      const targetYearNum = yearMatch ? parseInt(yearMatch[yearMatch.length - 1]) : 2026;

      const startDate = new Date(`${targetYearNum}-07-20T00:00:00Z`);
      const endDate = new Date(`${targetYearNum}-08-25T23:59:59Z`);

      await client
        .insertInto("configuracion_inscripcion")
        .values({
          id_colegio: s.id_colegio,
          id_anio: yearId,
          fecha_inicio: startDate,
          fecha_cierre: endDate,
          habilitada: true,
        })
        .onConflict((oc) =>
          oc.columns(["id_colegio", "id_anio"]).doUpdateSet({
            fecha_inicio: startDate,
            fecha_cierre: endDate,
            habilitada: true,
          })
        )
        .execute();
    }
  }
}

// ─── HELPER: TRUNCATE TABLES ───────────────────────────────────────────────────

async function truncateExistingTables(client: DBClient, tables: string[]): Promise<void> {
  const existing = await sql<{ table_name: string }>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${tables}::text[])
  `.execute(client);

  if (existing.rows.length === 0) return;

  const quotedTables = existing.rows
    .map(({ table_name }) => `"${table_name.replace(/"/g, '""')}"`)
    .join(", ");

  await sql.raw(`TRUNCATE ${quotedTables} RESTART IDENTITY CASCADE;`).execute(client);
}

// ─── INSERT BASE CATALOGS ──────────────────────────────────────────────────────

async function insertRoles(client: DBClient): Promise<Record<string, number>> {
  const roleIds: Record<string, number> = {};
  for (const role of ["admin", "directivo", "docente", "estudiante", "padre", "admin_general"]) {
    const result = await client
      .insertInto("rol")
      .values({ nombre: role })
      .returning("id_rol")
      .executeTakeFirstOrThrow();
    roleIds[role] = result.id_rol;
  }
  return roleIds;
}

async function insertDocumentTypes(client: DBClient): Promise<void> {
  const documentTypes = [
    { id: 1, tipo: "Registro Civil" },
    { id: 2, tipo: "Tarjeta de Identidad" },
    { id: 3, tipo: "Cédula de Ciudadanía" },
    { id: 4, tipo: "Cédula de Extranjería" },
    { id: 5, tipo: "PEP / PPT" },
    { id: 6, tipo: "Pasaporte" },
  ];
  for (const dt of documentTypes) {
    await client
      .insertInto("tipo_documento")
      .values({ id_tipodocumento: dt.id, tipo: dt.tipo })
      .onConflict((oc) => oc.column("tipo").doNothing())
      .execute();
  }
}

async function insertSanctionTypes(client: DBClient): Promise<void> {
  const sanctionTypes = [
    { nombre: "SUSPENSION_TEMPORAL", descripcion: "El estudiante es suspendido de clases por un número específico de días." },
    { nombre: "MATRICULA_CONDICIONAL", descripcion: "El estudiante continúa con matrícula bajo compromiso de comportamiento." },
    { nombre: "APERCIBIMIENTO", descripcion: "Advertencia formal por escrito que precede a una sanción mayor." },
    { nombre: "EXPULSION", descripcion: "El estudiante es retirado permanentemente de la institución." },
  ];
  for (const st of sanctionTypes) {
    await client
      .insertInto("tipo_sancion")
      .values({ nombre: st.nombre, descripcion: st.descripcion })
      .onConflict((oc) => oc.column("nombre").doNothing())
      .execute();
  }
}

async function insertSections(client: DBClient): Promise<Record<string, number>> {
  const sectionIds: Record<string, number> = {};
  for (const name of sectionNames) {
    const result = await client
      .insertInto("secciones")
      .values({ nombre: name })
      .returning("id_seccion")
      .executeTakeFirstOrThrow();
    sectionIds[name] = result.id_seccion;
  }
  return sectionIds;
}

// ─── INSERT SCHOOL BASE (Directivos + Docentes) ────────────────────────────────

async function insertSchool(
  client: DBClient,
  school: SchoolSeed,
  roleIds: Record<string, number>,
  directivoHash: string,
  docenteHash: string,
  credentials: CredentialEntry[]
): Promise<void> {
  await client
    .insertInto("colegio")
    .values({
      id_colegio: school.id,
      nombre: school.nombre,
      tipo_colegio: school.tipo,
      sede: school.sede,
      contacto: school.contacto,
      correo: school.correo,
      dane: school.dane,
      tipo_calendario: school.tipo_calendario,
    })
    .execute();

  // --- Rector ---
  const rectorEmail = `rector@${school.domain}`;
  const rectorDoc = `10010000${school.id}`;

  const rectorRes = await client
    .insertInto("usuario")
    .values({
      email: rectorEmail,
      password: directivoHash,
      nombre: "Rector",
      apellido: school.nombre,
      activo: true,
      id_tipodocumento: DOCUMENT_TYPE_CC,
      documento: rectorDoc,
      telefono: String(school.contacto),
      fecha_creacion: new Date("2025-01-15T13:00:00Z"),
    })
    .returning("id_usuario")
    .executeTakeFirstOrThrow();
  const rectorUserId = rectorRes.id_usuario;

  await client.insertInto("usuario_rol").values({ id_usuario: rectorUserId, id_rol: roleIds.directivo }).execute();
  await client
    .insertInto("usuario_colegio")
    .values({ id_usuario: rectorUserId, id_colegio: school.id, id_rol: roleIds.directivo, estado: "ACTIVO", fecha_inicio: new Date() })
    .onConflict((oc) => oc.columns(["id_usuario", "id_colegio", "id_rol"]).doNothing())
    .execute();
  await client.insertInto("directivo").values({ id_colegio: school.id, id_usuario: rectorUserId, cargo: "RECTOR" }).execute();
  await client
    .insertInto("usuario_colegio_email")
    .values({ id_usuario: rectorUserId, id_colegio: school.id, email_institucional: rectorEmail })
    .onConflict((oc) => oc.columns(["id_usuario", "id_colegio"]).doNothing())
    .execute();

  credentials.push({
    colegio: school.nombre, seccion: "staff", rol: "DIRECTIVO",
    nombre: `Rector ${school.nombre}`, correo: rectorEmail, password: DIRECTIVO_PASSWORD,
  });

  // --- Coordinador ---
  const directivoEmail = `directivo@${school.domain}`;
  const directivoDoc = `10020000${school.id}`;

  const directivoResult = await client
    .insertInto("usuario")
    .values({
      email: directivoEmail,
      password: directivoHash,
      nombre: "Directivo",
      apellido: school.nombre,
      activo: true,
      id_tipodocumento: DOCUMENT_TYPE_CC,
      documento: directivoDoc,
      telefono: String(school.contacto),
      fecha_creacion: new Date("2025-01-15T13:00:00Z"),
    })
    .returning("id_usuario")
    .executeTakeFirstOrThrow();
  const directivoUserId = directivoResult.id_usuario;

  await client.insertInto("usuario_rol").values({ id_usuario: directivoUserId, id_rol: roleIds.directivo }).execute();
  await client
    .insertInto("usuario_colegio")
    .values({ id_usuario: directivoUserId, id_colegio: school.id, id_rol: roleIds.directivo, estado: "ACTIVO", fecha_inicio: new Date() })
    .onConflict((oc) => oc.columns(["id_usuario", "id_colegio", "id_rol"]).doNothing())
    .execute();
  await client.insertInto("directivo").values({ id_colegio: school.id, id_usuario: directivoUserId, cargo: "COORDINADOR" }).execute();
  await client
    .insertInto("usuario_colegio_email")
    .values({ id_usuario: directivoUserId, id_colegio: school.id, email_institucional: directivoEmail })
    .onConflict((oc) => oc.columns(["id_usuario", "id_colegio"]).doNothing())
    .execute();

  credentials.push({
    colegio: school.nombre, seccion: "staff", rol: "DIRECTIVO",
    nombre: `Directivo ${school.nombre}`, correo: directivoEmail, password: DIRECTIVO_PASSWORD,
  });

  // --- Docentes ---
  for (let index = 0; index < teacherSeeds.length; index++) {
    const teacher = teacherSeeds[index];
    const alias = teacher.subject.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
    const email = `${alias}.${school.id}@${school.domain}`;
    const fullLastName = `${teacher.lastName} ${school.id}`;

    const teacherDoc = `1003${school.id}${String(index + 1).padStart(4, "0")}`;
    const teacherPhone = `310${school.id}${String(index + 1).padStart(6, "0")}`;

    const userResult = await client
      .insertInto("usuario")
      .values({
        email,
        password: docenteHash,
        nombre: teacher.firstName,
        apellido: fullLastName,
        activo: true,
        id_tipodocumento: DOCUMENT_TYPE_CC,
        documento: teacherDoc,
        telefono: teacherPhone,
        fecha_creacion: new Date("2025-01-15T13:00:00Z"),
      })
      .returning("id_usuario")
      .executeTakeFirstOrThrow();
    const teacherUserId = userResult.id_usuario;

    await client.insertInto("usuario_rol").values({ id_usuario: teacherUserId, id_rol: roleIds.docente }).execute();
    await client
      .insertInto("usuario_colegio")
      .values({ id_usuario: teacherUserId, id_colegio: school.id, id_rol: roleIds.docente, estado: "ACTIVO", fecha_inicio: new Date() })
      .onConflict((oc) => oc.columns(["id_usuario", "id_colegio", "id_rol"]).doNothing())
      .execute();
    await client
      .insertInto("docente")
      .values({
        nombre: teacher.firstName,
        apellido: fullLastName,
        id_colegio: school.id,
        id_usuario: teacherUserId,
      })
      .execute();
    await client
      .insertInto("usuario_colegio_email")
      .values({ id_usuario: teacherUserId, id_colegio: school.id, email_institucional: email })
      .onConflict((oc) => oc.columns(["id_usuario", "id_colegio"]).doNothing())
      .execute();

    credentials.push({
      colegio: school.nombre, seccion: "staff", rol: "DOCENTE",
      nombre: `${teacher.firstName} ${fullLastName}`, correo: email, password: DOCENTE_PASSWORD, materia: teacher.subject,
    });
  }
}

// ─── INSERT ACADEMIC STRUCTURE ────────────────────────────────────────────────

async function insertSchoolAcademicStructure(
  client: DBClient,
  school: SchoolSeed,
  sectionIds: Record<string, number>
): Promise<void> {
  const levelIdsByName: Record<string, number> = {};
  const subjectIdsByName: Record<string, number> = {};
  const teacherIdsBySubject: Record<string, number> = {};
  const allGroupIds: number[] = [];
  const groupGradesMap = new Map<number, string>();

  const yearLabel = school.tipo_calendario === "B" ? `${parseInt(CURRENT_YEAR) - 1}-${CURRENT_YEAR}` : CURRENT_YEAR;
  const fInicio2025 = school.tipo_calendario === "B" ? "2024-09-01" : "2025-01-15";
  const fFin2025 = school.tipo_calendario === "B" ? "2025-06-30" : "2025-11-30";

  const academicYearResult = await client
    .insertInto("anio_lectivo")
    .values({
      calendario: yearLabel,
      id_colegio: school.id,
      tipo_calendario: school.tipo_calendario,
      estado: "CERRADO",
      fecha_inicio: fInicio2025,
      fecha_fin: fFin2025,
    })
    .returning("id_anio")
    .executeTakeFirstOrThrow();
  const academicYearId = academicYearResult.id_anio;

  // --- Levels ---
  for (const levelSeed of levelSeeds) {
    const levelResult = await client
      .insertInto("nivel_escolar")
      .values({ nombre: levelSeed.nombre, id_colegio: school.id })
      .returning("id_nivel")
      .executeTakeFirstOrThrow();
    levelIdsByName[levelSeed.nombre] = levelResult.id_nivel;
  }

  // --- Jornadas ---
  const jornadaIdsByName: Record<string, number> = {};
  for (const jornadaName of jornadaNames) {
    const result = await client
      .insertInto("jornada")
      .values({ nombre: jornadaName, id_colegio: school.id })
      .returning("id_jornada")
      .executeTakeFirstOrThrow();
    jornadaIdsByName[jornadaName] = result.id_jornada;
  }

  const computeQuarterPeriodsForDates = (startDateStr: string, endDateStr: string) => {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const quarterMs = (endDate.getTime() - startDate.getTime()) / 4;
    const periodNames = ["Primer Periodo", "Segundo Periodo", "Tercer Periodo", "Cuarto Periodo"];

    const periods = [];
    for (let i = 0; i < 4; i++) {
      const qStart = new Date(startDate.getTime() + Math.round(i * quarterMs));
      const qEnd = i === 3 
        ? new Date(endDate.getTime()) 
        : new Date(startDate.getTime() + Math.round((i + 1) * quarterMs) - (24 * 60 * 60 * 1000));

      periods.push({
        nombre: periodNames[i],
        trimestre: i + 1,
        fecha_inicio: qStart.toISOString().split("T")[0],
        fecha_fin: qEnd.toISOString().split("T")[0],
        mes_inicio: qStart.getUTCMonth() + 1,
        dia_inicio: qStart.getUTCDate(),
        mes_fin: qEnd.getUTCMonth() + 1,
        dia_fin: qEnd.getUTCDate(),
      });
    }
    return periods;
  };

  // --- Periods for 2025 ---
  const qPeriods2025 = computeQuarterPeriodsForDates(fInicio2025, fFin2025);
  for (const qp of qPeriods2025) {
    await client
      .insertInto("periodo_academico")
      .values({
        nombre: qp.nombre,
        estado: "CERRADO",
        porcentaje: 25.0,
        trimestre: qp.trimestre,
        id_anio: academicYearId,
        id_colegio: school.id,
        fecha_inicio: qp.fecha_inicio,
        fecha_fin: qp.fecha_fin,
        mes_inicio: qp.mes_inicio,
        mes_fin: qp.mes_fin,
        dia_inicio: qp.dia_inicio,
        dia_fin: qp.dia_fin,
      })
      .execute();
  }

  // --- Year 2026 ---
  const yearLabel2026 = school.tipo_calendario === "B" ? "2025-2026" : "2026";
  const fInicio2026 = school.tipo_calendario === "B" ? "2025-09-01" : "2026-01-15";
  const fFin2026 = school.tipo_calendario === "B" ? "2026-06-30" : "2026-11-30";

  const academicYearResult2026 = await client
    .insertInto("anio_lectivo")
    .values({
      calendario: yearLabel2026,
      id_colegio: school.id,
      tipo_calendario: school.tipo_calendario,
      estado: "ABIERTO",
      fecha_inicio: fInicio2026,
      fecha_fin: fFin2026,
    })
    .returning("id_anio")
    .executeTakeFirstOrThrow();
  const academicYearId2026 = academicYearResult2026.id_anio;

  const qPeriods2026 = computeQuarterPeriodsForDates(fInicio2026, fFin2026);
  for (const qp of qPeriods2026) {
    let estado2026: "CERRADO" | "ABIERTO" | "PENDIENTE" = "PENDIENTE";
    if (qp.trimestre === 1 || qp.trimestre === 2) {
      estado2026 = "CERRADO";
    } else if (qp.trimestre === 3) {
      estado2026 = "ABIERTO";
    } else {
      estado2026 = "PENDIENTE";
    }
    await client
      .insertInto("periodo_academico")
      .values({
        nombre: qp.nombre,
        estado: estado2026,
        porcentaje: 25.0,
        trimestre: qp.trimestre,
        id_anio: academicYearId2026,
        id_colegio: school.id,
        fecha_inicio: qp.fecha_inicio,
        fecha_fin: qp.fecha_fin,
        mes_inicio: qp.mes_inicio,
        mes_fin: qp.mes_fin,
        dia_inicio: qp.dia_inicio,
        dia_fin: qp.dia_fin,
      })
      .execute();
  }

  // --- Escala de Valoración ---
  for (const yearId of [academicYearId, academicYearId2026]) {
    for (const scaleSeed of scaleSeeds) {
      await client
        .insertInto("escala_valoracion")
        .values({
          nivel: scaleSeed.nivel,
          valor_minimo: scaleSeed.min,
          valor_maximo: scaleSeed.max,
          id_colegio: school.id,
          id_anio: yearId,
        })
        .execute();
    }
  }

  // --- Get docentes for subject assignment ---
  const teachersRes = await client
    .selectFrom("docente")
    .select("id_docente")
    .where("id_colegio", "=", school.id)
    .orderBy("id_docente", "asc")
    .execute();

  teacherSeeds.forEach((teacher, index) => {
    teacherIdsBySubject[teacher.subject] = teachersRes[index].id_docente;
  });

  // --- Subjects ---
  for (const teacher of teacherSeeds) {
    const subjectResult = await client
      .insertInto("materias")
      .values({ nombre: teacher.subject, id_colegio: school.id })
      .returning("id_materia")
      .executeTakeFirstOrThrow();
    subjectIdsByName[teacher.subject] = subjectResult.id_materia;
  }

  // --- Special subject: Desarrollo Integral (Preescolar) ---
  const desIntegralResult = await client
    .insertInto("materias")
    .values({ nombre: "Desarrollo Integral", id_colegio: school.id })
    .returning("id_materia")
    .executeTakeFirstOrThrow();
  subjectIdsByName["Desarrollo Integral"] = desIntegralResult.id_materia;
  teacherIdsBySubject["Desarrollo Integral"] = teachersRes[0].id_docente;

  // --- Grupos (tipo_grado, jornada, seccion) ---
  let teacherRotationIdx = 0;
  for (const levelSeed of levelSeeds) {
    const levelId = levelIdsByName[levelSeed.nombre];

    for (const gradeName of levelSeed.grades) {
      const gradeTypeResult = await client
        .insertInto("tipo_grado")
        .values({ nombre: gradeName, id_nivel: levelId })
        .returning("id_tipo_grado")
        .executeTakeFirstOrThrow();
      const gradeTypeId = gradeTypeResult.id_tipo_grado;

      for (const jornadaName of jornadaNames) {
        const jornadaId = jornadaIdsByName[jornadaName];

        for (const sectionName of sectionNames) {
          const sectionId = sectionIds[sectionName];

          // Rotate titular docente
          const titularId = teachersRes[teacherRotationIdx % teachersRes.length].id_docente;
          teacherRotationIdx++;

          // Normalizado 3NF: id_nivel pertenece a tipo_grado, no a grupos.
          // Tabla obsoleta 'grados' eliminada.
          const groupResult = await client
            .insertInto("grupos")
            .values({
              id_jornada: jornadaId,
              id_colegio: school.id,
              id_seccion: sectionId,
              cupos_totales: CUPOS_POR_CURSO,
              id_tipo_grado: gradeTypeId,
              id_docente: titularId,
            })
            .returning("id_grupo")
            .executeTakeFirstOrThrow();

          const gid = groupResult.id_grupo;
          allGroupIds.push(gid);
          groupGradesMap.set(gid, gradeName);
        }
      }
    }
  }

  // --- Detalle Grados (assign all subjects+teachers to all groups for BOTH 2025 & 2026) ---
  for (const groupId of allGroupIds) {
    const gradeName = groupGradesMap.get(groupId);
    const isPreescolar = gradeName === "PREJARDIN" || gradeName === "JARDIN" || gradeName === "TRANSICION";

    for (const yId of [academicYearId, academicYearId2026]) {
      if (isPreescolar) {
        await client
          .insertInto("detalle_grados")
          .values({
            id_materia: subjectIdsByName["Desarrollo Integral"],
            id_docente: teacherIdsBySubject["Desarrollo Integral"],
            id_colegio: school.id,
            id_grupo: groupId,
            id_anio: yId,
          })
          .execute();
      } else {
        for (const teacher of teacherSeeds) {
          await client
            .insertInto("detalle_grados")
            .values({
              id_materia: subjectIdsByName[teacher.subject],
              id_docente: teacherIdsBySubject[teacher.subject],
              id_colegio: school.id,
              id_grupo: groupId,
              id_anio: yId,
            })
            .execute();
        }
      }
    }
  }
}

// ─── INSERT STUDENTS AND PARENTS ──────────────────────────────────────────────

async function insertStudentsAndParents(
  client: DBClient,
  school: SchoolSeed,
  roleIds: Record<string, number>,
  parentHash: string,
  studentHash: string,
  credentials: CredentialEntry[]
): Promise<void> {
  const yearsRes = await client
    .selectFrom("anio_lectivo")
    .select("id_anio")
    .where("id_colegio", "=", school.id)
    .where((eb) => eb.or([eb("calendario", "=", "2025"), eb("calendario", "=", "2024-2025")]))
    .orderBy("id_anio", "asc")
    .limit(1)
    .execute();
  const yearId = yearsRes[0]?.id_anio;
  if (!yearId) return;

  const directivoRes = await client
    .selectFrom("directivo")
    .select("id")
    .where("id_colegio", "=", school.id)
    .limit(1)
    .execute();
  const directivoId = directivoRes[0]?.id;

  const teachersList = await client
    .selectFrom("usuario as u")
    .innerJoin("docente as d", "u.id_usuario", "d.id_usuario")
    .select(["u.id_usuario", "u.email", "u.nombre", "u.apellido"])
    .where("d.id_colegio", "=", school.id)
    .execute();

  const targetDocentesPadresCount = Math.ceil(teachersList.length * 0.6);
  let docentesPadresIndex = 0;

  // Consulta 3NF: id_nivel se obtiene de tipo_grado (tg.id_nivel)
  const groups = await client
    .selectFrom("grupos as g")
    .innerJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
    .innerJoin("jornada as j", "g.id_jornada", "j.id_jornada")
    .innerJoin("secciones as s", "g.id_seccion", "s.id_seccion")
    .select(["g.id_grupo", "tg.id_nivel"])
    .where("g.id_colegio", "=", school.id)
    .where("j.nombre", "=", "MAÑANA")
    .where("s.nombre", "in", ["A", "B"])
    .orderBy("g.id_grupo", "asc")
    .execute();

  if (groups.length === 0) return;

  let globalStudentIdx = 0;
  let parentIdx = 0;
  let currentParentId: number | null = null;
  let currentParentEmail = "";
  let currentParentChildNames: string[] = [];

  const flushParent = () => {
    if (currentParentId !== null && currentParentChildNames.length > 0) {
      const existingCred = credentials.find((c) => c.correo === currentParentEmail);
      if (existingCred) {
        existingCred.rol = "DOCENTE / PADRE";
        existingCred.hijos = [...currentParentChildNames];
      } else {
        credentials.push({
          colegio: school.nombre, seccion: "familia", rol: "PADRE",
          nombre: `Padre ${parentIdx} ${school.nombre}`, correo: currentParentEmail,
          password: "padre123", hijos: [...currentParentChildNames],
        });
      }
    }
  };

  for (const group of groups) {
    for (let s = 0; s < STUDENTS_PER_GROUP; s++) {
      globalStudentIdx++;

      let studentState: "ACTIVO" | "SANCIONADO" | "EXPULSADO" | "RETIRADO" = "ACTIVO";
      let enrollmentState: "ACTIVA" | "CANCELADA" = "ACTIVA";
      let motivoCancelacion: string | null = null;
      let motivoEstado: string | null = null;
      let userActive = true;

      if (globalStudentIdx % 20 === 5) {
        studentState = "SANCIONADO";
        motivoEstado = "Incumplimiento reiterado de las normas de convivencia escolar.";
      } else if (globalStudentIdx % 20 === 10) {
        studentState = "EXPULSADO";
        enrollmentState = "CANCELADA";
        motivoCancelacion = "EXPULSION";
        motivoEstado = "Falta grave contra la integridad de la comunidad educativa.";
        userActive = false;
      } else if (globalStudentIdx % 20 === 15) {
        studentState = "RETIRADO";
        enrollmentState = "CANCELADA";
        motivoCancelacion = "RETIRO_VOLUNTARIO";
      }

      if ((globalStudentIdx - 1) % 2 === 0) {
        flushParent();
        parentIdx++;
        currentParentChildNames = [];

        let parentUserId: number;
        let pName: string;
        let pLastName: string;

        if (docentesPadresIndex < targetDocentesPadresCount) {
          const teacherUser = teachersList[docentesPadresIndex];
          parentUserId = teacherUser.id_usuario;
          currentParentEmail = teacherUser.email || "";
          pName = teacherUser.nombre;
          pLastName = teacherUser.apellido || school.nombre;
          docentesPadresIndex++;

          await client
            .insertInto("usuario_rol")
            .values({ id_usuario: parentUserId, id_rol: roleIds.padre })
            .onConflict((oc) => oc.columns(["id_usuario", "id_rol"]).doNothing())
            .execute();
          await client
            .insertInto("usuario_colegio")
            .values({ id_usuario: parentUserId, id_colegio: school.id, id_rol: roleIds.padre, estado: "ACTIVO", fecha_inicio: new Date() })
            .onConflict((oc) => oc.columns(["id_usuario", "id_colegio", "id_rol"]).doNothing())
            .execute();
        } else {
          currentParentEmail = `padre${parentIdx}.${school.id}@${school.domain}`;
          pName = `Padre ${parentIdx}`;
          pLastName = school.nombre;
          const pDoc = `1004${school.id}${String(parentIdx).padStart(5, "0")}`;
          const parentPhone = `320${school.id}${String(parentIdx).padStart(6, "0")}`;

          const pUserRes = await client
            .insertInto("usuario")
            .values({
              email: currentParentEmail,
              password: parentHash,
              nombre: pName,
              apellido: pLastName,
              activo: true,
              id_tipodocumento: DOCUMENT_TYPE_CC,
              documento: pDoc,
              telefono: parentPhone,
              fecha_creacion: new Date("2025-01-15T13:00:00Z"),
            })
            .returning("id_usuario")
            .executeTakeFirstOrThrow();
          parentUserId = pUserRes.id_usuario;

          await client.insertInto("usuario_rol").values({ id_usuario: parentUserId, id_rol: roleIds.padre }).execute();
          await client
            .insertInto("usuario_colegio")
            .values({ id_usuario: parentUserId, id_colegio: school.id, id_rol: roleIds.padre, estado: "ACTIVO", fecha_inicio: new Date() })
            .onConflict((oc) => oc.columns(["id_usuario", "id_colegio", "id_rol"]).doNothing())
            .execute();
          await client
            .insertInto("usuario_colegio_email")
            .values({ id_usuario: parentUserId, id_colegio: school.id, email_institucional: currentParentEmail })
            .onConflict((oc) => oc.columns(["id_usuario", "id_colegio"]).doNothing())
            .execute();
        }

        const pFamRes = await client
          .insertInto("padre_familia")
          .values({ nombre: pName, apellido: pLastName, id_colegio: school.id, id_usuario: parentUserId })
          .returning("id_padrefamilia")
          .executeTakeFirstOrThrow();
        currentParentId = pFamRes.id_padrefamilia;
      }

      const fIdx = (globalStudentIdx - 1) % studentFirstNames.length;
      const lIdx = Math.floor((globalStudentIdx - 1) / studentFirstNames.length) % studentLastNames.length;
      const firstName = studentFirstNames[fIdx];
      const lastName = studentLastNames[lIdx];
      const fullName = `${firstName} ${lastName}`;
      currentParentChildNames.push(fullName);

      const studentEmail = `est${globalStudentIdx}.${school.id}@${school.domain}`;
      const studentCode = `EST-${school.id}-${globalStudentIdx}`;
      const studentDoc = `1005${school.id}${String(globalStudentIdx).padStart(5, "0")}`;

      const sUserRes = await client
        .insertInto("usuario")
        .values({
          email: studentEmail,
          password: studentHash,
          nombre: firstName,
          apellido: lastName,
          activo: userActive,
          id_tipodocumento: 1, // Registro Civil / TI
          documento: studentDoc,
          telefono: null,
          fecha_creacion: new Date("2025-01-15T13:00:00Z"),
        })
        .returning("id_usuario")
        .executeTakeFirstOrThrow();
      const studentUserId = sUserRes.id_usuario;

      await client.insertInto("usuario_rol").values({ id_usuario: studentUserId, id_rol: roleIds.estudiante }).execute();
      await client
        .insertInto("usuario_colegio")
        .values({ id_usuario: studentUserId, id_colegio: school.id, id_rol: roleIds.estudiante, estado: "ACTIVO", fecha_inicio: new Date() })
        .onConflict((oc) => oc.columns(["id_usuario", "id_colegio", "id_rol"]).doNothing())
        .execute();
      await client
        .insertInto("usuario_colegio_email")
        .values({ id_usuario: studentUserId, id_colegio: school.id, email_institucional: studentEmail })
        .onConflict((oc) => oc.columns(["id_usuario", "id_colegio"]).doNothing())
        .execute();

      const estRes = await client
        .insertInto("estudiante")
        .values({
          nombre: firstName,
          apellido: lastName,
          codigo: studentCode,
          id_colegio: school.id,
          id_usuario: studentUserId,
          estado: studentState,
          motivo_estado: motivoEstado,
        })
        .returning("id_estudiante")
        .executeTakeFirstOrThrow();
      const idEstudiante = estRes.id_estudiante;

      if (studentState === "SANCIONADO" && directivoId) {
        const typeRes = await client
          .selectFrom("tipo_sancion")
          .select("id_tipo_sancion")
          .where("nombre", "=", "SUSPENSION_TEMPORAL")
          .limit(1)
          .execute();
        const tipoSancionId = typeRes[0]?.id_tipo_sancion;
        if (tipoSancionId) {
          await client
            .insertInto("sancion")
            .values({
              id_estudiante: idEstudiante,
              id_tipo_sancion: tipoSancionId,
              motivo: motivoEstado || "Incumplimiento de normas",
              fecha_inicio: new Date(),
              fecha_fin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              estado: "ACTIVA",
              id_directivo: directivoId,
            })
            .execute();
        }
      }

      if (studentState === "EXPULSADO" && directivoId) {
        const typeRes = await client
          .selectFrom("tipo_sancion")
          .select("id_tipo_sancion")
          .where("nombre", "=", "EXPULSION")
          .limit(1)
          .execute();
        const tipoSancionId = typeRes[0]?.id_tipo_sancion;
        if (tipoSancionId) {
          await client
            .insertInto("sancion")
            .values({
              id_estudiante: idEstudiante,
              id_tipo_sancion: tipoSancionId,
              motivo: motivoEstado || "Falta grave",
              fecha_inicio: new Date(),
              fecha_fin: new Date("9999-12-31"),
              estado: "ACTIVA",
              id_directivo: directivoId,
            })
            .execute();
        }
      }

      await client
        .insertInto("detalle_padrefamilia")
        .values({
          id_padrefamilia: currentParentId!,
          id_estudiante: idEstudiante,
          id_colegio: school.id,
        })
        .execute();

      await client
        .insertInto("matricula")
        .values({
          id_estudiante: idEstudiante,
          id_nivel: group.id_nivel,
          id_colegio: school.id,
          id_anio: yearId,
          estado: enrollmentState,
          correo_padre: currentParentEmail,
          id_grupo: group.id_grupo,
          motivo_cancelacion: motivoCancelacion,
        })
        .execute();

      const rolLabel = studentState === "ACTIVO" ? "ESTUDIANTE"
        : studentState === "SANCIONADO" ? "ESTUDIANTE (SANCIONADO)"
        : studentState === "RETIRADO" ? "ESTUDIANTE (RETIRADO)"
        : null;

      if (rolLabel) {
        credentials.push({
          colegio: school.nombre, seccion: "familia", rol: rolLabel,
          nombre: fullName, correo: studentEmail, codigo: studentCode, password: "estudiante123",
        });
      }
    }
  }

  flushParent();
  console.log(`   ✅ ${school.nombre}: ${globalStudentIdx} estudiantes (${parentIdx} padres) en ${groups.length} grupos`);
}

// ─── INSERT SAMPLE ATTENDANCE ─────────────────────────────────────────────────

async function insertSampleAttendance(client: DBClient): Promise<void> {
  const justifications = [
    "Cita médica", "Calamidad doméstica", "Gripe común", "Evento institucional", "Retraso transporte",
  ];

  const enrollmentRes = await client
    .selectFrom("matricula as m")
    .innerJoin("anio_lectivo as al", "m.id_anio", "al.id_anio")
    .select(["m.id_estudiante", "m.id_colegio", "m.id_grupo", "al.id_anio", "al.calendario"])
    .where("m.estado", "=", "ACTIVA")
    .where((eb) => eb.or([eb("al.calendario", "=", "2025"), eb("al.calendario", "=", "2024-2025")]))
    .execute();

  const batchValues: any[] = [];

  for (const enrollment of enrollmentRes) {
    const { id_estudiante, id_colegio, id_grupo, id_anio, calendario } = enrollment;
    if (!id_grupo) continue;

    const yearMatch = calendario ? calendario.match(/\d{4}/g) : null;
    const targetYearNum = yearMatch ? parseInt(yearMatch[yearMatch.length - 1]) : 2025;

    const dgRes = await client
      .selectFrom("detalle_grados")
      .select("id_detallegrado")
      .where("id_grupo", "=", id_grupo)
      .where("id_colegio", "=", id_colegio)
      .execute();
    if (dgRes.length === 0) continue;

    const periodsRes = await client
      .selectFrom("periodo_academico")
      .select(["id_periodo", "mes_inicio"])
      .where("id_colegio", "=", id_colegio)
      .where("id_anio", "=", id_anio)
      .where("estado", "=", "CERRADO")
      .execute();

    for (const period of periodsRes) {
      const mes = period.mes_inicio || 1;
      let daysGenerated = 0;

      for (let d = 1; d <= 28 && daysGenerated < 5; d++) {
        const date = new Date(targetYearNum, mes - 1, d);
        const dow = date.getDay();
        if (dow === 0 || dow === 6) continue;
        daysGenerated++;

        const dateStr = `${targetYearNum}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

        for (const dg of dgRes) {
          const rand = Math.random();
          let estado = "PRESENTE";
          let justificacion: string | null = null;
          let hora_llegada: string | null = null;

          if (rand > 0.98) {
            estado = "JUSTIFICADA";
            justificacion = justifications[Math.floor(Math.random() * justifications.length)];
          } else if (rand > 0.95) {
            estado = "AUSENTE";
          } else if (rand > 0.92) {
            estado = "TARDE";
          }

          if (estado === "PRESENTE") {
            const min = Math.floor(Math.random() * 16);
            hora_llegada = `07:${String(min).padStart(2, "0")}`;
          } else if (estado === "TARDE") {
            const min = 16 + Math.floor(Math.random() * 30);
            hora_llegada = `07:${String(min).padStart(2, "0")}`;
          }

          batchValues.push({ id_estudiante, id_detallegrado: dg.id_detallegrado, fecha: dateStr, estado, justificacion, id_colegio, hora_llegada });

          if (batchValues.length >= 200) {
            await flushAttendanceBatch(client, batchValues);
            batchValues.length = 0;
          }
        }
      }
    }
  }

  if (batchValues.length > 0) {
    await flushAttendanceBatch(client, batchValues);
  }
}

async function flushAttendanceBatch(client: DBClient, batch: any[]) {
  if (batch.length === 0) return;

  const inserted = await client
    .insertInto("registro_asistencia")
    .values(
      batch.map((r) => ({
        id_estudiante: r.id_estudiante,
        id_detallegrado: r.id_detallegrado,
        fecha: r.fecha,
        estado: r.estado,
        justificacion: r.justificacion,
        id_colegio: r.id_colegio,
        hora_llegada: r.hora_llegada,
      }))
    )
    .returning(["id_registroasistencia", "estado", "hora_llegada"])
    .execute();

  const detailValues = inserted.map((row) => ({
    id_registroasistencia: row.id_registroasistencia,
    numero_bloque: 1,
    estado: row.estado,
    hora_registro: row.hora_llegada || "07:00:00",
    observacion: null,
  }));

  if (detailValues.length > 0) {
    await client
      .insertInto("registro_asistencia_detalle")
      .values(detailValues)
      .execute();
  }
}

// ─── WRITE CREDENTIALS FILE ───────────────────────────────────────────────────

function writeCredentialsFile(credentials: CredentialEntry[]): string {
  const outputDir = path.resolve(process.cwd(), "generated");
  const outputFile = path.join(outputDir, "seed-credentials.md");
  fs.mkdirSync(outputDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const lines: string[] = [
    "# Credenciales generadas por reset_and_seed.ts",
    "",
    `> Fecha de generación: ${generatedAt}`,
    ">",
    "> Este archivo se regenera cada vez que ejecutes el seed de reseteo.",
    "",
  ];

  const generalCredentials = credentials.filter((e) => e.seccion === "general");
  if (generalCredentials.length > 0) {
    lines.push("## 🔑 Administrador General (login: correo + contraseña)", "");
    lines.push("| Rol | Nombre | Correo | Contraseña |");
    lines.push("| --- | --- | --- | --- |");
    for (const c of generalCredentials) lines.push(`| ${c.rol} | ${c.nombre} | ${c.correo} | ${c.password} |`);
    lines.push("", "---", "");
  }

  for (const school of schools) {
    const schoolCreds = credentials.filter((e) => e.colegio === school.nombre);
    const staffCreds = schoolCreds.filter((e) => e.seccion === "staff");
    const familiaCreds = schoolCreds.filter((e) => e.seccion === "familia");

    lines.push(`## ${school.nombre}`, "");

    lines.push("### 👤 Personal Institucional (login: correo + contraseña)", "");
    lines.push("| Rol | Nombre | Correo | Contraseña | Materia |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const c of staffCreds) lines.push(`| ${c.rol} | ${c.nombre} | ${c.correo} | ${c.password} | ${c.materia ?? "-"} |`);
    lines.push("");

    const padres = familiaCreds.filter((e) => e.rol === "PADRE");
    if (padres.length > 0) {
      lines.push("### 👨‍👩‍👧 Padres de Familia (login: correo + contraseña)", "");
      lines.push("| Rol | Correo | Contraseña | Hijos asociados |");
      lines.push("| --- | --- | --- | --- |");
      for (const c of padres) lines.push(`| ${c.rol} | ${c.correo} | ${c.password} | ${c.hijos?.join(", ") ?? "-"} |`);
      lines.push("");
    }

    const estudiantes = familiaCreds.filter((e) => e.rol.startsWith("ESTUDIANTE"));
    if (estudiantes.length > 0) {
      lines.push("### 🎓 Estudiantes (login: código estudiantil + contraseña)", "");
      lines.push("| Código | Nombre | Contraseña | Estado |");
      lines.push("| --- | --- | --- | --- |");
      for (const c of estudiantes) {
        const estado = c.rol.includes("SANCIONADO") ? "⚠️ SANCIONADO" : c.rol.includes("RETIRADO") ? "🔴 RETIRADO" : "✅ ACTIVO";
        lines.push(`| ${c.codigo} | ${c.nombre} | ${c.password} | ${estado} |`);
      }
      lines.push("");
    }

    lines.push("---", "");
  }

  fs.writeFileSync(outputFile, `${lines.join("\n")}\n`, "utf8");
  return outputFile;
}

// ─── SEED DBA CATALOG ─────────────────────────────────────────────────────────

async function seedDbaCatalog(client: DBClient): Promise<void> {
  console.log("\n🌱 Iniciando importación y siembra del catálogo de DBA...");

  const sqlPath = path.join(__dirname, "dba_catalog.sql");
  if (fs.existsSync(sqlPath)) {
    console.log("⚡ Cargando catálogo oficial de DBA y evidencias desde dba_catalog.sql...");
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    await sql.raw(sqlContent).execute(client);
    console.log("✅ Catálogo oficial de DBA y evidencias cargado exitosamente desde SQL.");
  } else {
    console.log("⚠️ dba_catalog.sql no encontrado, intentando importar vía scripts Python...");
    const rootDir = path.resolve(__dirname, "../../..");
    const dbaPdfs = [
      { pdf: path.join(rootDir, "guides/DBA/DBA_matematicas.pdf"), area: "Matemáticas", version: "2016", startPage: 8, script: "importar_dba.py" },
      { pdf: path.join(rootDir, "guides/DBA/DBA_lenguaje.pdf"), area: "Español", version: "2016", startPage: 8, script: "importar_dba.py" },
      { pdf: path.join(rootDir, "guides/DBA/DBA_naturales.pdf"), area: "Ciencias Naturales", version: "2016", startPage: 8, script: "importar_dba.py" },
      { pdf: path.join(rootDir, "guides/DBA/DBA_sociales.pdf"), area: "Ciencias Sociales", version: "2016", startPage: 8, script: "importar_dba.py" },
      { pdf: path.join(rootDir, "guides/DBA/DBA_transicion.pdf"), area: "Desarrollo Integral", version: "2016", startPage: 8, script: "importar_dba.py" },
      { pdf: path.join(rootDir, "guides/DBA/dba_ingles_transicion_quinto.pdf"), area: "Inglés", version: "2016", startPage: 8, script: "importar_dba_primaria_ingles.py" },
      { pdf: path.join(rootDir, "guides/DBA/DBA_ingles_sexto_once.pdf"), area: "Inglés", version: "2016", startPage: 15, script: "importar_dba.py" },
    ];

    for (const item of dbaPdfs) {
      console.log(`⏳ Importando ${item.area} desde ${item.pdf} (pág. ${item.startPage})...`);
      try {
        const pdfPath = item.pdf.replace(/\\/g, "/");
        const cmd = `python scripts/${item.script} --pdf "${pdfPath}" --area "${item.area}" --version "${item.version}" --start-page ${item.startPage}`;
        execSync(cmd, { stdio: "inherit", cwd: path.resolve(__dirname, "../..") });
      } catch (err) {
        console.error(`❌ Error importando ${item.pdf}:`, err);
      }
    }

    console.log("🔄 Reasignando DBA de inglés Transición a la materia Desarrollo Integral...");
    await client
      .updateTable("dba")
      .set({
        area: "Desarrollo Integral",
        numero_dba: sql`numero_dba + 100`,
      })
      .where("area", "=", "Inglés")
      .where("grado", "=", "TRANSICION")
      .where("version_curricular", "=", "2016")
      .execute();
  }

  const colegiosRes = await client.selectFrom("colegio").select("id_colegio").execute();

  console.log("📋 Poblando colegio_version_curricular con versión 2016...");
  const subjectsGrades = [
    { area: "Matemáticas", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
    { area: "Español", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
    { area: "Ciencias Naturales", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
    { area: "Ciencias Sociales", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
    { area: "Inglés", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
    { area: "Desarrollo Integral", grades: ["TRANSICION"] },
  ];

  for (const school of colegiosRes) {
    for (const sg of subjectsGrades) {
      for (const grade of sg.grades) {
        await client
          .insertInto("colegio_version_curricular")
          .values({
            id_colegio: school.id_colegio,
            area: sg.area,
            grado: grade,
            version_curricular: "2016",
          })
          .onConflict((oc) =>
            oc.columns(["id_colegio", "area", "grado"]).doUpdateSet({
              version_curricular: "2016",
            })
          )
          .execute();
      }
    }
  }
  console.log("✅ Proceso de siembra de DBA completado exitosamente.");
}

function distributeDbas(dbasCount: number, periodStates: string[]): number[] {
  const K = periodStates.length;
  const C = periodStates.filter(state => state === "CERRADO").length;

  const counts = periodStates.map(() => 1);
  let remaining = dbasCount - K;

  if (remaining > 0) {
    const weights = periodStates.map(state => {
      if (state === "CERRADO") return 0.20;
      return (1.0 - C * 0.20) / (K - C);
    });

    const finalWeights = (C === 0 || C === K) ? periodStates.map(() => 1 / K) : weights;

    const idealCounts = periodStates.map((_, idx) => {
      return Math.max(1, Math.floor(dbasCount * finalWeights[idx]));
    });

    const assignedSum = idealCounts.reduce((a, b) => a + b, 0);
    let diff = dbasCount - assignedSum;

    for (let idx = 0; idx < K; idx++) {
      counts[idx] = idealCounts[idx];
    }

    let i = 0;
    while (diff > 0) {
      counts[i % K]++;
      diff--;
      i++;
    }
    while (diff < 0) {
      for (let idx = 0; idx < K; idx++) {
        if (counts[idx] > 1) {
          counts[idx]--;
          diff++;
          break;
        }
      }
    }
  } else if (remaining < 0) {
    for (let idx = 0; idx < K; idx++) {
      counts[idx] = idx < dbasCount ? 1 : 0;
    }
  }

  return counts;
}

// ─── SEED DBA COMPETENCIES AND EVIDENCES ──────────────────────────────────────

async function seedDbaCompetenciesAndEvidences(client: DBClient): Promise<void> {
  console.log("\n🧠 Generando competencias y evidencias basadas en DBA oficiales...");

  const dimensiones = await client
    .selectFrom("dimensiones_preescolar")
    .select(["id_dimension", "nombre"])
    .orderBy("id_dimension", "asc")
    .execute();
  const dimComunicativa = dimensiones.find(d => d.nombre === "Comunicativa");

  const schoolsRes = await client.selectFrom("colegio").select(["id_colegio", "nombre"]).execute();

  for (const school of schoolsRes) {
    console.log(`   Colegio: ${school.nombre}`);

    const yearRes = await client
      .selectFrom("anio_lectivo")
      .select("id_anio")
      .where("id_colegio", "=", school.id_colegio)
      .where((eb) => eb.or([eb("calendario", "=", "2025"), eb("calendario", "=", "2024-2025")]))
      .orderBy("id_anio", "asc")
      .limit(1)
      .execute();
    const yearId = yearRes[0]?.id_anio;
    if (!yearId) continue;

    const periods = await client
      .selectFrom("periodo_academico")
      .select(["id_periodo", "nombre", "estado", "trimestre"])
      .where("id_anio", "=", yearId)
      .orderBy("trimestre", "asc")
      .execute();
    if (periods.length === 0) continue;

    const periodStates = periods.map(p => p.estado);

    // Consulta 3NF: id_nivel se obtiene de tipo_grado
    const groupsRes = await client
      .selectFrom("grupos as g")
      .innerJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
      .select(["g.id_grupo", "tg.id_nivel", "g.id_tipo_grado", "tg.nombre as grade_name"])
      .where("g.id_colegio", "=", school.id_colegio)
      .execute();

    const groupsByGrade = new Map<string, typeof groupsRes>();
    for (const group of groupsRes) {
      if (!groupsByGrade.has(group.grade_name)) {
        groupsByGrade.set(group.grade_name, []);
      }
      groupsByGrade.get(group.grade_name)!.push(group);
    }

    const subjects = await client
      .selectFrom("materias")
      .select(["id_materia", "nombre"])
      .where("id_colegio", "=", school.id_colegio)
      .execute();

    for (const [gradeName, gradeGroups] of groupsByGrade.entries()) {
      const isPreescolar = gradeName === "PREJARDIN" || gradeName === "JARDIN" || gradeName === "TRANSICION";

      if (isPreescolar) {
        const devSubject = subjects.find(s => s.nombre === "Desarrollo Integral");
        if (!devSubject) continue;

        if (gradeName === "PREJARDIN" || gradeName === "JARDIN") {
          for (const period of periods) {
            for (const dim of dimensiones) {
              const syncUuid = randomUUID();
              const compDesc = `Desarrollo de habilidades y competencias integrales en la dimensión ${dim.nombre}.`;

              for (const group of gradeGroups) {
                const compInsert = await client
                  .insertInto("competencias")
                  .values({
                    id_anio: yearId,
                    id_grupo: group.id_grupo,
                    id_materia: devSubject.id_materia,
                    id_periodo: period.id_periodo,
                    descripcion: compDesc,
                    id_colegio: school.id_colegio,
                    sync_uuid: syncUuid,
                    id_dimension: dim.id_dimension,
                    nombre: `Competencia Dimensión ${dim.nombre}`,
                  })
                  .returning("id_competencia")
                  .executeTakeFirstOrThrow();

                await client
                  .insertInto("evidencia_aprendizaje")
                  .values([
                    { id_competencia: compInsert.id_competencia, descripcion: `Identifica y explora elementos clave relacionados con la dimensión ${dim.nombre}.`, orden: 1, id_colegio: school.id_colegio },
                    { id_competencia: compInsert.id_competencia, descripcion: `Identifica y explora elementos clave relacionados con la dimensión ${dim.nombre}.`, orden: 2, id_colegio: school.id_colegio },
                    { id_competencia: compInsert.id_competencia, descripcion: `Identifica y explora elementos clave relacionados con la dimensión ${dim.nombre}.`, orden: 3, id_colegio: school.id_colegio },
                  ])
                  .execute();
              }
            }
          }
        } else if (gradeName === "TRANSICION") {
          const dbas = await client
            .selectFrom("dba")
            .select(["id_dba", "numero_dba", "enunciado", "area"])
            .where("area", "=", "Desarrollo Integral")
            .where("grado", "=", "TRANSICION")
            .where("version_curricular", "=", "2016")
            .where("estado", "=", "ACTIVO")
            .orderBy("numero_dba", "asc")
            .execute();

          if (dbas.length > 0) {
            const counts = distributeDbas(dbas.length, periodStates);
            let dbaIdx = 0;

            for (let pIdx = 0; pIdx < periods.length; pIdx++) {
              const period = periods[pIdx];
              const dbaCountForPeriod = counts[pIdx];

              for (let d = 0; d < dbaCountForPeriod; d++) {
                if (dbaIdx >= dbas.length) break;
                const dba = dbas[dbaIdx];
                dbaIdx++;

                const syncUuid = randomUUID();

                let idDimension: number | null = null;
                if (dba.numero_dba >= 100) {
                  if (dbaIdx % 2 === 0 && dimComunicativa) {
                    idDimension = dimComunicativa.id_dimension;
                  }
                } else {
                  if (dbaIdx % 2 === 0) {
                    idDimension = dimensiones[dbaIdx % dimensiones.length].id_dimension;
                  }
                }

                for (const group of gradeGroups) {
                  const compInsert = await client
                    .insertInto("competencias")
                    .values({
                      id_anio: yearId,
                      id_grupo: group.id_grupo,
                      id_materia: devSubject.id_materia,
                      id_periodo: period.id_periodo,
                      descripcion: dba.enunciado,
                      id_colegio: school.id_colegio,
                      sync_uuid: syncUuid,
                      id_dimension: idDimension,
                      nombre: `Competencia DBA #${dba.numero_dba}`,
                    })
                    .returning("id_competencia")
                    .executeTakeFirstOrThrow();

                  const evidencias = await client
                    .selectFrom("evidencias_dba")
                    .select(["id_evidencia_dba", "descripcion", "orden"])
                    .where("id_dba", "=", dba.id_dba)
                    .where("estado", "=", "ACTIVO")
                    .orderBy("orden", "asc")
                    .execute();

                  if (evidencias.length > 0) {
                    for (const ev of evidencias.slice(0, 3)) {
                      await client
                        .insertInto("evidencia_aprendizaje")
                        .values({
                          id_competencia: compInsert.id_competencia,
                          descripcion: ev.descripcion,
                          orden: ev.orden,
                          id_colegio: school.id_colegio,
                          id_evidencia_dba: ev.id_evidencia_dba,
                        })
                        .execute();
                    }
                  } else {
                    await client
                      .insertInto("evidencia_aprendizaje")
                      .values([
                        { id_competencia: compInsert.id_competencia, descripcion: "Desarrolla las evidencias de aprendizaje propuestas para la competencia.", orden: 1, id_colegio: school.id_colegio },
                        { id_competencia: compInsert.id_competencia, descripcion: "Muestra apropiación de las metas de aprendizaje de la unidad.", orden: 2, id_colegio: school.id_colegio },
                        { id_competencia: compInsert.id_competencia, descripcion: "Aplica los desempeños esperados en el contexto institucional.", orden: 3, id_colegio: school.id_colegio },
                      ])
                      .execute();
                  }
                }
              }
            }
          }
        }
      } else {
        // Primaria, Secundaria y Media
        for (const subject of subjects) {
          if (subject.nombre === "Desarrollo Integral") continue;

          const dbas = await client
            .selectFrom("dba")
            .select(["id_dba", "numero_dba", "enunciado", "area"])
            .where("area", "=", subject.nombre)
            .where("grado", "=", gradeName)
            .where("version_curricular", "=", "2016")
            .where("estado", "=", "ACTIVO")
            .orderBy("numero_dba", "asc")
            .execute();

          if (dbas.length > 0) {
            const counts = distributeDbas(dbas.length, periodStates);
            let dbaIdx = 0;

            for (let pIdx = 0; pIdx < periods.length; pIdx++) {
              const period = periods[pIdx];
              const dbaCountForPeriod = counts[pIdx];

              for (let d = 0; d < dbaCountForPeriod; d++) {
                if (dbaIdx >= dbas.length) break;
                const dba = dbas[dbaIdx];
                dbaIdx++;

                const syncUuid = randomUUID();

                for (const group of gradeGroups) {
                  const compInsert = await client
                    .insertInto("competencias")
                    .values({
                      id_anio: yearId,
                      id_grupo: group.id_grupo,
                      id_materia: subject.id_materia,
                      id_periodo: period.id_periodo,
                      descripcion: dba.enunciado,
                      id_colegio: school.id_colegio,
                      sync_uuid: syncUuid,
                      id_dimension: null,
                      nombre: `Competencia DBA #${dba.numero_dba}`,
                    })
                    .returning("id_competencia")
                    .executeTakeFirstOrThrow();

                  const evidencias = await client
                    .selectFrom("evidencias_dba")
                    .select(["id_evidencia_dba", "descripcion", "orden"])
                    .where("id_dba", "=", dba.id_dba)
                    .where("estado", "=", "ACTIVO")
                    .orderBy("orden", "asc")
                    .execute();

                  if (evidencias.length > 0) {
                    for (const ev of evidencias.slice(0, 3)) {
                      await client
                        .insertInto("evidencia_aprendizaje")
                        .values({
                          id_competencia: compInsert.id_competencia,
                          descripcion: ev.descripcion,
                          orden: ev.orden,
                          id_colegio: school.id_colegio,
                          id_evidencia_dba: ev.id_evidencia_dba,
                        })
                        .execute();
                    }
                  } else {
                    await client
                      .insertInto("evidencia_aprendizaje")
                      .values([
                        { id_competencia: compInsert.id_competencia, descripcion: "Comprende y asimila los conceptos temáticos planteados.", orden: 1, id_colegio: school.id_colegio },
                        { id_competencia: compInsert.id_competencia, descripcion: "Resuelve problemas académicos y prácticos de forma autónoma.", orden: 2, id_colegio: school.id_colegio },
                        { id_competencia: compInsert.id_competencia, descripcion: "Demuestra actitud colaborativa y participativa en el aula.", orden: 3, id_colegio: school.id_colegio },
                      ])
                      .execute();
                  }
                }
              }
            }
          }
        }
      }
    }

    // ─── 2026 DEFAULT COMPETENCIES FOR CLOSED PERIODS ───
    const year2026Res = await client
      .selectFrom("anio_lectivo")
      .select("id_anio")
      .where("id_colegio", "=", school.id_colegio)
      .where((eb) => eb.or([eb("calendario", "=", "2026"), eb("calendario", "=", "2025-2026")]))
      .orderBy("id_anio", "asc")
      .limit(1)
      .execute();
    const yearId2026 = year2026Res[0]?.id_anio;

    if (yearId2026) {
      const closedPeriods2026 = await client
        .selectFrom("periodo_academico")
        .select("id_periodo")
        .where("id_anio", "=", yearId2026)
        .where("estado", "=", "CERRADO")
        .orderBy("trimestre", "asc")
        .execute();

      const dg2026Res = await client
        .selectFrom("detalle_grados")
        .select(["id_grupo", "id_materia"])
        .distinct()
        .where("id_colegio", "=", school.id_colegio)
        .where("id_anio", "=", yearId2026)
        .execute();

      for (const period of closedPeriods2026) {
        for (const dg of dg2026Res) {
          if (!dg.id_grupo || !dg.id_materia) continue;

          const exists = await client
            .selectFrom("competencias")
            .select("id_competencia")
            .where("id_anio", "=", yearId2026)
            .where("id_grupo", "=", dg.id_grupo)
            .where("id_materia", "=", dg.id_materia)
            .where("id_periodo", "=", period.id_periodo)
            .executeTakeFirst();

          if (!exists) {
            const syncUuid = randomUUID();
            await client
              .insertInto("competencias")
              .values({
                id_anio: yearId2026,
                id_grupo: dg.id_grupo,
                id_materia: dg.id_materia,
                id_periodo: period.id_periodo,
                descripcion: "Competencia pendiente por definir.",
                id_colegio: school.id_colegio,
                sync_uuid: syncUuid,
                nombre: "Competencia Predeterminada",
              })
              .execute();
          }
        }
      }
    }

    // ─── 2025 PROMOTION DECISIONS SEEDING ───
    const year2025Res = await client
      .selectFrom("anio_lectivo")
      .select("id_anio")
      .where("id_colegio", "=", school.id_colegio)
      .where((eb) => eb.or([eb("calendario", "=", "2025"), eb("calendario", "=", "2024-2025")]))
      .orderBy("id_anio", "asc")
      .limit(1)
      .execute();
    const yearId2025 = year2025Res[0]?.id_anio;

    const directivoUserRes = await client
      .selectFrom("usuario as u")
      .innerJoin("directivo as d", "d.id_usuario", "u.id_usuario")
      .select("u.id_usuario")
      .where("d.id_colegio", "=", school.id_colegio)
      .orderBy("u.id_usuario", "asc")
      .limit(1)
      .execute();
    const directiveUserId = directivoUserRes[0]?.id_usuario || 1;

    if (yearId2025) {
      const maxGradeRes = await client
        .selectFrom("grupos")
        .select((eb) => eb.fn.max("id_tipo_grado").as("max_grade"))
        .where("id_colegio", "=", school.id_colegio)
        .executeTakeFirst();
      const maxGradeId = maxGradeRes?.max_grade;

      const enrollments2025 = await client
        .selectFrom("matricula as m")
        .innerJoin("grupos as g", "g.id_grupo", "m.id_grupo")
        .select(["m.id_estudiante", "m.id_grupo", "g.id_tipo_grado"])
        .where("m.id_colegio", "=", school.id_colegio)
        .where("m.id_anio", "=", yearId2025)
        .where("m.estado", "not in", ["CANCELADA", "RECHAZADA"])
        .execute();

      let graduatedCount = 0;

      for (const enr of enrollments2025) {
        if (!enr.id_estudiante || !enr.id_tipo_grado) continue;
        const studentId = enr.id_estudiante;
        const gradeTypeId = enr.id_tipo_grado;

        const isFinalGradeStudent = maxGradeId != null && gradeTypeId === maxGradeId;

        const existCheck = await client
          .selectFrom("decision_promocion_directivo")
          .select("id_decision")
          .where("id_estudiante", "=", studentId)
          .where("id_anio_anterior", "=", yearId2025)
          .executeTakeFirst();

        if (!existCheck) {
          const assignedGrade = isFinalGradeStudent ? null : gradeTypeId;
          const obs = isFinalGradeStudent
            ? "Estudiante del último año escolar promovido y graduado exitosamente por decisión del Consejo Académico (S.I.E.E. / Decreto 1290)."
            : "Estudiante promovido satisfactoriamente al siguiente grado lectivo por el Consejo Académico.";

          await client
            .insertInto("decision_promocion_directivo")
            .values({
              id_colegio: school.id_colegio,
              id_estudiante: studentId,
              id_anio_anterior: yearId2025,
              resultado_calculado: "APROBADO",
              decision_tomada: "PROMOVER_SIGUIENTE_GRADO",
              id_tipo_grado_anterior: gradeTypeId,
              id_tipo_grado_asignado: assignedGrade,
              id_usuario_decision: directiveUserId,
              observacion: obs,
            })
            .execute();

          if (isFinalGradeStudent) {
            graduatedCount++;
            await client
              .updateTable("estudiante")
              .set({ estado: "GRADUADO" })
              .where("id_estudiante", "=", studentId)
              .execute();

            const checkGrad = await client
              .selectFrom("registro_graduados")
              .select("id_graduado")
              .where("id_estudiante", "=", studentId)
              .executeTakeFirst();

            if (checkGrad) {
              await client
                .updateTable("registro_graduados")
                .set({
                  fecha_graduacion: new Date(),
                  observaciones: "Graduación del último año lectivo procesada en siembra de datos de prueba.",
                  id_usuario_registro: directiveUserId,
                  id_anio: yearId2025!,
                })
                .where("id_estudiante", "=", studentId)
                .execute();
            } else {
              await client
                .insertInto("registro_graduados")
                .values({
                  id_estudiante: studentId,
                  fecha_graduacion: new Date(),
                  observaciones: "Graduación del último año lectivo procesada en siembra de datos de prueba.",
                  id_usuario_registro: directiveUserId,
                  id_anio: yearId2025!,
                })
                .execute();
            }
          }
        }
      }
      console.log(`✅ Decisiones de promoción 2025 registradas para ${enrollments2025.length} estudiantes (${graduatedCount} graduados 🎓) en ${school.nombre}.`);
    }
  }
  console.log("✅ Siembra de competencias y evidencias basada en DBA completada exitosamente.");
}

// ─── MAIN EXECUTION ───────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const credentials: CredentialEntry[] = [];

  try {
    await db.transaction().execute(async (trx) => {
      await sql.raw("SET my.app.bypass_triggers = 'true';").execute(trx);

      // ── Phase 1: Truncate ALL data tables ──
      console.log("🗑️ Reseteando tablas existentes...");
      await truncateExistingTables(trx, [
        // DBA and curriculum
        "actividad_evidencia_dba",
        "colegio_version_curricular",
        "evidencias_dba",
        "dba_dimensiones_preescolar",
        "dba",
        // Attendance
        "registro_asistencia_detalle",
        "registro_asistencia",
        // Academic grades and evaluations
        "resultado_academico",
        "notas_actividad",
        "nota_criterio",
        "criterio_evaluacion",
        "observacion_estudiante",
        "actividad_materia",
        "cierre_materia",
        "evidencia_aprendizaje",
        "competencias",
        // Promotions and Graduations
        "decision_promocion_directivo",
        "registro_graduados",
        // Discipline and sanctions
        "sancion",
        "tipo_sancion",
        // Enrollments
        "documento_matriculas",
        "matricula",
        // Parent details
        "detalle_padrefamilia",
        // Support & Tickets
        "ticket_observaciones",
        "tickets_soporte",
        // Notifications
        "notificacion_colegio",
        "notificacion_supervision",
        // Audits
        "auditoria_acciones_realizadas",
        "auditoria_supervision",
        // Transfers
        "solicitud_traslado",
        "traslado_aprobacion",
        // Academic structure
        "detalle_grados",
        "grupos",
        "tipo_grado",
        "jornada",
        "materias",
        "papelera_materias",
        "nivel_escolar",
        "periodo_academico",
        "anio_lectivo",
        "escala_valoracion",
        "configuracion_inscripcion",
        "configuracion_plataforma",
        // Tokens & Auth
        "tokens_verificacion",
        "codigo_verificacion_email",
        "password_reset_tokens",
        "token_blacklist",
        "usuario_colegio_email",
        "usuario_colegio",
        "usuario_rol",
        // Roles and People
        "directivo",
        "docente",
        "estudiante",
        "padre_familia",
        "usuario",
        "rol",
        "tipo_documento",
        "secciones",
        // Schools
        "colegio",
      ]);

      // ── Phase 2: Insert catalogs ──
      console.log("📋 Insertando catálogos base...");
      const roleIds = await insertRoles(trx);
      await insertDocumentTypes(trx);
      await insertSanctionTypes(trx);
      const sectionIds = await insertSections(trx);

      const directivoHash = await bcrypt.hash(DIRECTIVO_PASSWORD, 10);
      const docenteHash = await bcrypt.hash(DOCENTE_PASSWORD, 10);
      const parentHash = await bcrypt.hash("padre123", 10);
      const studentHash = await bcrypt.hash("estudiante123", 10);

      // ── Phase 3: Admin General ──
      console.log("👑 Creando administrador general...");
      const adminGeneralPassword = "adminGeneral123";
      const adminGeneralHash = await bcrypt.hash(adminGeneralPassword, 10);
      const adminGeneralEmail = "admin.general@academianeiva.edu.co";

      const adminGeneralResult = await trx
        .insertInto("usuario")
        .values({
          email: adminGeneralEmail,
          password: adminGeneralHash,
          nombre: "Admin",
          apellido: "General",
          activo: true,
          estado: "ACTIVO",
          id_tipodocumento: DOCUMENT_TYPE_CC,
          documento: "1000000000",
          telefono: "3000000000",
        })
        .returning("id_usuario")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("usuario_rol")
        .values({ id_usuario: adminGeneralResult.id_usuario, id_rol: roleIds.admin_general })
        .execute();

      // Configuración de la plataforma
      await trx
        .insertInto("configuracion_plataforma")
        .values([
          { clave: "supervision_duracion_minima_minutos", valor: "5" },
          { clave: "supervision_duracion_maxima_minutos", valor: "300" },
        ])
        .onConflict((oc) => oc.column("clave").doNothing())
        .execute();

      credentials.push({
        colegio: "General", seccion: "general", rol: "ADMIN_GENERAL",
        nombre: "Administrador General", correo: adminGeneralEmail, password: adminGeneralPassword,
      });

      // ── Phase 4: Schools (staff) ──
      for (const school of schools) {
        console.log(`🏫 Creando staff para ${school.nombre}...`);
        await insertSchool(trx, school, roleIds, directivoHash, docenteHash, credentials);
      }

      // ── Phase 5: Academic structure ──
      for (const school of schools) {
        console.log(`📚 Creando estructura académica para ${school.nombre}...`);
        await insertSchoolAcademicStructure(trx, school, sectionIds);
      }

      // ── Phase 6: Enrollment configs ──
      await seedEnrollmentConfigs(trx);

      // ── Phase 7: Students and parents ──
      for (const school of schools) {
        console.log(`👨‍👩‍👧‍👦 Creando estudiantes y padres para ${school.nombre}...`);
        await insertStudentsAndParents(trx, school, roleIds, parentHash, studentHash, credentials);
      }

      // ── Phase 8: Sample attendance ──
      console.log("📅 Generando registros de asistencia de prueba...");
      await insertSampleAttendance(trx);

      // ── Phase 9: Seed Admin General Supervisions ──
      console.log("🕵️ Generando supervisiones de auditoría del Administrador General...");
      const adminGenId = adminGeneralResult.id_usuario;
      const directivosRes = await trx
        .selectFrom("directivo")
        .select(["id", "id_colegio"])
        .distinctOn("id_colegio")
        .execute();

      for (const d of directivosRes) {
        await trx
          .insertInto("auditoria_supervision")
          .values({
            id_admin_general: adminGenId,
            id_colegio: d.id_colegio,
            id_directivo_aprobador: d.id,
            motivo_solicitud: "Revisión rutinaria de calificaciones y planeación curricular",
            tipo_supervision: "SOLO_LECTURA",
            estado_supervision: "FINALIZADA",
            fecha_aprobacion: sql`NOW() - INTERVAL '2 days'`,
            motivo_entrada: "Entrada autorizada para auditoría semestral",
            fecha_entrada: sql`NOW() - INTERVAL '2 days'`,
            fecha_salida: sql`NOW() - INTERVAL '2 days' + INTERVAL '45 minutes'`,
            duracion_maxima_minutos: 60,
          })
          .execute();
      }

      // ── Phase 10: Sync database sequences ──
      console.log("🔄 Sincronizando secuencias de base de datos...");
      await sql.raw(`
        SELECT setval(pg_get_serial_sequence('colegio', 'id_colegio'), COALESCE(MAX(id_colegio), 1)) FROM colegio;
        SELECT setval(pg_get_serial_sequence('tipo_documento', 'id_tipodocumento'), COALESCE(MAX(id_tipodocumento), 1)) FROM tipo_documento;
        SELECT setval(pg_get_serial_sequence('usuario', 'id_usuario'), COALESCE(MAX(id_usuario), 1)) FROM usuario;
        SELECT setval(pg_get_serial_sequence('directivo', 'id'), COALESCE(MAX(id), 1)) FROM directivo;
        SELECT setval(pg_get_serial_sequence('docente', 'id_docente'), COALESCE(MAX(id_docente), 1)) FROM docente;
        SELECT setval(pg_get_serial_sequence('estudiante', 'id_estudiante'), COALESCE(MAX(id_estudiante), 1)) FROM estudiante;
        SELECT setval(pg_get_serial_sequence('padre_familia', 'id_padrefamilia'), COALESCE(MAX(id_padrefamilia), 1)) FROM padre_familia;
        SELECT setval(pg_get_serial_sequence('registro_asistencia', 'id_registroasistencia'), COALESCE(MAX(id_registroasistencia), 1)) FROM registro_asistencia;
        SELECT setval(pg_get_serial_sequence('registro_asistencia_detalle', 'id_asistencia_detalle'), COALESCE(MAX(id_asistencia_detalle), 1)) FROM registro_asistencia_detalle;
        SELECT setval(pg_get_serial_sequence('configuracion_inscripcion', 'id_configuracion'), COALESCE(MAX(id_configuracion), 1)) FROM configuracion_inscripcion;
        SELECT setval(pg_get_serial_sequence('auditoria_supervision', 'id_auditoria'), COALESCE(MAX(id_auditoria), 1)) FROM auditoria_supervision;
      `).execute(trx);

      console.log("✅ Transacción principal completada.");

      // ── Phase 11: Seeding DBA Catalog and curriculums ──
      await seedDbaCatalog(trx);

      // ── Phase 12: Seeding Competencies and Evidences based on DBA ──
      await seedDbaCompetenciesAndEvidences(trx);
    });

    // ── Phase 13: Write credentials ──
    const credentialsPath = writeCredentialsFile(credentials);
    console.log(`\n🎉 ¡Base de datos reseteada y poblada exitosamente!`);
    console.log(`📄 Credenciales guardadas en: ${credentialsPath}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante el reseteo de la base de datos:", error);
    process.exit(1);
  }
}

run();

