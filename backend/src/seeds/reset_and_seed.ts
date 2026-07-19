import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { PoolClient } from "pg";
import { ensureCompetencySchema } from "../config/competencyMigration";
import { pool } from "../config/db";
import { getPeriodRules, resolveCurrentAcademicPeriodOrder } from "../config/academicCalendarDefaults";

// ─── TYPES ──────────────────────────────────────────────────────────────────────

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

// ─── CONSTANTS ──────────────────────────────────────────────────────────────────

const DOCUMENT_TYPE_CC = 3;
const CURRENT_YEAR = "2026";
const DIRECTIVO_PASSWORD = "directivo123";
const DOCENTE_PASSWORD = "docente123";
const CUPOS_POR_CURSO = 30;
const STUDENTS_PER_GROUP = 5;

// ─── SCHOOL DEFINITIONS ────────────────────────────────────────────────────────

const schools: SchoolSeed[] = [
  { id: 1, nombre: "CEA School Empresarial de los Andes", tipo: "Privado", sede: "Sede Principal", contacto: 3183118044, correo: "rectoria@cea.edu.co", dane: "341001005652", domain: "ceaschool.edu.co", tipo_calendario: "A" },
  { id: 2, nombre: "Institución Educativa El Caguán", tipo: "Oficial", sede: "Sede Principal", contacto: 3180000000, correo: "iecaguan@alcaldianeiva.gov.co", dane: "441001002747", domain: "iecaguan.edu.co", tipo_calendario: "A" },
  { id: 3, nombre: "Colegio Heisenberg Neiva", tipo: "Privado", sede: "Sede Principal", contacto: 3169100003, correo: "colegioheisenberg@hotmail.com", dane: "DANE-H-001", domain: "heisenberg.edu.co", tipo_calendario: "A" },
  { id: 4, nombre: "Colegio Claretiano de Neiva", tipo: "Privado", sede: "Sede Principal", contacto: 3161720175, correo: "admisiones@claretianoneiva.edu.co", dane: "DANE-C-002", domain: "claretianoneiva.edu.co", tipo_calendario: "A" },
  { id: 5, nombre: "Colegio IDESA", tipo: "Privado", sede: "Sede Principal", contacto: 3153077861, correo: "info@colegioidesa.com.co", dane: "DANE-I-003", domain: "colegioidesa.edu.co", tipo_calendario: "A" },
];

// ─── ACADEMIC CATALOGS ──────────────────────────────────────────────────────────

const sectionNames = ["A", "B", "C"];
const jornadaNames = ["MAÑANA", "TARDE", "UNICA"];

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

// ─── STUDENT NAME POOLS (Colombian names) ───────────────────────────────────────

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

// ─── HELPER: SCHOOL CONFIG TABLE ────────────────────────────────────────────────

async function createSchoolConfigTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS configuracion_colegio (
      id_colegio integer PRIMARY KEY REFERENCES colegio(id_colegio) ON DELETE CASCADE,
      nota_minima numeric(5,2) NOT NULL DEFAULT 0,
      nota_maxima numeric(5,2) NOT NULL DEFAULT 5,
      nota_aprobacion numeric(5,2) NOT NULL DEFAULT 3,
      escala_modo varchar(20) NOT NULL DEFAULT 'AUTOMATICO'
    );
  `);
}

async function createEnrollmentConfigTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS configuracion_inscripcion (
      id_configuracion SERIAL PRIMARY KEY,
      id_colegio INTEGER NOT NULL REFERENCES colegio(id_colegio) ON DELETE CASCADE,
      id_anio INTEGER NOT NULL REFERENCES anio_lectivo(id_anio) ON DELETE CASCADE,
      fecha_inicio TIMESTAMPTZ NOT NULL,
      fecha_cierre TIMESTAMPTZ NOT NULL,
      habilitada BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT chk_fechas CHECK (fecha_cierre > fecha_inicio),
      CONSTRAINT uq_colegio_anio UNIQUE (id_colegio, id_anio)
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_config_inscripcion_colegio ON configuracion_inscripcion (id_colegio);
  `);
}

async function seedEnrollmentConfigs(client: PoolClient): Promise<void> {
  const schoolsRes = await client.query('SELECT id_colegio FROM colegio');
  for (const s of schoolsRes.rows) {
    const yearRes = await client.query('SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1', [s.id_colegio]);
    if (yearRes.rows.length > 0) {
      const yearId = yearRes.rows[0].id_anio;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 5); // 5 days ago
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 15); // 15 days from now
      
      await client.query(`
        INSERT INTO configuracion_inscripcion (id_colegio, id_anio, fecha_inicio, fecha_cierre, habilitada)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (id_colegio, id_anio) DO NOTHING
      `, [s.id_colegio, yearId, startDate.toISOString(), endDate.toISOString()]);
    }
  }
}


// ─── HELPER: TRUNCATE TABLES ────────────────────────────────────────────────────

async function truncateExistingTables(client: PoolClient, tables: string[]): Promise<void> {
  const existing = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [tables]
  );
  if (existing.rows.length === 0) return;

  const quotedTables = existing.rows
    .map(({ table_name }) => `"${table_name.replace(/"/g, '""')}"`)
    .join(", ");

  await client.query(`TRUNCATE ${quotedTables} RESTART IDENTITY CASCADE;`);
}

// ─── INSERT BASE CATALOGS ───────────────────────────────────────────────────────

async function insertRoles(client: PoolClient): Promise<Record<string, number>> {
  const roleIds: Record<string, number> = {};
  for (const role of ["admin", "directivo", "docente", "estudiante", "padre", "admin_general"]) {
    const result = await client.query<{ id_rol: number }>(
      `INSERT INTO rol (nombre) VALUES ($1) RETURNING id_rol`,
      [role]
    );
    roleIds[role] = result.rows[0].id_rol;
  }
  return roleIds;
}

async function insertDocumentTypes(client: PoolClient): Promise<void> {
  const documentTypes = [
    { id: 1, tipo: "Registro Civil" },
    { id: 2, tipo: "Tarjeta de Identidad" },
    { id: 3, tipo: "Cédula de Ciudadanía" },
    { id: 4, tipo: "Cédula de Extranjería" },
    { id: 5, tipo: "PEP / PPT" },
  ];
  for (const dt of documentTypes) {
    await client.query(`INSERT INTO tipo_documento (id_tipodocumento, tipo) VALUES ($1, $2)`, [dt.id, dt.tipo]);
  }
}

async function insertSanctionTypes(client: PoolClient): Promise<void> {
  const sanctionTypes = [
    { nombre: 'SUSPENSION_TEMPORAL', descripcion: 'El estudiante es suspendido de clases por un número específico de días.' },
    { nombre: 'MATRICULA_CONDICIONAL', descripcion: 'El estudiante continúa con matrícula bajo compromiso de comportamiento.' },
    { nombre: 'APERCIBIMIENTO', descripcion: 'Advertencia formal por escrito que precede a una sanción mayor.' },
    { nombre: 'EXPULSION', descripcion: 'El estudiante es retirado permanentemente de la institución.' }
  ];
  for (const st of sanctionTypes) {
    await client.query(
      `INSERT INTO tipo_sancion (nombre, descripcion) VALUES ($1, $2) ON CONFLICT (nombre) DO NOTHING`,
      [st.nombre, st.descripcion]
    );
  }
}

