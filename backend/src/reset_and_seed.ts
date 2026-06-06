import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { PoolClient } from "pg";
import { ensureCompetencySchema } from "./config/competencyMigration";
import { pool } from "./config/db";
import { DEFAULT_ACADEMIC_PERIOD_MONTH_RULES } from "./config/academicCalendarDefaults";

type SchoolSeed = {
  id: number;
  nombre: string;
  tipo: string;
  sede: string;
  contacto: number;
  correo: string;
  dane: string;
  domain: string;
};

type TeacherSeed = {
  firstName: string;
  lastName: string;
  subject: string;
};

type CredentialEntry = {
  colegio: string;
  seccion: "staff" | "familia";
  rol: string;
  nombre: string;
  correo: string;
  password: string;
  materia?: string;
  codigo?: string;  // For students
  hijos?: string[]; // For parents
};

const DOCUMENT_TYPE_CC = 3;
const CURRENT_YEAR = "2026";
const DIRECTIVO_PASSWORD = "directivo123";
const DOCENTE_PASSWORD = "docente123";
const CUPOS_POR_CURSO = 30;

const schools: SchoolSeed[] = [
  {
    id: 1,
    nombre: "CEA School Empresarial de los Andes",
    tipo: "Privado",
    sede: "Sede Principal",
    contacto: 3183118044,
    correo: "rectoria@ceaschool.edu.co",
    dane: "341001005652",
    domain: "ceaschool.edu.co",
  },
  {
    id: 2,
    nombre: "Institución Educativa El Caguán",
    tipo: "Oficial",
    sede: "Sede Principal",
    contacto: 3180000000,
    correo: "iecaguan@alcaldianeiva.gov.co",
    dane: "441001002747",
    domain: "iecaguan.edu.co",
  },
  {
    id: 3,
    nombre: "Colegio Heisenberg Neiva",
    tipo: "Privado",
    sede: "Sede Principal",
    contacto: 3169100003,
    correo: "colegioheisenberg@hotmail.com",
    dane: "DANE-H-001",
    domain: "heisenberg.edu.co",
  },
  {
    id: 4,
    nombre: "Colegio Claretiano de Neiva",
    tipo: "Privado",
    sede: "Sede Principal",
    contacto: 3161720175,
    correo: "admisiones@claretianoneiva.edu.co",
    dane: "DANE-C-002",
    domain: "claretianoneiva.edu.co",
  },
  {
    id: 5,
    nombre: "Colegio IDESA",
    tipo: "Privado",
    sede: "Sede Principal",
    contacto: 3153077861,
    correo: "info@colegioidesa.com.co",
    dane: "DANE-I-003",
    domain: "colegioidesa.edu.co",
  },
];

const sectionNames = ["A", "B"];
const jornadaNames = ["MAÑANA", "TARDE", "UNICA"];
const periodSeeds = [
  { nombre: "Primer Periodo", estado: "CERRADO", porcentaje: 25, trimestre: 1 },
  { nombre: "Segundo Periodo", estado: "ABIERTO", porcentaje: 25, trimestre: 2 },
  { nombre: "Tercer Periodo", estado: "CERRADO", porcentaje: 25, trimestre: 3 },
  { nombre: "Cuarto Periodo", estado: "CERRADO", porcentaje: 25, trimestre: 4 },
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

async function truncateExistingTables(client: PoolClient, tables: string[]): Promise<void> {
  const existing = await client.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [tables]
  );

  if (existing.rows.length === 0) {
    return;
  }

  const quotedTables = existing.rows
    .map(({ table_name }) => `"${table_name.replace(/"/g, "\"\"")}"`)
    .join(", ");

  await client.query(`TRUNCATE ${quotedTables} RESTART IDENTITY CASCADE;`);
}