async function insertSections(client: PoolClient): Promise<Record<string, number>> {
  const sectionIds: Record<string, number> = {};
  for (const name of sectionNames) {
    const result = await client.query<{ id_seccion: number }>(
      `INSERT INTO secciones (nombre) VALUES ($1) RETURNING id_seccion`,
      [name]
    );
    sectionIds[name] = result.rows[0].id_seccion;
  }
  return sectionIds;
}

// ─── INSERT SCHOOL BASE (Directivos + Docentes) ────────────────────────────────

async function insertSchool(
  client: PoolClient,
  school: SchoolSeed,
  roleIds: Record<string, number>,
  directivoHash: string,
  docenteHash: string,
  credentials: CredentialEntry[]
): Promise<void> {
  await client.query(
    `INSERT INTO colegio (id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [school.id, school.nombre, school.tipo, school.sede, school.contacto, school.correo, school.dane]
  );

  // --- Rector ---
  const rectorEmail = `rector@${school.domain}`;
  const rectorRes = await client.query<{ id_usuario: number }>(
    `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING id_usuario`,
    [rectorEmail, directivoHash, "Rector", school.nombre, school.id]
  );
  const rectorUserId = rectorRes.rows[0].id_usuario;
  await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [rectorUserId, roleIds.directivo]);
  await client.query(`INSERT INTO directivo (id_colegio, id_usuario, cargo) VALUES ($1, $2, $3)`, [school.id, rectorUserId, "RECTOR"]);

  credentials.push({
    colegio: school.nombre, seccion: "staff", rol: "DIRECTIVO",
    nombre: `Rector ${school.nombre}`, correo: rectorEmail, password: DIRECTIVO_PASSWORD,
  });

  // --- Coordinador ---
  const directivoEmail = `directivo@${school.domain}`;
  const directivoResult = await client.query<{ id_usuario: number }>(
    `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING id_usuario`,
    [directivoEmail, directivoHash, "Directivo", school.nombre, school.id]
  );
  const directivoUserId = directivoResult.rows[0].id_usuario;
  await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [directivoUserId, roleIds.directivo]);
  await client.query(`INSERT INTO directivo (id_colegio, id_usuario, cargo) VALUES ($1, $2, $3)`, [school.id, directivoUserId, "COORDINADOR"]);

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

    const userResult = await client.query<{ id_usuario: number }>(
      `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id_usuario`,
      [email, docenteHash, teacher.firstName, fullLastName, school.id]
    );
    const teacherUserId = userResult.rows[0].id_usuario;
    await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [teacherUserId, roleIds.docente]);
    await client.query(
      `INSERT INTO docente (nombre, apellido, documento, id_tipodocumento, id_colegio, id_usuario)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [teacher.firstName, fullLastName, `DOC-${school.id}-${String(index + 1).padStart(2, "0")}`, DOCUMENT_TYPE_CC, school.id, teacherUserId]
    );

    credentials.push({
      colegio: school.nombre, seccion: "staff", rol: "DOCENTE",
      nombre: `${teacher.firstName} ${fullLastName}`, correo: email, password: DOCENTE_PASSWORD, materia: teacher.subject,
    });
  }
}

// ─── INSERT ACADEMIC STRUCTURE ──────────────────────────────────────────────────

async function insertSchoolAcademicStructure(
  client: PoolClient,
  school: SchoolSeed,
  sectionIds: Record<string, number>
): Promise<void> {
  const levelIdsByName: Record<string, number> = {};
  const subjectIdsByName: Record<string, number> = {};
  const teacherIdsBySubject: Record<string, number> = {};
  const allGroupIds: number[] = [];
  const groupGradesMap = new Map<number, string>();

  // --- Calendar type column ---
  await client.query(`ALTER TABLE colegio ADD COLUMN IF NOT EXISTS tipo_calendario CHAR(1) DEFAULT 'A';`);
  await client.query(`UPDATE colegio SET tipo_calendario = $1 WHERE id_colegio = $2`, [school.tipo_calendario, school.id]);
  await client.query(`ALTER TABLE anio_lectivo ADD COLUMN IF NOT EXISTS tipo_calendario CHAR(1) DEFAULT 'A';`);

  const yearLabel = school.tipo_calendario === "B" ? `${parseInt(CURRENT_YEAR) - 1}-${CURRENT_YEAR}` : CURRENT_YEAR;
  const academicYearResult = await client.query<{ id_anio: number }>(
    `INSERT INTO anio_lectivo (calendario, id_colegio, tipo_calendario) VALUES ($1, $2, $3) RETURNING id_anio`,
    [yearLabel, school.id, school.tipo_calendario]
  );
  const academicYearId = academicYearResult.rows[0].id_anio;

  // --- Levels ---
  for (const levelSeed of levelSeeds) {
    const levelResult = await client.query<{ id_nivel: number }>(
      `INSERT INTO nivel_escolar (nombre, id_colegio) VALUES ($1, $2) RETURNING id_nivel`,
      [levelSeed.nombre, school.id]
    );
    levelIdsByName[levelSeed.nombre] = levelResult.rows[0].id_nivel;
  }

  // --- Jornadas ---
  const jornadaIdsByName: Record<string, number> = {};
  for (const jornadaName of jornadaNames) {
    const result = await client.query<{ id_jornada: number }>(
      `INSERT INTO jornada (nombre, id_colegio) VALUES ($1, $2) RETURNING id_jornada`,
      [jornadaName, school.id]
    );
    jornadaIdsByName[jornadaName] = result.rows[0].id_jornada;
  }

  // --- Periods ---
  const periodRules = getPeriodRules(school.tipo_calendario);
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12

  for (const periodSeed of periodSeeds) {
    const monthRule = periodRules.find((r) => r.order === periodSeed.trimestre);
    const startMonth = monthRule?.startMonth ?? 1;
    const endMonth = monthRule?.endMonth ?? 12;

    let calculadoEstado: 'CERRADO' | 'ABIERTO' | 'PENDIENTE' = 'PENDIENTE';

    if (school.tipo_calendario === 'A') {
      if (currentMonth > endMonth) {
        calculadoEstado = 'CERRADO';
      } else if (currentMonth >= startMonth && currentMonth <= endMonth) {
        calculadoEstado = 'ABIERTO';
      } else {
        calculadoEstado = 'PENDIENTE';
      }
    } else {
      // Calendario B
      const currentOrder = resolveCurrentAcademicPeriodOrder(currentDate, 'B') ?? 2;
      if (periodSeed.trimestre < currentOrder) {
        calculadoEstado = 'CERRADO';
      } else if (periodSeed.trimestre === currentOrder) {
        calculadoEstado = 'ABIERTO';
      } else {
        calculadoEstado = 'PENDIENTE';
      }
    }

    await client.query(
      `INSERT INTO periodo_academico (nombre, estado, porcentaje, trimestre, id_anio, id_colegio, mes_inicio, mes_fin, dia_inicio, dia_fin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [periodSeed.nombre, calculadoEstado, periodSeed.porcentaje, periodSeed.trimestre, academicYearId, school.id,
       monthRule?.startMonth ?? null, monthRule?.endMonth ?? null, 1, 28]
    );
  }

  // --- Escala de Valoración ---
  for (const scaleSeed of scaleSeeds) {
    await client.query(
      `INSERT INTO escala_valoracion (nivel, valor_minimo, valor_maximo, id_colegio) VALUES ($1, $2, $3, $4)`,
      [scaleSeed.nivel, scaleSeed.min, scaleSeed.max, school.id]
    );
  }

  // --- Config Colegio ---
  await client.query(
    `INSERT INTO configuracion_colegio (id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo)
     VALUES ($1, 0, 5, 3, 'AUTOMATICO')`,
    [school.id]
  );

  // --- Get docentes for subject assignment ---
  const teachersRes = await client.query<{ id_docente: number }>(
    `SELECT id_docente FROM docente WHERE id_colegio = $1 ORDER BY id_docente`,
    [school.id]
  );
  teacherSeeds.forEach((teacher, index) => {
    teacherIdsBySubject[teacher.subject] = teachersRes.rows[index].id_docente;
  });

  // --- Subjects ---
  for (const teacher of teacherSeeds) {
    const subjectResult = await client.query<{ id_materia: number }>(
      `INSERT INTO materias (nombre, id_colegio) VALUES ($1, $2) RETURNING id_materia`,
      [teacher.subject, school.id]
    );
    subjectIdsByName[teacher.subject] = subjectResult.rows[0].id_materia;
  }

  // --- Materia especial: Desarrollo Integral (Preescolar) ---
  const desIntegralResult = await client.query<{ id_materia: number }>(
    `INSERT INTO materias (nombre, id_colegio) VALUES ($1, $2) RETURNING id_materia`,
    ["Desarrollo Integral", school.id]
  );
  subjectIdsByName["Desarrollo Integral"] = desIntegralResult.rows[0].id_materia;
  teacherIdsBySubject["Desarrollo Integral"] = teachersRes.rows[0].id_docente;

  // --- Grupos + Grados + Tipo Grado ---
  let teacherRotationIdx = 0;
  for (const levelSeed of levelSeeds) {
    const levelId = levelIdsByName[levelSeed.nombre];

    for (const gradeName of levelSeed.grades) {
      const gradeTypeResult = await client.query<{ id_tipo_grado: number }>(
        `INSERT INTO tipo_grado (nombre, id_nivel) VALUES ($1, $2) RETURNING id_tipo_grado`,
        [gradeName, levelId]
      );
      const gradeTypeId = gradeTypeResult.rows[0].id_tipo_grado;

      for (const jornadaName of jornadaNames) {
        const jornadaId = jornadaIdsByName[jornadaName];

        for (const sectionName of sectionNames) {
          const sectionId = sectionIds[sectionName];

          // Rotate titular docente (no uniqueness constraint)
          const titularId = teachersRes.rows[teacherRotationIdx % teachersRes.rows.length].id_docente;
          teacherRotationIdx++;

          const groupResult = await client.query<{ id_grupo: number }>(
            `INSERT INTO grupos (id_nivel, id_jornada, id_colegio, id_seccion, cupos_totales, id_tipo_grado, id_docente)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_grupo`,
            [levelId, jornadaId, school.id, sectionId, CUPOS_POR_CURSO, gradeTypeId, titularId]
          );
          const gid = groupResult.rows[0].id_grupo;
          allGroupIds.push(gid);
          groupGradesMap.set(gid, gradeName);

          await client.query(
            `INSERT INTO grados (nivel, tipo_grado, id_jornada, id_colegio, cupos_totales, seccion)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [levelSeed.nombre, gradeName, jornadaId, school.id, CUPOS_POR_CURSO, sectionName]
          );
        }
      }
    }
  }

  // --- Detalle Grados (assign all subjects+teachers to all groups) ---
  for (const groupId of allGroupIds) {
    const gradeName = groupGradesMap.get(groupId);
    const isPreescolar = gradeName === "PREJARDIN" || gradeName === "JARDIN" || gradeName === "TRANSICION";

    if (isPreescolar) {
      await client.query(
        `INSERT INTO detalle_grados (id_materia, id_docente, id_colegio, id_grupo) VALUES ($1, $2, $3, $4)`,
        [subjectIdsByName["Desarrollo Integral"], teacherIdsBySubject["Desarrollo Integral"], school.id, groupId]
      );
    } else {
      for (const teacher of teacherSeeds) {
        await client.query(
          `INSERT INTO detalle_grados (id_materia, id_docente, id_colegio, id_grupo) VALUES ($1, $2, $3, $4)`,
          [subjectIdsByName[teacher.subject], teacherIdsBySubject[teacher.subject], school.id, groupId]
        );
      }
    }
  }
}

// ─── INSERT STUDENTS AND PARENTS (5 per MAÑANA-A group) ─────────────────────────

async function insertStudentsAndParents(
  client: PoolClient,
  school: SchoolSeed,
  roleIds: Record<string, number>,
  parentHash: string,
  studentHash: string,
  credentials: CredentialEntry[]
): Promise<void> {
  // Get academic year
  const yearsRes = await client.query<{ id_anio: number }>('SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1', [school.id]);
  const yearId = yearsRes.rows[0]?.id_anio;
  if (!yearId) return;

  // Get a directivo of the school
  const directivoRes = await client.query<{ id: number }>('SELECT id FROM directivo WHERE id_colegio = $1 LIMIT 1', [school.id]);
  const directivoId = directivoRes.rows[0]?.id;

  // Fetch teachers of the school to map them as parents (60% target)
  const teachersRes = await client.query<{ id_usuario: number; email: string; nombre: string; apellido: string }>(
    `SELECT u.id_usuario, u.email, u.nombre, u.apellido 
     FROM usuario u
     JOIN docente d ON u.id_usuario = d.id_usuario
     WHERE u.id_colegio = $1`,
    [school.id]
  );
  const teachersList = teachersRes.rows;
  const targetDocentesPadresCount = Math.ceil(teachersList.length * 0.6);
  let docentesPadresIndex = 0;

  // Get groups for MAÑANA + A, B, C (42 groups: 3 per grade type)
  const groupsRes = await client.query<{ id_grupo: number; id_nivel: number }>(
    `SELECT g.id_grupo, g.id_nivel
     FROM grupos g
     JOIN jornada j ON g.id_jornada = j.id_jornada
     JOIN secciones s ON g.id_seccion = s.id_seccion
     WHERE g.id_colegio = $1 AND j.nombre = 'MAÑANA' AND s.nombre IN ('A', 'B', 'C')
     ORDER BY g.id_grupo`,
    [school.id]
  );
  const groups = groupsRes.rows;
  if (groups.length === 0) return;

  let globalStudentIdx = 0;
  let parentIdx = 0;
  let currentParentId: number | null = null;
  let currentParentEmail = "";
  let currentParentChildNames: string[] = [];

  // Helper: flush parent credentials
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

      // ── Determine student state ──
      let studentState: "ACTIVO" | "SANCIONADO" | "EXPULSADO" | "RETIRADO" = "ACTIVO";
      let enrollmentState: "ACTIVA" | "CANCELADA" = "ACTIVA";
      let motivoCancelacion: string | null = null;
      let motivoEstado: string | null = null;
      let userActive = true;

      if (globalStudentIdx % 20 === 5) {
        studentState = "SANCIONADO";
        motivoEstado = "Incumplimiento reiterado de las normas de convivencia escolar.";
        // Sanctioned: still enrolled, can still log in
      } else if (globalStudentIdx % 20 === 10) {
        studentState = "EXPULSADO";
        enrollmentState = "CANCELADA";
        motivoCancelacion = "EXPULSION";
        motivoEstado = "Falta grave contra la integridad de la comunidad educativa.";
        userActive = false; // Blocked from login
      } else if (globalStudentIdx % 20 === 15) {
        studentState = "RETIRADO";
        enrollmentState = "CANCELADA";
        motivoCancelacion = "RETIRO_VOLUNTARIO";
        // Retired: user stays active but enrollment cancelled
      }

      // ── Create parent every 2 students ──
      if ((globalStudentIdx - 1) % 2 === 0) {
        flushParent();
        parentIdx++;
        currentParentChildNames = [];

        let parentUserId: number;
        let pName: string;
        let pLastName: string;
        let pDoc: string;

        if (docentesPadresIndex < targetDocentesPadresCount) {
          // Reutilizar un docente existente del colegio
          const teacherUser = teachersList[docentesPadresIndex];
          parentUserId = teacherUser.id_usuario;
          currentParentEmail = teacherUser.email;
          pName = teacherUser.nombre;
          pLastName = teacherUser.apellido;
          pDoc = `P-DOC-${school.id}-${docentesPadresIndex + 1}`;
          docentesPadresIndex++;

          // Asignar el rol de padre a este docente (si no lo tiene ya)
          await client.query(
            `INSERT INTO usuario_rol (id_usuario, id_rol) 
             VALUES ($1, $2) 
             ON CONFLICT (id_usuario, id_rol) DO NOTHING`,
            [parentUserId, roleIds.padre]
          );
        } else {
          // Crear un padre normal desde cero
          currentParentEmail = `padre${parentIdx}.${school.id}@${school.domain}`;
          pName = `Padre ${parentIdx}`;
          pLastName = school.nombre;
          pDoc = `P-${school.id}-${parentIdx}`;

          const pUserRes = await client.query<{ id_usuario: number }>(
            `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo)
             VALUES ($1, $2, $3, $4, $5, true) RETURNING id_usuario`,
            [currentParentEmail, parentHash, pName, pLastName, school.id]
          );
          parentUserId = pUserRes.rows[0].id_usuario;
          await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [parentUserId, roleIds.padre]);
        }

        const pFamRes = await client.query<{ id_padrefamilia: number }>(
          `INSERT INTO padre_familia (nombre, apellido, documento, id_tipodocumento, id_colegio, id_usuario)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_padrefamilia`,
          [pName, pLastName, pDoc, DOCUMENT_TYPE_CC, school.id, parentUserId]
        );
        currentParentId = pFamRes.rows[0].id_padrefamilia;
      }

      // ── Student name from pools ──
      const fIdx = (globalStudentIdx - 1) % studentFirstNames.length;
      const lIdx = Math.floor((globalStudentIdx - 1) / studentFirstNames.length) % studentLastNames.length;
      const firstName = studentFirstNames[fIdx];
      const lastName = studentLastNames[lIdx];
      const fullName = `${firstName} ${lastName}`;
      currentParentChildNames.push(fullName);

      const studentEmail = `est${globalStudentIdx}.${school.id}@${school.domain}`;
      const studentCode = `EST-${school.id}-${globalStudentIdx}`;

      // ── Create student user ──
      const sUserRes = await client.query<{ id_usuario: number }>(
        `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_usuario`,
        [studentEmail, studentHash, firstName, lastName, school.id, userActive]
      );
      const studentUserId = sUserRes.rows[0].id_usuario;
      await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [studentUserId, roleIds.estudiante]);

      // ── Create student record with estado ──
      const estRes = await client.query<{ id_estudiante: number }>(
        `INSERT INTO estudiante (nombre, apellido, documento, codigo, id_tipodocumento, id_nivel, id_colegio, id_usuario, estado, motivo_estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::estado_estudiante, $10) RETURNING id_estudiante`,
        [firstName, lastName, `E-${school.id}-${globalStudentIdx}`, studentCode, 1, group.id_nivel, school.id, studentUserId, studentState, motivoEstado]
      );
      const idEstudiante = estRes.rows[0].id_estudiante;

      if (studentState === "SANCIONADO" && directivoId) {
        const typeRes = await client.query<{ id_tipo_sancion: number }>(
          `SELECT id_tipo_sancion FROM tipo_sancion WHERE nombre = 'SUSPENSION_TEMPORAL' LIMIT 1`
        );
        const tipoSancionId = typeRes.rows[0]?.id_tipo_sancion;
        if (tipoSancionId) {
          await client.query(
            `INSERT INTO sancion (id_estudiante, id_tipo_sancion, motivo, fecha_inicio, fecha_fin, estado, id_directivo)
             VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'ACTIVA', $4)`,
            [idEstudiante, tipoSancionId, motivoEstado, directivoId]
          );
        }
      }

      if (studentState === "EXPULSADO" && directivoId) {
        const typeRes = await client.query<{ id_tipo_sancion: number }>(
          `SELECT id_tipo_sancion FROM tipo_sancion WHERE nombre = 'EXPULSION' LIMIT 1`
        );
        const tipoSancionId = typeRes.rows[0]?.id_tipo_sancion;
        if (tipoSancionId) {
          await client.query(
            `INSERT INTO sancion (id_estudiante, id_tipo_sancion, motivo, fecha_inicio, fecha_fin, estado, id_directivo)
             VALUES ($1, $2, $3, CURRENT_DATE, '9999-12-31', 'ACTIVA', $4)`,
            [idEstudiante, tipoSancionId, motivoEstado, directivoId]
          );
        }
      }

      // ── Link parent ──
      await client.query(
        `INSERT INTO detalle_padrefamilia (id_padrefamilia, id_estudiante, id_colegio) VALUES ($1, $2, $3)`,
        [currentParentId, idEstudiante, school.id]
      );

      // ── Enroll ──
      await client.query(
        `INSERT INTO matricula (id_estudiante, id_nivel, id_colegio, id_anio, estado, correo_padre, id_grupo, motivo_cancelacion)
         VALUES ($1, $2, $3, $4, $5::estado_matricula, $6, $7, $8)`,
        [idEstudiante, group.id_nivel, school.id, yearId, enrollmentState, currentParentEmail, group.id_grupo, motivoCancelacion]
      );

      // ── Credential (skip expelled) ──
      const rolLabel = studentState === "ACTIVO" ? "ESTUDIANTE"
        : studentState === "SANCIONADO" ? "ESTUDIANTE (SANCIONADO)"
        : studentState === "RETIRADO" ? "ESTUDIANTE (RETIRADO)"
        : null; // EXPULSADO → no credential

      if (rolLabel) {
        credentials.push({
          colegio: school.nombre, seccion: "familia", rol: rolLabel,
          nombre: fullName, correo: studentEmail, codigo: studentCode, password: "estudiante123",
        });
      }
    }
  }

  // Flush the last parent
  flushParent();

  console.log(
    `   ✅ ${school.nombre}: ${globalStudentIdx} estudiantes (${parentIdx} padres) en ${groups.length} grupos`
  );
}