async function insertRoles(client: PoolClient): Promise<Record<string, number>> {
  const roleIds: Record<string, number> = {};

  for (const role of ["admin", "directivo", "docente", "estudiante", "padre"]) {
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

  for (const documentType of documentTypes) {
    await client.query(
      `INSERT INTO tipo_documento (id_tipodocumento, tipo) VALUES ($1, $2)`,
      [documentType.id, documentType.tipo]
    );
  }
}

async function insertSections(client: PoolClient): Promise<Record<string, number>> {
  const sectionIds: Record<string, number> = {};

  for (const sectionName of sectionNames) {
    const result = await client.query<{ id_seccion: number }>(
      `INSERT INTO secciones (nombre) VALUES ($1) RETURNING id_seccion`,
      [sectionName]
    );
    sectionIds[sectionName] = result.rows[0].id_seccion;
  }

  return sectionIds;
}

async function insertSchool(
  client: PoolClient,
  school: SchoolSeed,
  roleIds: Record<string, number>,
  directivoHash: string,
  docenteHash: string,
  credentials: CredentialEntry[]
): Promise<void> {
  await client.query(
    `
      INSERT INTO colegio (id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [school.id, school.nombre, school.tipo, school.sede, school.contacto, school.correo, school.dane]
  );

  const directivoEmail = `directivo@${school.domain}`;
  const directivoResult = await client.query<{ id_usuario: number }>(
    `
      INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id_usuario
    `,
    [directivoEmail, directivoHash, "Directivo", school.nombre, school.id]
  );
  const directivoUserId = directivoResult.rows[0].id_usuario;

  await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [
    directivoUserId,
    roleIds.directivo,
  ]);
  await client.query(
    `INSERT INTO directivo (id_colegio, id_usuario, cargo) VALUES ($1, $2, $3)`,
    [school.id, directivoUserId, "COORDINADOR"]
  );

  // --- Crear Rector Institucional ---
  const rectorEmail = `rector@${school.domain}`;
  const rectorRes = await client.query<{ id_usuario: number }>(
    `
      INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id_usuario
    `,
    [rectorEmail, directivoHash, "Rector", school.nombre, school.id]
  );
  const rectorUserId = rectorRes.rows[0].id_usuario;

  await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [
    rectorUserId,
    roleIds.directivo,
  ]);
  await client.query(
    `INSERT INTO directivo (id_colegio, id_usuario, cargo) VALUES ($1, $2, $3)`,
    [school.id, rectorUserId, "RECTOR"]
  );

    credentials.push({
      colegio: school.nombre,
      seccion: "staff",
      rol: "DIRECTIVO",
      nombre: `Rector ${school.nombre}`,
      correo: rectorEmail,
      password: DIRECTIVO_PASSWORD,
    });

    credentials.push({
      colegio: school.nombre,
      seccion: "staff",
      rol: "DIRECTIVO",
      nombre: `Directivo ${school.nombre}`,
      correo: directivoEmail,
      password: DIRECTIVO_PASSWORD,
    });

  for (let index = 0; index < teacherSeeds.length; index++) {
    const teacher = teacherSeeds[index];
    const alias = teacher.subject
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase();
    const email = `${alias}.${school.id}@${school.domain}`;
    const fullLastName = `${teacher.lastName} ${school.id}`;
    const userResult = await client.query<{ id_usuario: number }>(
      `
        INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id_usuario
      `,
      [email, docenteHash, teacher.firstName, fullLastName, school.id]
    );

    const teacherUserId = userResult.rows[0].id_usuario;
    await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [
      teacherUserId,
      roleIds.docente,
    ]);
    await client.query(
      `
        INSERT INTO docente (nombre, apellido, documento, id_tipodocumento, id_colegio, id_usuario)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        teacher.firstName,
        fullLastName,
        `DOC-${school.id}-${String(index + 1).padStart(2, "0")}`,
        DOCUMENT_TYPE_CC,
        school.id,
        teacherUserId,
      ]
    );

    credentials.push({
      colegio: school.nombre,
      seccion: "staff",
      rol: "DOCENTE",
      nombre: `${teacher.firstName} ${fullLastName}`,
      correo: email,
      password: DOCENTE_PASSWORD,
      materia: teacher.subject,
    });
  }
}

async function insertParentsAndStudents(
  client: PoolClient,
  school: SchoolSeed,
  roleIds: Record<string, number>,
  parentHash: string,
  studentHash: string,
  credentials: CredentialEntry[]
): Promise<void> {
  const yearsRes = await client.query<{ id_año: number }>('SELECT "id_año" FROM "año_lectivo" WHERE id_colegio = $1', [school.id]);
  const yearId = yearsRes.rows[0]?.id_año;

  const groupsRes = await client.query<{ id_grupo: number; id_nivel: number }>(
    "SELECT id_grupo, id_nivel FROM grupos WHERE id_colegio = $1 LIMIT 5",
    [school.id]
  );
  const groups = groupsRes.rows;

  if (groups.length === 0) return;

  for (let pIdx = 1; pIdx <= 3; pIdx++) {
    const parentEmail = `padre${pIdx}.${school.id}@${school.domain}`;
    const parentName = `Padre ${pIdx} ${school.nombre}`;
    
    // Create Parent User
    const pUserRes = await client.query<{ id_usuario: number }>(
      `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo) VALUES ($1, $2, $3, $4, $5, true) RETURNING id_usuario`,
      [parentEmail, parentHash, `Padre ${pIdx}`, school.nombre, school.id]
    );
    const parentUserId = pUserRes.rows[0].id_usuario;
    await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [parentUserId, roleIds.padre]);

    // Create Parent Record
    const pFamRes = await client.query<{ id_padrefamilia: number }>(
      `INSERT INTO padre_familia (nombre, apellido, documeno, id_tipodocumento, id_colegio, id_usuario) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_padrefamilia`,
      [`Padre ${pIdx}`, school.nombre, `P-${school.id}-${pIdx}`, DOCUMENT_TYPE_CC, school.id, parentUserId]
    );
    const idPadreFamilia = pFamRes.rows[0].id_padrefamilia;

    const childrenNames: string[] = [];

    // Create 3 Children for each parent
    for (let cIdx = 1; cIdx <= 3; cIdx++) {
      const studentIdx = (pIdx - 1) * 3 + cIdx;
      const studentEmail = `estudiante${studentIdx}.${school.id}@${school.domain}`;
      const studentName = `Estudiante ${studentIdx} ${school.nombre}`;
      childrenNames.push(studentName);

      // Select a group (cycling through the first 5 groups)
      const group = groups[(studentIdx - 1) % groups.length];

      // Create Student User
      const sUserRes = await client.query<{ id_usuario: number }>(
        `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo) VALUES ($1, $2, $3, $4, $5, true) RETURNING id_usuario`,
        [studentEmail, studentHash, `Estudiante ${studentIdx}`, school.nombre, school.id]
      );
      const studentUserId = sUserRes.rows[0].id_usuario;
      await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [studentUserId, roleIds.estudiante]);

      // Create Student Record
      const estRes = await client.query<{ id_estudiante: number }>(
        `INSERT INTO estudiante (nombre, apellido, documento, codigo, id_tipodocumento, id_nivel, id_colegio, id_usuario) VALUES ($1, $2, $3, $4, 1, $5, $6, $7) RETURNING id_estudiante`,
        [`Estudiante ${studentIdx}`, school.nombre, `E-${school.id}-${studentIdx}`, `EST-${school.id}-${studentIdx}`, group.id_nivel, school.id, studentUserId]
      );
      const idEstudiante = estRes.rows[0].id_estudiante;

      // Link Parent and Child
      await client.query(
        `INSERT INTO detalle_padrefamilia (id_padrefamilia, id_estudiante, id_colegio) VALUES ($1, $2, $3)`,
        [idPadreFamilia, idEstudiante, school.id]
      );

      // Enrol student
      if (yearId) {
        await client.query(
          `INSERT INTO matricula (id_estudiante, id_nivel, id_colegio, "id_año", estado, correo_padre, id_grupo) VALUES ($1, $2, $3, $4, 'ACTIVA', $5, $6)`,
          [idEstudiante, group.id_nivel, school.id, yearId, parentEmail, group.id_grupo]
        );
      }
      // Push student credentials
      credentials.push({
        colegio: school.nombre,
        seccion: "familia",
        rol: "ESTUDIANTE",
        nombre: `Estudiante ${studentIdx} ${school.nombre}`,
        correo: studentEmail,
        codigo: `EST-${school.id}-${studentIdx}`,
        password: "estudiante123",
      });
    }

    credentials.push({
      colegio: school.nombre,
      seccion: "familia",
      rol: "PADRE",
      nombre: `Padre ${pIdx} ${school.nombre}`,
      correo: parentEmail,
      password: "padre123",
      hijos: childrenNames,
    });
  }
}