// ─── INSERT SAMPLE ATTENDANCE (lightweight) ─────────────────────────────────────

async function insertSampleAttendance(client: PoolClient): Promise<void> {
  const justifications = [
    "Cita médica", "Calamidad doméstica", "Gripe común", "Evento institucional", "Retraso transporte",
  ];

  // Only enrolled + ACTIVA students
  const enrollmentRes = await client.query(`
    SELECT m.id_estudiante, m.id_colegio, m.id_grupo, al.id_anio
    FROM matricula m
    JOIN anio_lectivo al ON m.id_anio = al.id_anio
    WHERE m.estado = 'ACTIVA'
  `);

  const batchValues: any[] = [];

  for (const enrollment of enrollmentRes.rows) {
    const { id_estudiante, id_colegio, id_grupo, id_anio } = enrollment;

    const dgRes = await client.query(
      `SELECT id_detallegrado FROM detalle_grados WHERE id_grupo = $1 AND id_colegio = $2`,
      [id_grupo, id_colegio]
    );
    if (dgRes.rows.length === 0) continue;

     const periodsRes = await client.query(
       `SELECT id_periodo, mes_inicio FROM periodo_academico WHERE id_colegio = $1 AND id_anio = $2 AND estado = 'CERRADO'`,
       [id_colegio, id_anio]
     );

    // Generate 5 sample dates per period (first 5 weekdays of the period's start month)
    for (const period of periodsRes.rows) {
      const mes = period.mes_inicio || 1;
      let daysGenerated = 0;

      for (let d = 1; d <= 28 && daysGenerated < 5; d++) {
        const date = new Date(2026, mes - 1, d);
        const dow = date.getDay();
        if (dow === 0 || dow === 6) continue; // skip weekends
        daysGenerated++;

        const dateStr = `2026-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

        for (const dg of dgRes.rows) {
          const rand = Math.random();
          let estado = "PRESENTE";
          let justificacion = null;
          let hora_llegada = null;

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

async function flushAttendanceBatch(client: PoolClient, batch: any[]) {
  const values = batch
    .map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`)
    .join(",");
  const params = batch.flatMap((r) => [r.id_estudiante, r.id_detallegrado, r.fecha, r.estado, r.justificacion, r.id_colegio, r.hora_llegada]);

  await client.query(
    `INSERT INTO registro_asistencia (id_estudiante, id_detallegrado, fecha, estado, justificacion, id_colegio, hora_llegada) VALUES ${values}`,
    params
  );
}

// ─── WRITE CREDENTIALS FILE ─────────────────────────────────────────────────────

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

  // Admin General
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

    // Staff
    lines.push("### 👤 Personal Institucional (login: correo + contraseña)", "");
    lines.push("| Rol | Nombre | Correo | Contraseña | Materia |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const c of staffCreds) lines.push(`| ${c.rol} | ${c.nombre} | ${c.correo} | ${c.password} | ${c.materia ?? "-"} |`);
    lines.push("");

    // Parents
    const padres = familiaCreds.filter((e) => e.rol === "PADRE");
    if (padres.length > 0) {
      lines.push("### 👨‍👩‍👧 Padres de Familia (login: correo + contraseña)", "");
      lines.push("| Rol | Correo | Contraseña | Hijos asociados |");
      lines.push("| --- | --- | --- | --- |");
      for (const c of padres) lines.push(`| ${c.rol} | ${c.correo} | ${c.password} | ${c.hijos?.join(", ") ?? "-"} |`);
      lines.push("");
    }

    // Students
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

// ─── MAIN EXECUTION ─────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const client = await pool.connect();
  const credentials: CredentialEntry[] = [];

  try {
    // Ensure PENDIENTE exists in estado_periodo enum (outside transaction block)
    const enumCheck = await client.query(`
      SELECT 1 FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname = 'estado_periodo' AND e.enumlabel = 'PENDIENTE'
    `);
    if (enumCheck.rows.length === 0) {
      console.log("Adding 'PENDIENTE' to estado_periodo enum...");
      await client.query("ALTER TYPE estado_periodo ADD VALUE 'PENDIENTE'");
    }

    // Ensure DISCIPLINARIA exists in tipo_observacion enum if the type exists (outside transaction block)
    const tipoObsCheck = await client.query(`
      SELECT 1 FROM pg_type t 
      WHERE t.typname = 'tipo_observacion'
    `);
    if (tipoObsCheck.rows.length > 0) {
      const enumValCheck = await client.query(`
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'tipo_observacion' AND e.enumlabel = 'DISCIPLINARIA'
      `);
      if (enumValCheck.rows.length === 0) {
        console.log("Adding 'DISCIPLINARIA' to tipo_observacion enum...");
        await client.query("ALTER TYPE tipo_observacion ADD VALUE 'DISCIPLINARIA'");
      }
    }

    await client.query("BEGIN");
    await client.query("SET my.app.bypass_triggers = 'true';");

    // ── Phase 1: Ensure base schema ──
    console.log("📦 Asegurando estructura base...");
    const authSql = fs.readFileSync(path.join(__dirname, "../config/auth.migration.sql"), "utf8");
    await client.query(authSql);

    console.log("📦 Aplicando migración de Administrador General...");
    const adminGeneralMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/001_admin_general.sql"), "utf8");
    await client.query(adminGeneralMigrationSql);
    await createSchoolConfigTable(client);
    await createEnrollmentConfigTable(client);

    console.log("📦 Aplicando migración 002 (enums, constraints y views)...");
    const fixEnumsMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/002_fix_enums_and_constraints.sql"), "utf8");
    await client.query(fixEnumsMigrationSql);

    console.log("📦 Aplicando migración 003 (padre multicolegio)...");
    const multicolegioMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/003_padre_multicolegio.sql"), "utf8");
    await client.query(multicolegioMigrationSql);

    console.log("📦 Aplicando migración 004 (recuperación de contraseña)...");
    const passwordResetMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/004_password_reset.sql"), "utf8");
    await client.query(passwordResetMigrationSql);

    console.log("📦 Aplicando migración 005 (protección de periodos cerrados)...");
    const protectClosedPeriodsMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/005_protect_closed_periods.sql"), "utf8");
    await client.query(protectClosedPeriodsMigrationSql);

    console.log("📦 Aplicando migración 006 (motivo de revocación)...");
    const addMotivoRevocacionMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/006_add_motivo_revocacion.sql"), "utf8");
    await client.query(addMotivoRevocacionMigrationSql);

    console.log("📦 Aplicando migración 010 (motivo_estado en estudiante)...");
    const addMotivoEstadoMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/010_add_student_motivo_estado.sql"), "utf8");
    await client.query(addMotivoEstadoMigrationSql);

    console.log("📦 Aplicando migración 011 (tablas de sanción)...");
    const createSancionTablesMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/011_create_sancion_tables.sql"), "utf8");
    await client.query(createSancionTablesMigrationSql);

    console.log("📦 Aplicando migración 012 (soporte de expulsión en sanciones)...");
    const addExpulsionSanctionMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/012_add_expulsion_sanction.sql"), "utf8");
    await client.query(addExpulsionSanctionMigrationSql);

    console.log("📦 Aplicando migración 013 (dimensiones preescolar y mapeo de DBA)...");
    const addPreschoolDimensionsMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/013_dimensiones_preescolar.sql"), "utf8");
    await client.query(addPreschoolDimensionsMigrationSql);

    console.log("📦 Aplicando migración 014 (tickets de soporte técnico)...");
    const addSupportTicketsMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/014_soporte_tecnico.sql"), "utf8");
    await client.query(addSupportTicketsMigrationSql);

    console.log("📦 Aplicando migración 015 (observaciones y códigos de soporte)...");
    const addObservationsSupportMigrationSql = fs.readFileSync(path.join(__dirname, "../migrations/015_observaciones_tickets.sql"), "utf8");
    await client.query(addObservationsSupportMigrationSql);

    // ── Phase 2: Schema migrations ──
    console.log("🔧 Migrando columnas adicionales...");
    await client.query(`ALTER TABLE grados ADD COLUMN IF NOT EXISTS seccion VARCHAR(10) DEFAULT 'A';`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS trimestre integer;`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS dia_inicio integer;`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS dia_fin integer;`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS mes_inicio integer;`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS mes_fin integer;`);

    // Add cargo column to directivo
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='directivo' AND column_name='cargo') THEN
          ALTER TABLE public.directivo ADD COLUMN cargo character varying(100);
        END IF;
      END $$;
    `);

    // Add id_docente column to grupos
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grupos' AND column_name='id_docente') THEN
          ALTER TABLE public.grupos ADD COLUMN id_docente integer REFERENCES docente(id_docente);
        END IF;
      END $$;
    `);

    // DROP the unique_titular_docente constraint (it prevents docentes from being titular of multiple groups)
    await client.query(`ALTER TABLE public.grupos DROP CONSTRAINT IF EXISTS unique_titular_docente;`);

    // Expand calendario column length
    await client.query(`ALTER TABLE public.anio_lectivo ALTER COLUMN calendario TYPE VARCHAR(10);`);

    // Add tipo column to observacion_estudiante
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='observacion_estudiante' AND column_name='tipo') THEN
          ALTER TABLE public.observacion_estudiante ADD COLUMN tipo character varying(20) DEFAULT 'ACADEMICA';
        END IF;
      END $$;
    `);

    // ── Phase 3: Truncate ALL data tables ──
    console.log("🗑️ Reseteando tablas existentes...");
    await truncateExistingTables(client, [
      // DBA catalog & mappings (truncated first because of foreign keys)
      "colegio_version_curricular",
      "dba_dimensiones_preescolar",
      "evidencias_dba",
      "dba",
      // Academic data
      "resultado_academico",
      "notas_actividad",
      "nota_criterio",
      "criterio_evaluacion",
      "observacion_estudiante",
      "actividad_materia",
      "cierre_materia",
      "desempeno",
      "evidencia_aprendizaje",
      "competencias",
      "registro_asistencia",
      // Enrollment
      "documento_matriculas",
      "matricula",
      // People
      "sancion",
      "tipo_sancion",
      "detalle_padrefamilia",
      "padre_familia",
      "estudiante",
      "docente",
      "directivo",
      "contrato_docente",
      // Academic structure
      "detalle_grados",
      "grados",
      "grupos",
      "tipo_grado",
      "jornada",
      "materias",
      "nivel_escolar",
      "periodo_academico",
      "anio_lectivo",
      "escala_valoracion",
      "configuracion_colegio",
      "configuracion_inscripcion",
      // Auth
      "usuario_rol",
      "usuario",
      "rol",
      "tipo_documento",
      "secciones",
      // Schools
      "colegio",
    ]);

    // ── Phase 4: Insert catalogs ──
    console.log("📋 Insertando catálogos base...");
    const roleIds = await insertRoles(client);
    await insertDocumentTypes(client);
    await insertSanctionTypes(client);
    const sectionIds = await insertSections(client);

    const directivoHash = await bcrypt.hash(DIRECTIVO_PASSWORD, 10);
    const docenteHash = await bcrypt.hash(DOCENTE_PASSWORD, 10);
    const parentHash = await bcrypt.hash("padre123", 10);
    const studentHash = await bcrypt.hash("estudiante123", 10);

    // ── Phase 5: Admin General ──
    console.log("👑 Creando administrador general...");
    const adminGeneralPassword = "adminGeneral123";
    const adminGeneralHash = await bcrypt.hash(adminGeneralPassword, 10);
    const adminGeneralEmail = "admin.general@academianeiva.edu.co";
    const adminGeneralResult = await client.query<{ id_usuario: number }>(
      `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo, estado)
       VALUES ($1, $2, $3, $4, NULL, true, 'ACTIVO') RETURNING id_usuario`,
      [adminGeneralEmail, adminGeneralHash, "Admin", "General"]
    );
    await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [
      adminGeneralResult.rows[0].id_usuario,
      roleIds.admin_general,
    ]);
    
    // Sembrar valores por defecto para la configuración de la plataforma (Duración de Supervisiones)
    await client.query(`
      INSERT INTO configuracion_plataforma (clave, valor)
      VALUES 
        ('supervision_duracion_minima_minutos', '5'),
        ('supervision_duracion_maxima_minutos', '300')
      ON CONFLICT (clave) DO NOTHING;
    `);

    credentials.push({
      colegio: "General", seccion: "general", rol: "ADMIN_GENERAL",
      nombre: "Administrador General", correo: adminGeneralEmail, password: adminGeneralPassword,
    });

    // ── Phase 6: Schools (staff) ──
    for (const school of schools) {
      console.log(`🏫 Creando staff para ${school.nombre}...`);
      await insertSchool(client, school, roleIds, directivoHash, docenteHash, credentials);
    }

    // ── Phase 7: Academic structure ──
    for (const school of schools) {
      console.log(`📚 Creando estructura académica para ${school.nombre}...`);
      await insertSchoolAcademicStructure(client, school, sectionIds);
    }

    // ── Phase 7.5: Enrollment configs ──
    await seedEnrollmentConfigs(client);

    // ── Phase 8: Students and parents (5 per MAÑANA-A group) ──
    for (const school of schools) {
      console.log(`👨‍👩‍👧‍👦 Creando estudiantes y padres para ${school.nombre}...`);
      await insertStudentsAndParents(client, school, roleIds, parentHash, studentHash, credentials);
    }

    // ── Phase 9: Sample attendance ──
    console.log("📅 Generando registros de asistencia de prueba...");
    await insertSampleAttendance(client);

    // ── Phase 9.5: Seed Admin General Supervisions ──
    console.log("🕵️ Generando supervisiones de auditoría del Administrador General...");
    const adminGenId = adminGeneralResult.rows[0].id_usuario;
    const directivosRes = await client.query(`SELECT DISTINCT ON (id_colegio) id, id_colegio FROM directivo`);
    for (const d of directivosRes.rows) {
      await client.query(`
        INSERT INTO auditoria_supervision (
          id_admin_general, id_colegio, id_directivo_aprobador, motivo_solicitud,
          tipo_supervision, estado_supervision, fecha_aprobacion, motivo_entrada,
          fecha_entrada, fecha_salida, duracion_maxima_minutos
        ) VALUES (
          $1, $2, $3, 'Revisión rutinaria de calificaciones y planeación curricular',
          'SOLO_LECTURA'::tipo_supervision, 'FINALIZADA'::estado_supervision, NOW() - INTERVAL '2 days',
          'Entrada autorizada para auditoría semestral', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes', 60
        )
      `, [adminGenId, d.id_colegio, d.id]);
    }

    // ── Phase 10: Sync sequences ──
    console.log("🔄 Sincronizando secuencias de base de datos...");
    await client.query(`
      SELECT setval(pg_get_serial_sequence('colegio', 'id_colegio'), COALESCE(MAX(id_colegio), 1)) FROM colegio;
      SELECT setval(pg_get_serial_sequence('tipo_documento', 'id_tipodocumento'), COALESCE(MAX(id_tipodocumento), 1)) FROM tipo_documento;
      SELECT setval(pg_get_serial_sequence('auditoria_supervision', 'id_auditoria'), COALESCE(MAX(id_auditoria), 1)) FROM auditoria_supervision;
    `);

    await client.query("COMMIT");
    console.log("✅ Transacción principal completada.");

    // ── Phase 10.5: Seeding DBA Catalog and curriculums ──
    await seedDbaCatalog();

    // ── Phase 10.6: Seeding Competencies and Evidences based on DBA ──
    await seedDbaCompetenciesAndEvidences();

    // ── Phase 11: Competency schema (outside transaction) ──
    console.log("🧠 Sincronizando esquema de competencias de respaldo...");
    await ensureCompetencySchema();

    // ── Phase 13: Write credentials ──
    const credentialsPath = writeCredentialsFile(credentials);

    // ── Phase 14: Populate academic grades ──
    console.log("\n📊 Generando calificaciones y datos académicos de prueba...");
    try {
      execSync("npm run seed:grades", { stdio: "inherit", cwd: path.resolve(__dirname, "../..") });
    } catch (err) {
      console.error("⚠️ Error al generar calificaciones:", err);
    }

    // ── Summary ──
    const totalStudents = schools.length * 42 * STUDENTS_PER_GROUP;
    const expelled = credentials.filter(() => false).length; // Not in credentials
    console.log(`\n🎉 Base de datos reseteada correctamente para ${schools.length} colegios.`);
    console.log(`   📊 Estudiantes totales: ${totalStudents} (${STUDENTS_PER_GROUP}/grupo × 42 grupos × ${schools.length} colegios)`);
    console.log(`   ⚠️  ~5% SANCIONADOS, ~5% EXPULSADOS, ~5% RETIRADOS`);
    console.log(`   📄 Credenciales: ${credentialsPath}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error durante el reseteo de la base de datos:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

async function seedDbaCatalog(): Promise<void> {
  console.log("\n🌱 Iniciando importación y siembra del catálogo de DBA...");

  const dbaPdfs = [
    { pdf: "../guides/DBA/DBA_matematicas.pdf", area: "Matemáticas", version: "2016", startPage: 8, script: "importar_dba.py" },
    { pdf: "../guides/DBA/DBA_lenguaje.pdf", area: "Español", version: "2016", startPage: 8, script: "importar_dba.py" },
    { pdf: "../guides/DBA/DBA_naturales.pdf", area: "Ciencias Naturales", version: "2016", startPage: 8, script: "importar_dba.py" },
    { pdf: "../guides/DBA/DBA_sociales.pdf", area: "Ciencias Sociales", version: "2016", startPage: 8, script: "importar_dba.py" },
    { pdf: "../guides/DBA/DBA_transicion.pdf", area: "Desarrollo Integral", version: "2016", startPage: 8, script: "importar_dba.py" },
    { pdf: "../guides/DBA/dba_ingles_transicion_quinto.pdf", area: "Inglés", version: "2016", startPage: 8, script: "importar_dba_primaria_ingles.py" },
    { pdf: "../guides/DBA/DBA_ingles_sexto_once.pdf", area: "Inglés", version: "2016", startPage: 15, script: "importar_dba.py" }
  ];

  // 1. Ejecutar importaciones de Python
  for (const item of dbaPdfs) {
    console.log(`⏳ Importando ${item.area} desde ${item.pdf} (pág. ${item.startPage})...`);
    try {
      const cmd = `python scripts/${item.script} --pdf ${item.pdf} --area "${item.area}" --version "${item.version}" --start-page ${item.startPage}`;
      execSync(cmd, { stdio: "inherit", cwd: path.resolve(__dirname, "../..") });
    } catch (err) {
      console.error(`❌ Error importando ${item.pdf}:`, err);
    }
  }

  // 2. Realizar consultas para reasignación y mapeo
  const client = await pool.connect();
  try {
    // A. Reasignar DBA de inglés transición a la materia "Desarrollo Integral" sumando 100 a su número para evitar colisión de llave única con los DBA tradicionales de transición
    console.log("🔄 Reasignando DBA de inglés Transición a la materia Desarrollo Integral...");
    await client.query(`
      UPDATE dba 
      SET area = 'Desarrollo Integral',
          numero_dba = numero_dba + 100
      WHERE area = 'Inglés' AND grado = 'TRANSICION' AND version_curricular = '2016'
    `);

    // B. Obtener todos los colegios
    const colegiosRes = await client.query<{ id_colegio: number }>("SELECT id_colegio FROM colegio");
    
    // C. Mapear versión curricular 2016
    console.log("📋 Poblando colegio_version_curricular con versión 2016...");
    const subjectsGrades = [
      { area: "Matemáticas", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
      { area: "Español", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
      { area: "Ciencias Naturales", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
      { area: "Ciencias Sociales", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
      { area: "Inglés", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
      { area: "Desarrollo Integral", grades: ["TRANSICION"] }
    ];

    for (const school of colegiosRes.rows) {
      for (const sg of subjectsGrades) {
        for (const grade of sg.grades) {
          await client.query(`
            INSERT INTO colegio_version_curricular (id_colegio, area, grado, version_curricular)
            VALUES ($1, $2, $3, '2016')
            ON CONFLICT (id_colegio, area, grado) 
            DO UPDATE SET version_curricular = EXCLUDED.version_curricular
          `, [school.id_colegio, sg.area, grade]);
        }
      }
    }
    console.log("✅ Proceso de siembra de DBA completado exitosamente.");
  } catch (err) {
    console.error("❌ Error en base de datos al sembrar DBA:", err);
  } finally {
    client.release();
  }
}

function distributeDbas(dbasCount: number, periodStates: string[]): number[] {
  const K = periodStates.length;
  const C = periodStates.filter(state => state === 'CERRADO').length;
  
  const counts = periodStates.map(() => 1);
  let remaining = dbasCount - K;
  
  if (remaining > 0) {
    const weights = periodStates.map(state => {
      if (state === 'CERRADO') return 0.20;
      return (1.0 - C * 0.20) / (K - C);
    });
    
    const finalWeights = (C === 0 || C === K) ? periodStates.map(() => 1 / K) : weights;
    
    let assignedSum = 0;
    const idealCounts = periodStates.map((_, idx) => {
      return Math.max(1, Math.floor(dbasCount * finalWeights[idx]));
    });
    
    assignedSum = idealCounts.reduce((a, b) => a + b, 0);
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

async function seedDbaCompetenciesAndEvidences(): Promise<void> {
  console.log("\n🧠 Generando competencias y evidencias basadas en DBA oficiales...");
  const client = await pool.connect();

  try {
    // 1. Obtener catálogo de dimensiones de preescolar
    const dimRes = await client.query<{ id_dimension: number; nombre: string }>(
      "SELECT id_dimension, nombre FROM dimensiones_preescolar ORDER BY id_dimension"
    );
    const dimensiones = dimRes.rows;
    const dimComunicativa = dimensiones.find(d => d.nombre === "Comunicativa");

    // 2. Obtener todos los colegios y sus años lectivos
    const schoolsRes = await client.query<{ id_colegio: number; nombre: string }>(
      "SELECT id_colegio, nombre FROM colegio"
    );

    for (const school of schoolsRes.rows) {
      console.log(`   Colegio: ${school.nombre}`);
      
      const yearRes = await client.query<{ id_anio: number }>(
        "SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 ORDER BY id_anio DESC LIMIT 1",
        [school.id_colegio]
      );
      const yearId = yearRes.rows[0]?.id_anio;
      if (!yearId) continue;

      // Obtener periodos del año lectivo, ordenados
      const periodsRes = await client.query<{ id_periodo: number; nombre: string; estado: string; trimestre: number }>(
        "SELECT id_periodo, nombre, estado, trimestre FROM periodo_academico WHERE id_anio = $1 ORDER BY trimestre ASC",
        [yearId]
      );
      const periods = periodsRes.rows;
      if (periods.length === 0) continue;

      const periodStates = periods.map(p => p.estado);
      const C = periodStates.filter(state => state === 'CERRADO').length;

      // Obtener todos los grupos del colegio
      const groupsRes = await client.query<{ id_grupo: number; id_nivel: number; id_tipo_grado: number; grade_name: string }>(
        `SELECT g.id_grupo, g.id_nivel, g.id_tipo_grado, tg.nombre as grade_name
         FROM grupos g
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE g.id_colegio = $1`,
         [school.id_colegio]
      );

      // Agrupar grupos por su grado (tipo_grado)
      const groupsByGrade = new Map<string, typeof groupsRes.rows>();
      for (const group of groupsRes.rows) {
        if (!groupsByGrade.has(group.grade_name)) {
          groupsByGrade.set(group.grade_name, []);
        }
        groupsByGrade.get(group.grade_name)!.push(group);
      }

      // Obtener las materias del colegio
      const subjectsRes = await client.query<{ id_materia: number; nombre: string }>(
        "SELECT id_materia, nombre FROM materias WHERE id_colegio = $1",
        [school.id_colegio]
      );
      const subjects = subjectsRes.rows;

      for (const [gradeName, gradeGroups] of groupsByGrade.entries()) {
        const isPreescolar = gradeName === "PREJARDIN" || gradeName === "JARDIN" || gradeName === "TRANSICION";

        if (isPreescolar) {
          // Preescolar solo ve la materia "Desarrollo Integral"
          const devSubject = subjects.find(s => s.nombre === "Desarrollo Integral");
          if (!devSubject) continue;

          if (gradeName === "PREJARDIN" || gradeName === "JARDIN") {
            // Regla: Prejardín y Jardín no tienen DBA, pero es OBLIGATORIO asociar las competencias a las 6 dimensiones oficiales.
            // Para cada periodo, crearemos una competencia por cada una de las 6 dimensiones.
            for (const period of periods) {
              for (const dim of dimensiones) {
                const syncUuid = randomUUID();
                const compDesc = `Desarrollo de habilidades y competencias integrales en la dimensión ${dim.nombre}.`;

                for (const group of gradeGroups) {
                  const compInsert = await client.query<{ id_competencia: number }>(
                    `INSERT INTO competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension, nombre)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id_competencia`,
                    [yearId, group.id_grupo, devSubject.id_materia, period.id_periodo, compDesc, school.id_colegio, syncUuid, dim.id_dimension, `Competencia Dimensión ${dim.nombre}`]
                  );
                  
                  // Evidencias por defecto relacionadas con la dimensión
                  await client.query(
                    `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
                     VALUES 
                       ($1, $2, 1, $3),
                       ($1, $2, 2, $3),
                       ($1, $2, 3, $3)`,
                    [
                      compInsert.rows[0].id_competencia,
                      `Identifica y explora elementos clave relacionados con la dimensión ${dim.nombre}.`,
                      school.id_colegio
                    ]
                  );
                }
              }
            }
          } else if (gradeName === "TRANSICION") {
            // Regla: Transición tiene DBA de Desarrollo Integral y DBA de Inglés Transición reasignado a Desarrollo Integral.
            // La asignación de dimensiones para Transición es OPCIONAL.
            const dbasRes = await client.query<{ id_dba: number; numero_dba: number; enunciado: string; area: string }>(
              `SELECT id_dba, numero_dba, enunciado, area 
               FROM dba 
               WHERE area = 'Desarrollo Integral' AND grado = 'TRANSICION' AND version_curricular = '2016' AND estado = 'ACTIVO'
               ORDER BY numero_dba ASC`
            );
            const dbas = dbasRes.rows;

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
                  
                  // Decidir opcionalidad de dimensión: 50% de las competencias llevan dimensión, el otro 50% no.
                  // Si el DBA es de inglés (tiene numero_dba >= 100), la dimensión es Comunicativa
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
                    const compInsert = await client.query<{ id_competencia: number }>(
                      `INSERT INTO competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension, nombre)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id_competencia`,
                      [
                        yearId,
                        group.id_grupo,
                        devSubject.id_materia,
                        period.id_periodo,
                        dba.enunciado,
                        school.id_colegio,
                        syncUuid,
                        idDimension,
                        `Competencia DBA #${dba.numero_dba}`
                      ]
                    );

                    // Poblar evidencias oficiales del DBA
                    const evRes = await client.query<{ id_evidencia_dba: number; descripcion: string; orden: number }>(
                      "SELECT id_evidencia_dba, descripcion, orden FROM evidencias_dba WHERE id_dba = $1 AND estado = 'ACTIVO' ORDER BY orden ASC",
                      [dba.id_dba]
                    );
                    const evidencias = evRes.rows;

                    if (evidencias.length > 0) {
                      for (const ev of evidencias) {
                        await client.query(
                          `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio, id_evidencia_dba)
                           VALUES ($1, $2, $3, $4, $5)`,
                          [compInsert.rows[0].id_competencia, ev.descripcion, ev.orden, school.id_colegio, ev.id_evidencia_dba]
                        );
                      }
                    } else {
                      await client.query(
                        `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
                         VALUES 
                           ($1, 'Desarrolla las evidencias de aprendizaje propuestas para la competencia.', 1, $2),
                           ($1, 'Muestra apropiación de las metas de aprendizaje de la unidad.', 2, $2),
                           ($1, 'Aplica los desempeños esperados en el contexto institucional.', 3, $2)`,
                        [compInsert.rows[0].id_competencia, school.id_colegio]
                      );
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

            // Obtener DBAs para este grado y materia
            const dbasRes = await client.query<{ id_dba: number; numero_dba: number; enunciado: string; area: string }>(
              `SELECT id_dba, numero_dba, enunciado, area 
               FROM dba 
               WHERE area = $1 AND grado = $2 AND version_curricular = '2016' AND estado = 'ACTIVO'
               ORDER BY numero_dba ASC`,
              [subject.nombre, gradeName]
            );
            const dbas = dbasRes.rows;

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
                    const compInsert = await client.query<{ id_competencia: number }>(
                      `INSERT INTO competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension, nombre)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8) RETURNING id_competencia`,
                      [
                        yearId,
                        group.id_grupo,
                        subject.id_materia,
                        period.id_periodo,
                        dba.enunciado,
                        school.id_colegio,
                        syncUuid,
                        `Competencia DBA #${dba.numero_dba}`
                      ]
                    );

                    // Poblar evidencias oficiales del DBA
                    const evRes = await client.query<{ id_evidencia_dba: number; descripcion: string; orden: number }>(
                      "SELECT id_evidencia_dba, descripcion, orden FROM evidencias_dba WHERE id_dba = $1 AND estado = 'ACTIVO' ORDER BY orden ASC",
                      [dba.id_dba]
                    );
                    const evidencias = evRes.rows;

                    if (evidencias.length > 0) {
                      for (const ev of evidencias) {
                        await client.query(
                          `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio, id_evidencia_dba)
                           VALUES ($1, $2, $3, $4, $5)`,
                          [compInsert.rows[0].id_competencia, ev.descripcion, ev.orden, school.id_colegio, ev.id_evidencia_dba]
                        );
                      }
                    } else {
                      await client.query(
                        `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
                         VALUES 
                           ($1, 'Comprende y asimila los conceptos temáticos planteados.', 1, $2),
                           ($1, 'Resuelve problemas académicos y prácticos de forma autónoma.', 2, $2),
                           ($1, 'Demuestra actitud colaborativa y participativa en el aula.', 3, $2)`,
                        [compInsert.rows[0].id_competencia, school.id_colegio]
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    console.log("✅ Siembra de competencias y evidencias basada en DBA completada exitosamente.");
  } catch (err) {
    console.error("❌ Error al sembrar competencias basadas en DBA:", err);
  } finally {
    client.release();
  }
}

run();