async function insertSchoolAcademicStructure(
  client: PoolClient,
  school: SchoolSeed,
  sectionIds: Record<string, number>
): Promise<void> {
  const levelIdsByName: Record<string, number> = {};
  const subjectIdsByName: Record<string, number> = {};
  const teacherIdsBySubject: Record<string, number> = {};
  const groupIds: number[] = [];

  const academicYearResult = await client.query<{ id_año: number }>(
    `
      INSERT INTO "año_lectivo" (calendario, id_colegio)
      VALUES ($1, $2)
      RETURNING "id_año"
    `,
    [CURRENT_YEAR, school.id]
  );
  const academicYearId = academicYearResult.rows[0].id_año;

  for (const levelSeed of levelSeeds) {
    const levelResult = await client.query<{ id_nivel: number }>(
      `
        INSERT INTO nivel_escolar (nombre, id_colegio)
        VALUES ($1, $2)
        RETURNING id_nivel
      `,
      [levelSeed.nombre, school.id]
    );
    levelIdsByName[levelSeed.nombre] = levelResult.rows[0].id_nivel;
  }

  const jornadaIds: number[] = [];
  for (const jornadaName of jornadaNames) {
    const result = await client.query<{ id_jornada: number }>(
      `
        INSERT INTO jornada (nombre, id_colegio)
        VALUES ($1, $2)
        RETURNING id_jornada
      `,
      [jornadaName, school.id]
    );
    jornadaIds.push(result.rows[0].id_jornada);
  }

  for (const periodSeed of periodSeeds) {
    const monthRule = DEFAULT_ACADEMIC_PERIOD_MONTH_RULES.find(r => r.order === periodSeed.trimestre);
    
    await client.query(
      `
        INSERT INTO periodo_academico (nombre, estado, porcentaje, trimestre, "id_año", id_colegio, mes_inicio, mes_fin, dia_inicio, dia_fin)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        periodSeed.nombre, 
        periodSeed.estado, 
        periodSeed.porcentaje, 
        periodSeed.trimestre, 
        academicYearId, 
        school.id,
        monthRule?.startMonth ?? null,
        monthRule?.endMonth ?? null,
        1, // dia_inicio
        28 // dia_fin (simplified)
      ]
    );
  }

  for (const scaleSeed of scaleSeeds) {
    await client.query(
      `
        INSERT INTO escala_valoracion (nivel, valor_minimo, valor_maximo, id_colegio)
        VALUES ($1, $2, $3, $4)
      `,
      [scaleSeed.nivel, scaleSeed.min, scaleSeed.max, school.id]
    );
  }

  await client.query(
    `
      INSERT INTO configuracion_colegio (id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo)
      VALUES ($1, 0, 5, 3, 'AUTOMATICO')
    `,
    [school.id]
  );

  const teachersRes = await client.query<{ id_docente: number; nombre: string; apellido: string }>(
    `
      SELECT id_docente, nombre, apellido
      FROM docente
      WHERE id_colegio = $1
      ORDER BY id_docente
    `,
    [school.id]
  );

  teacherSeeds.forEach((teacher, index) => {
    teacherIdsBySubject[teacher.subject] = teachersRes.rows[index].id_docente;
  });

  for (const teacher of teacherSeeds) {
    const subjectResult = await client.query<{ id_materia: number }>(
      `
        INSERT INTO materias (nombre, id_colegio)
        VALUES ($1, $2)
        RETURNING id_materia
      `,
      [teacher.subject, school.id]
    );
    subjectIdsByName[teacher.subject] = subjectResult.rows[0].id_materia;
  }

  const teachersResForTitular = await client.query<{ id_docente: number }>(
    "SELECT id_docente FROM docente WHERE id_colegio = $1",
    [school.id]
  );
  let teacherIndexForTitular = 0;

  for (const levelSeed of levelSeeds) {
    const levelId = levelIdsByName[levelSeed.nombre];

    for (const gradeName of levelSeed.grades) {
      const gradeTypeResult = await client.query<{ id_tipo_grado: number }>(
        `
          INSERT INTO tipo_grado (nombre, id_nivel)
          VALUES ($1, $2)
          RETURNING id_tipo_grado
        `,
        [gradeName, levelId]
      );
      const gradeTypeId = gradeTypeResult.rows[0].id_tipo_grado;

      for (const jornadaId of jornadaIds) {
        for (const sectionName of sectionNames) {
          const sectionId = sectionIds[sectionName];
          // Asignar un Titular Único
          const titularId = teachersResForTitular.rows[teacherIndexForTitular]?.id_docente || null;
          teacherIndexForTitular++;

          const groupResult = await client.query<{ id_grupo: number }>(
            `
              INSERT INTO grupos (id_nivel, id_jornada, id_colegio, id_seccion, cupos_totales, id_tipo_grado, id_docente)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id_grupo
            `,
            [levelId, jornadaId, school.id, sectionId, CUPOS_POR_CURSO, gradeTypeId, titularId]
          );
          groupIds.push(groupResult.rows[0].id_grupo);

          await client.query(
            `
              INSERT INTO grados (nivel, tipo_grado, id_jornada, id_colegio, cupos_totales, seccion)
              VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [levelSeed.nombre, gradeName, jornadaId, school.id, CUPOS_POR_CURSO, sectionName]
          );
        }
      }
    }
  }

  for (const groupId of groupIds) {
    for (const teacher of teacherSeeds) {
      await client.query(
        `
          INSERT INTO detalle_grados (id_materia, id_docente, id_colegio, id_grupo)
          VALUES ($1, $2, $3, $4)
        `,
        [subjectIdsByName[teacher.subject], teacherIdsBySubject[teacher.subject], school.id, groupId]
      );
    }
  }
}

async function insertSampleAttendance(client: PoolClient): Promise<void> {
  const enrollmentRes = await client.query(`
    SELECT m.id_estudiante, m.id_colegio, m.id_grupo, al."id_año"
    FROM matricula m
    JOIN "año_lectivo" al ON m."id_año" = al."id_año"
    WHERE m.estado = 'ACTIVA'
  `);

  const justifications = [
    "Cita médica", "Calamidad doméstica", "Gripe común", "Evento institucional", "Retraso transporte"
  ];

  for (const enrollment of enrollmentRes.rows) {
    const { id_estudiante, id_colegio, id_grupo, id_año } = enrollment;

    const dgRes = await client.query(`
      SELECT id_detallegrado 
      FROM detalle_grados 
      WHERE id_grupo = $1 AND id_colegio = $2
    `, [id_grupo, id_colegio]);

    if (dgRes.rows.length === 0) continue;

    const periodsRes = await client.query(`
      SELECT id_periodo, mes_inicio, mes_fin, dia_inicio, dia_fin
      FROM periodo_academico 
      WHERE id_colegio = $1 AND "id_año" = $2
    `, [id_colegio, id_año]);

    for (const period of periodsRes.rows) {
      const { mes_inicio, mes_fin, dia_inicio, dia_fin } = period;
      
      const batchValues: any[] = [];
      const batchSize = 100;

      // Iterate through months and days
      for (let m = mes_inicio; m <= mes_fin; m++) {
        for (let d = dia_inicio; d <= dia_fin; d++) {
          const date = new Date(2026, m - 1, d);
          const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat

          // Only weekdays (Mon-Fri)
          if (dayOfWeek === 0 || dayOfWeek === 6) continue;

          const dateStr = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

          for (const dg of dgRes.rows) {
            const rand = Math.random();
            let estado = "PRESENTE";
            let justificacion = null;

            if (rand > 0.98) {
              estado = "JUSTIFICADA";
              justificacion = justifications[Math.floor(Math.random() * justifications.length)];
            } else if (rand > 0.95) {
              estado = "AUSENTE";
            } else if (rand > 0.92) {
              estado = "TARDE";
            }

            batchValues.push({
              id_estudiante,
              id_detallegrado: dg.id_detallegrado,
              fecha: dateStr,
              estado,
              justificacion,
              id_colegio
            });

            if (batchValues.length >= batchSize) {
              await flushAttendanceBatch(client, batchValues);
              batchValues.length = 0;
            }
          }
        }
      }
      if (batchValues.length > 0) {
        await flushAttendanceBatch(client, batchValues);
      }
    }
  }
}

async function flushAttendanceBatch(client: PoolClient, batch: any[]) {
  const values = batch.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(',');
  const params = batch.flatMap(r => [r.id_estudiante, r.id_detallegrado, r.fecha, r.estado, r.justificacion, r.id_colegio]);
  
  await client.query(`
    INSERT INTO registro_asistencia (id_estudiante, id_detallegrado, fecha, estado, justificacion, id_colegio)
    VALUES ${values}
  `, params);
}

function writeCredentialsFile(credentials: CredentialEntry[]): string {
  const outputDir = path.resolve(process.cwd(), "backend", "generated");
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

  for (const school of schools) {
    const schoolCredentials = credentials.filter((e) => e.colegio === school.nombre);
    const staffCredentials = schoolCredentials.filter((e) => e.seccion === "staff");
    const familiaCredentials = schoolCredentials.filter((e) => e.seccion === "familia");

    lines.push(`## ${school.nombre}`);
    lines.push("");

    // --- Staff table ---
    lines.push("### 👤 Personal Institucional (login: correo + contraseña)");
    lines.push("");
    lines.push("| Rol | Nombre | Correo | Contraseña | Materia |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const c of staffCredentials) {
      lines.push(`| ${c.rol} | ${c.nombre} | ${c.correo} | ${c.password} | ${c.materia ?? "-"} |`);
    }
    lines.push("");

    // --- Padres table ---
    const padres = familiaCredentials.filter((e) => e.rol === "PADRE");
    if (padres.length > 0) {
      lines.push("### 👨‍👩‍👧 Padres de Familia (login: correo + contraseña)");
      lines.push("");
      lines.push("| Rol | Correo | Contraseña | Hijos asociados |");
      lines.push("| --- | --- | --- | --- |");
      for (const c of padres) {
        lines.push(`| ${c.rol} | ${c.correo} | ${c.password} | ${c.hijos?.join(", ") ?? "-"} |`);
      }
      lines.push("");
    }

    // --- Students table ---
    const estudiantes = familiaCredentials.filter((e) => e.rol === "ESTUDIANTE");
    if (estudiantes.length > 0) {
      lines.push("### 🎓 Estudiantes (login: código estudiantil + contraseña)");
      lines.push("");
      lines.push("| Código Estudiantil | Nombre | Contraseña |");
      lines.push("| --- | --- | --- |");
      for (const c of estudiantes) {
        lines.push(`| ${c.codigo} | ${c.nombre} | ${c.password} |`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  fs.writeFileSync(outputFile, `${lines.join("\n")}\n`, "utf8");
  return outputFile;
}

async function run(): Promise<void> {
  const client = await pool.connect();
  const credentials: CredentialEntry[] = [];

  try {
    await client.query("BEGIN");

    console.log("Asegurando estructura base...");
    const authSql = fs.readFileSync(path.join(__dirname, "config/auth.migration.sql"), "utf8");
    await client.query(authSql);
    await createSchoolConfigTable(client);
    await client.query(`ALTER TABLE grados ADD COLUMN IF NOT EXISTS seccion VARCHAR(10) DEFAULT 'A';`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS trimestre integer;`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS dia_inicio integer;`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS dia_fin integer;`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS mes_inicio integer;`);
    await client.query(`ALTER TABLE periodo_academico ADD COLUMN IF NOT EXISTS mes_fin integer;`);

    console.log("Reseteando tablas existentes...");
    await truncateExistingTables(client, [
      "actividad_materia",
      "competencias",
      "configuracion_colegio",
      "contrato_docente",
      "detalle_grados",
      "detalle_padrefamilia",
      "directivo",
      "documento_matriculas",
      "docente",
      "escala_valoracion",
      "estudiante",
      "grados",
      "grupos",
      "jornada",
      "materias",
      "matricula",
      "nivel_escolar",
      "notas_actividad",
      "padre_familia",
      "periodo_academico",
      "rol",
      "secciones",
      "tipo_documento",
      "tipo_grado",
      "usuario",
      "usuario_rol",
      "año_lectivo",
      "colegio",
      "registro_asistencia"
    ]);

    // --- Fase 4: Migraciones de Esquema ---
    console.log("Migrando esquema para Firmas y Titulares...");
    await client.query(`
      -- 1. Agregar columna cargo a directivo
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='directivo' AND column_name='cargo') THEN
          ALTER TABLE public.directivo ADD COLUMN cargo character varying(100);
        END IF;
      END $$;

      -- 2. Agregar columna id_docente a grupos
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grupos' AND column_name='id_docente') THEN
          ALTER TABLE public.grupos ADD COLUMN id_docente integer REFERENCES docente(id_docente);
        END IF;
      END $$;

      -- 3. Asegurar restricción de unicidad para titular
      ALTER TABLE public.grupos DROP CONSTRAINT IF EXISTS unique_titular_docente;
      ALTER TABLE public.grupos ADD CONSTRAINT unique_titular_docente UNIQUE (id_docente);

      -- 4. Ampliar longitud de calendario en año_lectivo
      ALTER TABLE public."año_lectivo" ALTER COLUMN calendario TYPE VARCHAR(10);

      -- 5. Agregar columna tipo a observacion_estudiante
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='observacion_estudiante' AND column_name='tipo') THEN
          ALTER TABLE public.observacion_estudiante ADD COLUMN tipo character varying(20) DEFAULT 'ACADEMICA';
        END IF;
      END $$;
    `);

    console.log("Insertando catálogos base...");
    const roleIds = await insertRoles(client);
    await insertDocumentTypes(client);
    const sectionIds = await insertSections(client);

    const directivoHash = await bcrypt.hash(DIRECTIVO_PASSWORD, 10);
    const docenteHash = await bcrypt.hash(DOCENTE_PASSWORD, 10);
    const parentHash = await bcrypt.hash("padre123", 10);
    const studentHash = await bcrypt.hash("estudiante123", 10);

    for (const school of schools) {
      console.log(`Creando usuarios base para ${school.nombre}...`);
      await insertSchool(client, school, roleIds, directivoHash, docenteHash, credentials);
    }

    for (const school of schools) {
      console.log(`Creando estructura académica para ${school.nombre}...`);
      await insertSchoolAcademicStructure(client, school, sectionIds);
    }

    for (const school of schools) {
      console.log(`Creando padres y estudiantes para ${school.nombre}...`);
      await insertParentsAndStudents(client, school, roleIds, parentHash, studentHash, credentials);
    }

    console.log("Generando registros de asistencia de prueba...");
    await insertSampleAttendance(client);

    await client.query("COMMIT");

    await ensureCompetencySchema();
    
    console.log("Generando evidencias de aprendizaje de prueba...");
    const compClient = await pool.connect();
    try {
      const compRes = await compClient.query('SELECT id_competencia, id_colegio FROM competencias');
      for (const comp of compRes.rows) {
        await compClient.query(`
          INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
          VALUES 
            ($1, 'Reconoce y aplica los conceptos fundamentales de la unidad temática.', 1, $2),
            ($1, 'Demuestra capacidad analítica y pensamiento crítico en la resolución de problemas.', 2, $2),
            ($1, 'Participa activamente y colabora con sus compañeros en el entorno de aprendizaje.', 3, $2)
        `, [comp.id_competencia, comp.id_colegio]);
      }
    } finally {
      compClient.release();
    }

    const credentialsPath = writeCredentialsFile(credentials);

    console.log(`Base de datos reseteada correctamente para ${schools.length} colegios.`);
    console.log(`Credenciales guardadas en: ${credentialsPath}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error durante el reseteo de la base de datos:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
