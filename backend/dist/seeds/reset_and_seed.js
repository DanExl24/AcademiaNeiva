"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const competencyMigration_1 = require("../config/competencyMigration");
const db_1 = require("../config/db");
// â”€â”€â”€ CONSTANTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DOCUMENT_TYPE_CC = 3;
const CURRENT_YEAR = "2025";
const DIRECTIVO_PASSWORD = "directivo123";
const DOCENTE_PASSWORD = "docente123";
const CUPOS_POR_CURSO = 30;
const STUDENTS_PER_GROUP = 5;
// â”€â”€â”€ SCHOOL DEFINITIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const schools = [
    { id: 1, nombre: "CEA School Empresarial de los Andes", tipo: "Privado", sede: "Sede Principal", contacto: 3183118044, correo: "rectoria@cea.edu.co", dane: "341001005652", domain: "ceaschool.edu.co", tipo_calendario: "A" },
    { id: 2, nombre: "Institución Educativa El Caguán", tipo: "Oficial", sede: "Sede Principal", contacto: 3180000000, correo: "iecaguan@alcaldianeiva.gov.co", dane: "441001002747", domain: "iecaguan.edu.co", tipo_calendario: "A" },
    { id: 3, nombre: "Colegio Heisenberg Neiva", tipo: "Privado", sede: "Sede Principal", contacto: 3169100003, correo: "colegioheisenberg@hotmail.com", dane: "DANE-H-001", domain: "heisenberg.edu.co", tipo_calendario: "A" },
];
// ─── ACADEMIC CATALOGS ──────────────────────────────────────────────────────────
const sectionNames = ["A", "B"];
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
const teacherSeeds = [
    { firstName: "Andrea", lastName: "Rojas", subject: "Matemáticas" },
    { firstName: "Carlos", lastName: "Mendoza", subject: "Español" },
    { firstName: "Laura", lastName: "Pineda", subject: "Inglés" },
    { firstName: "Julián", lastName: "Perdomo", subject: "Ciencias Naturales" },
    { firstName: "Diana", lastName: "Trujillo", subject: "Ciencias Sociales" },
    { firstName: "Mateo", lastName: "Luna", subject: "Educación Física" },
    { firstName: "Paula", lastName: "Bastidas", subject: "Tecnología e Informática" },
    { firstName: "Santiago", lastName: "Sterling", subject: "Ética y Valores" },
];
// â”€â”€â”€ STUDENT NAME POOLS (Colombian names) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const studentFirstNames = [
    "Valentina", "Santiago", "Isabella", "MatÃ­as", "SofÃ­a", "Samuel", "Gabriela", "NicolÃ¡s",
    "Mariana", "SebastiÃ¡n", "Camila", "Alejandro", "Daniela", "Diego", "Luciana", "AndrÃ©s",
    "Sara", "TomÃ¡s", "Paula", "David", "Ana MarÃ­a", "Juan", "Laura", "Felipe",
    "MarÃ­a JosÃ©", "Carlos", "Natalia", "Emilio", "Juliana", "Miguel", "Catalina", "JosÃ©",
    "Manuela", "Ricardo", "Valeria", "Daniel", "Antonella", "Eduardo", "SalomÃ©", "MartÃ­n",
];
const studentLastNames = [
    "GarcÃ­a", "RodrÃ­guez", "MartÃ­nez", "LÃ³pez", "HernÃ¡ndez", "GonzÃ¡lez", "DÃ­az", "PÃ©rez",
    "SÃ¡nchez", "RamÃ­rez", "Torres", "Flores", "Rivera", "GÃ³mez", "Morales", "Vargas",
    "Castillo", "JimÃ©nez", "Reyes", "Cruz", "Mendoza", "Ortiz", "Guerrero", "Ramos",
    "Medina", "Castro", "Herrera", "GuzmÃ¡n", "Rojas", "Ruiz",
];
// â”€â”€â”€ HELPER: SCHOOL CONFIG TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function createSchoolConfigTable(client) {
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
async function createEnrollmentConfigTable(client) {
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
async function seedEnrollmentConfigs(client) {
    const schoolsRes = await client.query('SELECT id_colegio FROM colegio');
    for (const s of schoolsRes.rows) {
        const yearRes = await client.query('SELECT id_anio, calendario FROM anio_lectivo WHERE id_colegio = $1', [s.id_colegio]);
        for (const yearRow of yearRes.rows) {
            const yearId = yearRow.id_anio;
            const calStr = yearRow.calendario || '2026';
            const yearMatch = calStr.match(/\d{4}/g);
            const targetYearNum = yearMatch ? parseInt(yearMatch[yearMatch.length - 1]) : 2026;
            const startDate = new Date(`${targetYearNum}-07-20T00:00:00Z`);
            const endDate = new Date(`${targetYearNum}-08-25T23:59:59Z`);
            await client.query(`
        INSERT INTO configuracion_inscripcion (id_colegio, id_anio, fecha_inicio, fecha_cierre, habilitada)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (id_colegio, id_anio) DO UPDATE SET
          fecha_inicio = EXCLUDED.fecha_inicio,
          fecha_cierre = EXCLUDED.fecha_cierre,
          habilitada = EXCLUDED.habilitada
      `, [s.id_colegio, yearId, startDate.toISOString(), endDate.toISOString()]);
        }
    }
}
// â”€â”€â”€ HELPER: TRUNCATE TABLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function truncateExistingTables(client, tables) {
    const existing = await client.query(`SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`, [tables]);
    if (existing.rows.length === 0)
        return;
    const quotedTables = existing.rows
        .map(({ table_name }) => `"${table_name.replace(/"/g, '""')}"`)
        .join(", ");
    await client.query(`TRUNCATE ${quotedTables} RESTART IDENTITY CASCADE;`);
}
// â”€â”€â”€ INSERT BASE CATALOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insertRoles(client) {
    const roleIds = {};
    for (const role of ["admin", "directivo", "docente", "estudiante", "padre", "admin_general"]) {
        const result = await client.query(`INSERT INTO rol (nombre) VALUES ($1) RETURNING id_rol`, [role]);
        roleIds[role] = result.rows[0].id_rol;
    }
    return roleIds;
}
async function insertDocumentTypes(client) {
    const documentTypes = [
        { id: 1, tipo: "Registro Civil" },
        { id: 2, tipo: "Tarjeta de Identidad" },
        { id: 3, tipo: "CÃ©dula de CiudadanÃ­a" },
        { id: 4, tipo: "CÃ©dula de ExtranjerÃ­a" },
        { id: 5, tipo: "PEP / PPT" },
        { id: 6, tipo: "Pasaporte" },
    ];
    for (const dt of documentTypes) {
        await client.query(`INSERT INTO tipo_documento (id_tipodocumento, tipo) VALUES ($1, $2)`, [dt.id, dt.tipo]);
    }
}
async function insertSanctionTypes(client) {
    const sanctionTypes = [
        { nombre: 'SUSPENSION_TEMPORAL', descripcion: 'El estudiante es suspendido de clases por un nÃºmero especÃ­fico de dÃ­as.' },
        { nombre: 'MATRICULA_CONDICIONAL', descripcion: 'El estudiante continÃºa con matrÃ­cula bajo compromiso de comportamiento.' },
        { nombre: 'APERCIBIMIENTO', descripcion: 'Advertencia formal por escrito que precede a una sanciÃ³n mayor.' },
        { nombre: 'EXPULSION', descripcion: 'El estudiante es retirado permanentemente de la instituciÃ³n.' }
    ];
    for (const st of sanctionTypes) {
        await client.query(`INSERT INTO tipo_sancion (nombre, descripcion) VALUES ($1, $2) ON CONFLICT (nombre) DO NOTHING`, [st.nombre, st.descripcion]);
    }
}
async function insertSections(client) {
    const sectionIds = {};
    for (const name of sectionNames) {
        const result = await client.query(`INSERT INTO secciones (nombre) VALUES ($1) RETURNING id_seccion`, [name]);
        sectionIds[name] = result.rows[0].id_seccion;
    }
    return sectionIds;
}
// â”€â”€â”€ INSERT SCHOOL BASE (Directivos + Docentes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insertSchool(client, school, roleIds, directivoHash, docenteHash, credentials) {
    await client.query(`INSERT INTO colegio (id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`, [school.id, school.nombre, school.tipo, school.sede, school.contacto, school.correo, school.dane]);
    // --- Rector ---
    const rectorEmail = `rector@${school.domain}`;
    const rectorDoc = `10010000${school.id}`;
    const rectorRes = await client.query(`INSERT INTO usuario (email, password, nombre, apellido, activo, id_tipodocumento, documento, telefono, fecha_creacion)
     VALUES ($1, $2, $3, $4, true, $5, $6, $7, '2025-01-15 08:00:00-05') RETURNING id_usuario`, [rectorEmail, directivoHash, "Rector", school.nombre, DOCUMENT_TYPE_CC, rectorDoc, String(school.contacto)]);
    const rectorUserId = rectorRes.rows[0].id_usuario;
    await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [rectorUserId, roleIds.directivo]);
    await client.query(`INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio) VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`, [rectorUserId, school.id, roleIds.directivo]);
    await client.query(`INSERT INTO directivo (id_colegio, id_usuario, cargo) VALUES ($1, $2, $3)`, [school.id, rectorUserId, "RECTOR"]);
    await client.query(`INSERT INTO usuario_colegio_email (id_usuario, id_colegio, email_institucional) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [rectorUserId, school.id, rectorEmail]);
    credentials.push({
        colegio: school.nombre, seccion: "staff", rol: "DIRECTIVO",
        nombre: `Rector ${school.nombre}`, correo: rectorEmail, password: DIRECTIVO_PASSWORD,
    });
    // --- Coordinador ---
    const directivoEmail = `directivo@${school.domain}`;
    const directivoDoc = `10020000${school.id}`;
    const directivoResult = await client.query(`INSERT INTO usuario (email, password, nombre, apellido, activo, id_tipodocumento, documento, telefono, fecha_creacion)
     VALUES ($1, $2, $3, $4, true, $5, $6, $7, '2025-01-15 08:00:00-05') RETURNING id_usuario`, [directivoEmail, directivoHash, "Directivo", school.nombre, DOCUMENT_TYPE_CC, directivoDoc, String(school.contacto)]);
    const directivoUserId = directivoResult.rows[0].id_usuario;
    await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [directivoUserId, roleIds.directivo]);
    await client.query(`INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio) VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`, [directivoUserId, school.id, roleIds.directivo]);
    await client.query(`INSERT INTO directivo (id_colegio, id_usuario, cargo) VALUES ($1, $2, $3)`, [school.id, directivoUserId, "COORDINADOR"]);
    await client.query(`INSERT INTO usuario_colegio_email (id_usuario, id_colegio, email_institucional) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [directivoUserId, school.id, directivoEmail]);
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
        const userResult = await client.query(`INSERT INTO usuario (email, password, nombre, apellido, activo, id_tipodocumento, documento, telefono, fecha_creacion)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7, '2025-01-15 08:00:00-05') RETURNING id_usuario`, [email, docenteHash, teacher.firstName, fullLastName, DOCUMENT_TYPE_CC, teacherDoc, teacherPhone]);
        const teacherUserId = userResult.rows[0].id_usuario;
        await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [teacherUserId, roleIds.docente]);
        await client.query(`INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio) VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`, [teacherUserId, school.id, roleIds.docente]);
        await client.query(`INSERT INTO docente (nombre, apellido, id_colegio, id_usuario)
       VALUES ($1, $2, $3, $4)`, [teacher.firstName, fullLastName, school.id, teacherUserId]);
        await client.query(`INSERT INTO usuario_colegio_email (id_usuario, id_colegio, email_institucional) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [teacherUserId, school.id, email]);
        credentials.push({
            colegio: school.nombre, seccion: "staff", rol: "DOCENTE",
            nombre: `${teacher.firstName} ${fullLastName}`, correo: email, password: DOCENTE_PASSWORD, materia: teacher.subject,
        });
    }
}
// â”€â”€â”€ INSERT ACADEMIC STRUCTURE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insertSchoolAcademicStructure(client, school, sectionIds) {
    const levelIdsByName = {};
    const subjectIdsByName = {};
    const teacherIdsBySubject = {};
    const allGroupIds = [];
    const groupGradesMap = new Map();
    // --- Calendar type column ---
    await client.query(`ALTER TABLE colegio ADD COLUMN IF NOT EXISTS tipo_calendario CHAR(1) DEFAULT 'A';`);
    await client.query(`UPDATE colegio SET tipo_calendario = $1 WHERE id_colegio = $2`, [school.tipo_calendario, school.id]);
    await client.query(`ALTER TABLE anio_lectivo ADD COLUMN IF NOT EXISTS tipo_calendario CHAR(1) DEFAULT 'A';`);
    const yearLabel = school.tipo_calendario === "B" ? `${parseInt(CURRENT_YEAR) - 1}-${CURRENT_YEAR}` : CURRENT_YEAR;
    const fInicio2025 = school.tipo_calendario === "B" ? "2024-09-01" : "2025-01-15";
    const fFin2025 = school.tipo_calendario === "B" ? "2025-06-30" : "2025-11-30";
    const academicYearResult = await client.query(`INSERT INTO anio_lectivo (calendario, id_colegio, tipo_calendario, estado, fecha_inicio, fecha_fin) VALUES ($1, $2, $3, 'CERRADO', $4, $5) RETURNING id_anio`, [yearLabel, school.id, school.tipo_calendario, fInicio2025, fFin2025]);
    const academicYearId = academicYearResult.rows[0].id_anio;
    // --- Levels ---
    for (const levelSeed of levelSeeds) {
        const levelResult = await client.query(`INSERT INTO nivel_escolar (nombre, id_colegio) VALUES ($1, $2) RETURNING id_nivel`, [levelSeed.nombre, school.id]);
        levelIdsByName[levelSeed.nombre] = levelResult.rows[0].id_nivel;
    }
    // --- Jornadas ---
    const jornadaIdsByName = {};
    for (const jornadaName of jornadaNames) {
        const result = await client.query(`INSERT INTO jornada (nombre, id_colegio) VALUES ($1, $2) RETURNING id_jornada`, [jornadaName, school.id]);
        jornadaIdsByName[jornadaName] = result.rows[0].id_jornada;
    }
    // Helper to divide academic year into 4 quarters strictly within fecha_inicio and fecha_fin
    const computeQuarterPeriodsForDates = (startDateStr, endDateStr) => {
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
                mes_inicio: qStart.getUTCMonth() + 1,
                dia_inicio: qStart.getUTCDate(),
                mes_fin: qEnd.getUTCMonth() + 1,
                dia_fin: qEnd.getUTCDate(),
            });
        }
        return periods;
    };
    // --- Periods for 2025 (all closed for historical data) ---
    const qPeriods2025 = computeQuarterPeriodsForDates(fInicio2025, fFin2025);
    for (const qp of qPeriods2025) {
        await client.query(`INSERT INTO periodo_academico (nombre, estado, porcentaje, trimestre, id_anio, id_colegio, mes_inicio, mes_fin, dia_inicio, dia_fin)
       VALUES ($1, 'CERRADO', 25.00, $2, $3, $4, $5, $6, $7, $8)`, [qp.nombre, qp.trimestre, academicYearId, school.id, qp.mes_inicio, qp.mes_fin, qp.dia_inicio, qp.dia_fin]);
    }
    // --- Year 2026 (Clean current academic year for testing return-to-classes) ---
    const yearLabel2026 = school.tipo_calendario === "B" ? "2025-2026" : "2026";
    const fInicio2026 = school.tipo_calendario === "B" ? "2025-09-01" : "2026-01-15";
    const fFin2026 = school.tipo_calendario === "B" ? "2026-06-30" : "2026-11-30";
    const academicYearResult2026 = await client.query(`INSERT INTO anio_lectivo (calendario, id_colegio, tipo_calendario, estado, fecha_inicio, fecha_fin) VALUES ($1, $2, $3, 'ABIERTO', $4, $5) RETURNING id_anio`, [yearLabel2026, school.id, school.tipo_calendario, fInicio2026, fFin2026]);
    const academicYearId2026 = academicYearResult2026.rows[0].id_anio;
    const qPeriods2026 = computeQuarterPeriodsForDates(fInicio2026, fFin2026);
    for (const qp of qPeriods2026) {
        let estado2026 = 'PENDIENTE';
        if (qp.trimestre === 1 || qp.trimestre === 2) {
            estado2026 = 'CERRADO';
        }
        else if (qp.trimestre === 3) {
            estado2026 = 'ABIERTO';
        }
        else {
            estado2026 = 'PENDIENTE';
        }
        await client.query(`INSERT INTO periodo_academico (nombre, estado, porcentaje, trimestre, id_anio, id_colegio, mes_inicio, mes_fin, dia_inicio, dia_fin)
       VALUES ($1, $2, 25.00, $3, $4, $5, $6, $7, $8, $9)`, [qp.nombre, estado2026, qp.trimestre, academicYearId2026, school.id, qp.mes_inicio, qp.mes_fin, qp.dia_inicio, qp.dia_fin]);
    }
    // --- Escala de ValoraciÃ³n ---
    for (const scaleSeed of scaleSeeds) {
        await client.query(`INSERT INTO escala_valoracion (nivel, valor_minimo, valor_maximo, id_colegio) VALUES ($1, $2, $3, $4)`, [scaleSeed.nivel, scaleSeed.min, scaleSeed.max, school.id]);
    }
    // --- Config Colegio ---
    await client.query(`INSERT INTO configuracion_colegio (id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo)
     VALUES ($1, 0, 5, 3, 'AUTOMATICO')`, [school.id]);
    // --- Get docentes for subject assignment ---
    const teachersRes = await client.query(`SELECT id_docente FROM docente WHERE id_colegio = $1 ORDER BY id_docente`, [school.id]);
    teacherSeeds.forEach((teacher, index) => {
        teacherIdsBySubject[teacher.subject] = teachersRes.rows[index].id_docente;
    });
    // --- Subjects ---
    for (const teacher of teacherSeeds) {
        const subjectResult = await client.query(`INSERT INTO materias (nombre, id_colegio) VALUES ($1, $2) RETURNING id_materia`, [teacher.subject, school.id]);
        subjectIdsByName[teacher.subject] = subjectResult.rows[0].id_materia;
    }
    // --- Materia especial: Desarrollo Integral (Preescolar) ---
    const desIntegralResult = await client.query(`INSERT INTO materias (nombre, id_colegio) VALUES ($1, $2) RETURNING id_materia`, ["Desarrollo Integral", school.id]);
    subjectIdsByName["Desarrollo Integral"] = desIntegralResult.rows[0].id_materia;
    teacherIdsBySubject["Desarrollo Integral"] = teachersRes.rows[0].id_docente;
    // --- Grupos + Grados + Tipo Grado ---
    let teacherRotationIdx = 0;
    for (const levelSeed of levelSeeds) {
        const levelId = levelIdsByName[levelSeed.nombre];
        for (const gradeName of levelSeed.grades) {
            const gradeTypeResult = await client.query(`INSERT INTO tipo_grado (nombre, id_nivel) VALUES ($1, $2) RETURNING id_tipo_grado`, [gradeName, levelId]);
            const gradeTypeId = gradeTypeResult.rows[0].id_tipo_grado;
            for (const jornadaName of jornadaNames) {
                const jornadaId = jornadaIdsByName[jornadaName];
                for (const sectionName of sectionNames) {
                    const sectionId = sectionIds[sectionName];
                    // Rotate titular docente (no uniqueness constraint)
                    const titularId = teachersRes.rows[teacherRotationIdx % teachersRes.rows.length].id_docente;
                    teacherRotationIdx++;
                    const groupResult = await client.query(`INSERT INTO grupos (id_nivel, id_jornada, id_colegio, id_seccion, cupos_totales, id_tipo_grado, id_docente)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_grupo`, [levelId, jornadaId, school.id, sectionId, CUPOS_POR_CURSO, gradeTypeId, titularId]);
                    const gid = groupResult.rows[0].id_grupo;
                    allGroupIds.push(gid);
                    groupGradesMap.set(gid, gradeName);
                    await client.query(`INSERT INTO grados (tipo_grado, id_jornada, id_colegio, cupos_totales, seccion)
             VALUES ($1, $2, $3, $4, $5)`, [gradeName, jornadaId, school.id, CUPOS_POR_CURSO, sectionName]);
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
                await client.query(`INSERT INTO detalle_grados (id_materia, id_docente, id_colegio, id_grupo, id_anio) VALUES ($1, $2, $3, $4, $5)`, [subjectIdsByName["Desarrollo Integral"], teacherIdsBySubject["Desarrollo Integral"], school.id, groupId, yId]);
            }
            else {
                for (const teacher of teacherSeeds) {
                    await client.query(`INSERT INTO detalle_grados (id_materia, id_docente, id_colegio, id_grupo, id_anio) VALUES ($1, $2, $3, $4, $5)`, [subjectIdsByName[teacher.subject], teacherIdsBySubject[teacher.subject], school.id, groupId, yId]);
                }
            }
        }
    }
}
// ──────────────────────────────────────────────────────────────────────────────────
async function insertStudentsAndParents(client, school, roleIds, parentHash, studentHash, credentials) {
    // Get academic year 2025 (target 2025 for heavy student data)
    const yearsRes = await client.query("SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 AND (calendario = '2025' OR calendario = '2024-2025') ORDER BY id_anio ASC LIMIT 1", [school.id]);
    const yearId = yearsRes.rows[0]?.id_anio;
    if (!yearId)
        return;
    // Get a directivo of the school
    const directivoRes = await client.query('SELECT id FROM directivo WHERE id_colegio = $1 LIMIT 1', [school.id]);
    const directivoId = directivoRes.rows[0]?.id;
    // Fetch teachers of the school to map them as parents (60% target)
    const teachersRes = await client.query(`SELECT u.id_usuario, u.email, u.nombre, u.apellido 
     FROM usuario u
     JOIN docente d ON u.id_usuario = d.id_usuario
     WHERE d.id_colegio = $1`, [school.id]);
    const teachersList = teachersRes.rows;
    const targetDocentesPadresCount = Math.ceil(teachersList.length * 0.6);
    let docentesPadresIndex = 0;
    // Get groups for MAÑANA + A, B, C (42 groups: 3 per grade type)
    const groupsRes = await client.query(`SELECT g.id_grupo, g.id_nivel
     FROM grupos g
     JOIN jornada j ON g.id_jornada = j.id_jornada
     JOIN secciones s ON g.id_seccion = s.id_seccion
     WHERE g.id_colegio = $1 AND j.nombre = 'MAÑANA' AND s.nombre IN ('A', 'B', 'C')
     ORDER BY g.id_grupo`, [school.id]);
    const groups = groupsRes.rows;
    if (groups.length === 0)
        return;
    let globalStudentIdx = 0;
    let parentIdx = 0;
    let currentParentId = null;
    let currentParentEmail = "";
    let currentParentChildNames = [];
    // Helper: flush parent credentials
    const flushParent = () => {
        if (currentParentId !== null && currentParentChildNames.length > 0) {
            const existingCred = credentials.find((c) => c.correo === currentParentEmail);
            if (existingCred) {
                existingCred.rol = "DOCENTE / PADRE";
                existingCred.hijos = [...currentParentChildNames];
            }
            else {
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
            let studentState = "ACTIVO";
            let enrollmentState = "ACTIVA";
            let motivoCancelacion = null;
            let motivoEstado = null;
            let userActive = true;
            if (globalStudentIdx % 20 === 5) {
                studentState = "SANCIONADO";
                motivoEstado = "Incumplimiento reiterado de las normas de convivencia escolar.";
                // Sanctioned: still enrolled, can still log in
            }
            else if (globalStudentIdx % 20 === 10) {
                studentState = "EXPULSADO";
                enrollmentState = "CANCELADA";
                motivoCancelacion = "EXPULSION";
                motivoEstado = "Falta grave contra la integridad de la comunidad educativa.";
                userActive = false; // Blocked from login
            }
            else if (globalStudentIdx % 20 === 15) {
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
                let parentUserId;
                let pName;
                let pLastName;
                let pDoc;
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
                    await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) 
             VALUES ($1, $2) 
             ON CONFLICT (id_usuario, id_rol) DO NOTHING`, [parentUserId, roleIds.padre]);
                    await client.query(`INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio)
             VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`, [parentUserId, school.id, roleIds.padre]);
                }
                else {
                    // Crear un padre normal desde cero
                    currentParentEmail = `padre${parentIdx}.${school.id}@${school.domain}`;
                    pName = `Padre ${parentIdx}`;
                    pLastName = school.nombre;
                    pDoc = `1004${school.id}${String(parentIdx).padStart(5, "0")}`;
                    const parentPhone = `320${school.id}${String(parentIdx).padStart(6, "0")}`;
                    const pUserRes = await client.query(`INSERT INTO usuario (email, password, nombre, apellido, activo, id_tipodocumento, documento, telefono, fecha_creacion)
             VALUES ($1, $2, $3, $4, true, $5, $6, $7, '2025-01-15 08:00:00-05') RETURNING id_usuario`, [currentParentEmail, parentHash, pName, pLastName, DOCUMENT_TYPE_CC, pDoc, parentPhone]);
                    parentUserId = pUserRes.rows[0].id_usuario;
                    await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [parentUserId, roleIds.padre]);
                    await client.query(`INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio) VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`, [parentUserId, school.id, roleIds.padre]);
                }
                const pFamRes = await client.query(`INSERT INTO padre_familia (nombre, apellido, id_colegio, id_usuario)
           VALUES ($1, $2, $3, $4) RETURNING id_padrefamilia`, [pName, pLastName, school.id, parentUserId]);
                currentParentId = pFamRes.rows[0].id_padrefamilia;
            }
            // â”€â”€ Student name from pools â”€â”€
            const fIdx = (globalStudentIdx - 1) % studentFirstNames.length;
            const lIdx = Math.floor((globalStudentIdx - 1) / studentFirstNames.length) % studentLastNames.length;
            const firstName = studentFirstNames[fIdx];
            const lastName = studentLastNames[lIdx];
            const fullName = `${firstName} ${lastName}`;
            currentParentChildNames.push(fullName);
            const studentEmail = `est${globalStudentIdx}.${school.id}@${school.domain}`;
            const studentCode = `EST-${school.id}-${globalStudentIdx}`;
            const studentDoc = `1005${school.id}${String(globalStudentIdx).padStart(5, "0")}`;
            // â”€â”€ Create student user (telefono es NULL por defecto) â”€â”€
            const sUserRes = await client.query(`INSERT INTO usuario (email, password, nombre, apellido, activo, id_tipodocumento, documento, telefono, fecha_creacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, '2025-01-15 08:00:00-05') RETURNING id_usuario`, [studentEmail, studentHash, firstName, lastName, userActive, 1, studentDoc]);
            const studentUserId = sUserRes.rows[0].id_usuario;
            await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [studentUserId, roleIds.estudiante]);
            await client.query(`INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio) VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`, [studentUserId, school.id, roleIds.estudiante]);
            // â”€â”€ Create student record with estado â”€â”€
            const estRes = await client.query(`INSERT INTO estudiante (nombre, apellido, codigo, id_colegio, id_usuario, estado, motivo_estado)
         VALUES ($1, $2, $3, $4, $5, $6::estado_estudiante, $7) RETURNING id_estudiante`, [firstName, lastName, studentCode, school.id, studentUserId, studentState, motivoEstado]);
            const idEstudiante = estRes.rows[0].id_estudiante;
            if (studentState === "SANCIONADO" && directivoId) {
                const typeRes = await client.query(`SELECT id_tipo_sancion FROM tipo_sancion WHERE nombre = 'SUSPENSION_TEMPORAL' LIMIT 1`);
                const tipoSancionId = typeRes.rows[0]?.id_tipo_sancion;
                if (tipoSancionId) {
                    await client.query(`INSERT INTO sancion (id_estudiante, id_tipo_sancion, motivo, fecha_inicio, fecha_fin, estado, id_directivo)
             VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'ACTIVA', $4)`, [idEstudiante, tipoSancionId, motivoEstado, directivoId]);
                }
            }
            if (studentState === "EXPULSADO" && directivoId) {
                const typeRes = await client.query(`SELECT id_tipo_sancion FROM tipo_sancion WHERE nombre = 'EXPULSION' LIMIT 1`);
                const tipoSancionId = typeRes.rows[0]?.id_tipo_sancion;
                if (tipoSancionId) {
                    await client.query(`INSERT INTO sancion (id_estudiante, id_tipo_sancion, motivo, fecha_inicio, fecha_fin, estado, id_directivo)
             VALUES ($1, $2, $3, CURRENT_DATE, '9999-12-31', 'ACTIVA', $4)`, [idEstudiante, tipoSancionId, motivoEstado, directivoId]);
                }
            }
            // â”€â”€ Link parent â”€â”€
            await client.query(`INSERT INTO detalle_padrefamilia (id_padrefamilia, id_estudiante, id_colegio) VALUES ($1, $2, $3)`, [currentParentId, idEstudiante, school.id]);
            // â”€â”€ Enroll â”€â”€
            await client.query(`INSERT INTO matricula (id_estudiante, id_nivel, id_colegio, id_anio, estado, correo_padre, id_grupo, motivo_cancelacion)
         VALUES ($1, $2, $3, $4, $5::estado_matricula, $6, $7, $8)`, [idEstudiante, group.id_nivel, school.id, yearId, enrollmentState, currentParentEmail, group.id_grupo, motivoCancelacion]);
            // â”€â”€ Credential (skip expelled) â”€â”€
            const rolLabel = studentState === "ACTIVO" ? "ESTUDIANTE"
                : studentState === "SANCIONADO" ? "ESTUDIANTE (SANCIONADO)"
                    : studentState === "RETIRADO" ? "ESTUDIANTE (RETIRADO)"
                        : null; // EXPULSADO â†’ no credential
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
    console.log(`   âœ… ${school.nombre}: ${globalStudentIdx} estudiantes (${parentIdx} padres) en ${groups.length} grupos`);
}
// â”€â”€â”€ INSERT SAMPLE ATTENDANCE (lightweight) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insertSampleAttendance(client) {
    const justifications = [
        "Cita mÃ©dica", "Calamidad domÃ©stica", "Gripe comÃºn", "Evento institucional", "Retraso transporte",
    ];
    // Only enrolled + ACTIVA students for year 2025
    const enrollmentRes = await client.query(`
    SELECT m.id_estudiante, m.id_colegio, m.id_grupo, al.id_anio, al.calendario
    FROM matricula m
    JOIN anio_lectivo al ON m.id_anio = al.id_anio
    WHERE m.estado = 'ACTIVA' AND (al.calendario = '2025' OR al.calendario = '2024-2025')
  `);
    const batchValues = [];
    for (const enrollment of enrollmentRes.rows) {
        const { id_estudiante, id_colegio, id_grupo, id_anio, calendario } = enrollment;
        const yearMatch = calendario ? calendario.match(/\d{4}/g) : null;
        const targetYearNum = yearMatch ? parseInt(yearMatch[yearMatch.length - 1]) : 2025;
        const dgRes = await client.query(`SELECT id_detallegrado FROM detalle_grados WHERE id_grupo = $1 AND id_colegio = $2`, [id_grupo, id_colegio]);
        if (dgRes.rows.length === 0)
            continue;
        const periodsRes = await client.query(`SELECT id_periodo, mes_inicio FROM periodo_academico WHERE id_colegio = $1 AND id_anio = $2 AND estado = 'CERRADO'`, [id_colegio, id_anio]);
        // Generate 5 sample dates per period (first 5 weekdays of the period's start month)
        for (const period of periodsRes.rows) {
            const mes = period.mes_inicio || 1;
            let daysGenerated = 0;
            for (let d = 1; d <= 28 && daysGenerated < 5; d++) {
                const date = new Date(targetYearNum, mes - 1, d);
                const dow = date.getDay();
                if (dow === 0 || dow === 6)
                    continue; // skip weekends
                daysGenerated++;
                const dateStr = `${targetYearNum}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                for (const dg of dgRes.rows) {
                    const rand = Math.random();
                    let estado = "PRESENTE";
                    let justificacion = null;
                    let hora_llegada = null;
                    if (rand > 0.98) {
                        estado = "JUSTIFICADA";
                        justificacion = justifications[Math.floor(Math.random() * justifications.length)];
                    }
                    else if (rand > 0.95) {
                        estado = "AUSENTE";
                    }
                    else if (rand > 0.92) {
                        estado = "TARDE";
                    }
                    if (estado === "PRESENTE") {
                        const min = Math.floor(Math.random() * 16);
                        hora_llegada = `07:${String(min).padStart(2, "0")}`;
                    }
                    else if (estado === "TARDE") {
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
async function flushAttendanceBatch(client, batch) {
    const values = batch
        .map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`)
        .join(",");
    const params = batch.flatMap((r) => [r.id_estudiante, r.id_detallegrado, r.fecha, r.estado, r.justificacion, r.id_colegio, r.hora_llegada]);
    await client.query(`INSERT INTO registro_asistencia (id_estudiante, id_detallegrado, fecha, estado, justificacion, id_colegio, hora_llegada) VALUES ${values}`, params);
}
// â”€â”€â”€ WRITE CREDENTIALS FILE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function writeCredentialsFile(credentials) {
    const outputDir = path_1.default.resolve(process.cwd(), "generated");
    const outputFile = path_1.default.join(outputDir, "seed-credentials.md");
    fs_1.default.mkdirSync(outputDir, { recursive: true });
    const generatedAt = new Date().toISOString();
    const lines = [
        "# Credenciales generadas por reset_and_seed.ts",
        "",
        `> Fecha de generaciÃ³n: ${generatedAt}`,
        ">",
        "> Este archivo se regenera cada vez que ejecutes el seed de reseteo.",
        "",
    ];
    // Admin General
    const generalCredentials = credentials.filter((e) => e.seccion === "general");
    if (generalCredentials.length > 0) {
        lines.push("## ðŸ”‘ Administrador General (login: correo + contraseÃ±a)", "");
        lines.push("| Rol | Nombre | Correo | ContraseÃ±a |");
        lines.push("| --- | --- | --- | --- |");
        for (const c of generalCredentials)
            lines.push(`| ${c.rol} | ${c.nombre} | ${c.correo} | ${c.password} |`);
        lines.push("", "---", "");
    }
    for (const school of schools) {
        const schoolCreds = credentials.filter((e) => e.colegio === school.nombre);
        const staffCreds = schoolCreds.filter((e) => e.seccion === "staff");
        const familiaCreds = schoolCreds.filter((e) => e.seccion === "familia");
        lines.push(`## ${school.nombre}`, "");
        // Staff
        lines.push("### ðŸ‘¤ Personal Institucional (login: correo + contraseÃ±a)", "");
        lines.push("| Rol | Nombre | Correo | ContraseÃ±a | Materia |");
        lines.push("| --- | --- | --- | --- | --- |");
        for (const c of staffCreds)
            lines.push(`| ${c.rol} | ${c.nombre} | ${c.correo} | ${c.password} | ${c.materia ?? "-"} |`);
        lines.push("");
        // Parents
        const padres = familiaCreds.filter((e) => e.rol === "PADRE");
        if (padres.length > 0) {
            lines.push("### ðŸ‘¨â€ðŸ‘©â€ðŸ‘§ Padres de Familia (login: correo + contraseÃ±a)", "");
            lines.push("| Rol | Correo | ContraseÃ±a | Hijos asociados |");
            lines.push("| --- | --- | --- | --- |");
            for (const c of padres)
                lines.push(`| ${c.rol} | ${c.correo} | ${c.password} | ${c.hijos?.join(", ") ?? "-"} |`);
            lines.push("");
        }
        // Students
        const estudiantes = familiaCreds.filter((e) => e.rol.startsWith("ESTUDIANTE"));
        if (estudiantes.length > 0) {
            lines.push("### ðŸŽ“ Estudiantes (login: cÃ³digo estudiantil + contraseÃ±a)", "");
            lines.push("| CÃ³digo | Nombre | ContraseÃ±a | Estado |");
            lines.push("| --- | --- | --- | --- |");
            for (const c of estudiantes) {
                const estado = c.rol.includes("SANCIONADO") ? "âš ï¸ SANCIONADO" : c.rol.includes("RETIRADO") ? "ðŸ”´ RETIRADO" : "âœ… ACTIVO";
                lines.push(`| ${c.codigo} | ${c.nombre} | ${c.password} | ${estado} |`);
            }
            lines.push("");
        }
        lines.push("---", "");
    }
    fs_1.default.writeFileSync(outputFile, `${lines.join("\n")}\n`, "utf8");
    return outputFile;
}
// â”€â”€â”€ MAIN EXECUTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function run() {
    const client = await db_1.pool.connect();
    const credentials = [];
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
        await client.query("BEGIN");
        await client.query("SET my.app.bypass_triggers = 'true';");
        // ── Phase 1: Ensure base schema ──
        console.log("📦 Asegurando estructura base...");
        const authSql = fs_1.default.readFileSync(path_1.default.join(__dirname, "../config/auth.migration.sql"), "utf8");
        await client.query(authSql);
        await createSchoolConfigTable(client);
        await createEnrollmentConfigTable(client);
        console.log("📦 Aplicando todas las migraciones SQL del sistema (001 a 045)...");
        const migrationsDir = path_1.default.join(__dirname, "../migrations");
        const migrationFiles = fs_1.default.readdirSync(migrationsDir)
            .filter((file) => file.endsWith(".sql"))
            .sort();
        for (const file of migrationFiles) {
            console.log(`  └─ 📦 Aplicando migración ${file}...`);
            const migrationSql = fs_1.default.readFileSync(path_1.default.join(__dirname, "../migrations", file), "utf8");
            await client.query(migrationSql);
        }
        console.log("📦 Estructura base configurada.");
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
        await client.query("BEGIN;");
        await client.query("SET my.app.bypass_triggers = 'true';");
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
            // Auth & Traslados
            "traslado_aprobacion",
            "solicitud_traslado",
            "usuario_colegio",
            "usuario_rol",
            "usuario",
            "rol",
            "tipo_documento",
            "secciones",
            // Schools
            "colegio",
        ]);
        // â”€â”€ Phase 4: Insert catalogs â”€â”€
        console.log("ðŸ“‹ Insertando catÃ¡logos base...");
        const roleIds = await insertRoles(client);
        await insertDocumentTypes(client);
        await insertSanctionTypes(client);
        const sectionIds = await insertSections(client);
        const directivoHash = await bcrypt_1.default.hash(DIRECTIVO_PASSWORD, 10);
        const docenteHash = await bcrypt_1.default.hash(DOCENTE_PASSWORD, 10);
        const parentHash = await bcrypt_1.default.hash("padre123", 10);
        const studentHash = await bcrypt_1.default.hash("estudiante123", 10);
        // â”€â”€ Phase 5: Admin General â”€â”€
        console.log("ðŸ‘‘ Creando administrador general...");
        const adminGeneralPassword = "adminGeneral123";
        const adminGeneralHash = await bcrypt_1.default.hash(adminGeneralPassword, 10);
        const adminGeneralEmail = "admin.general@academianeiva.edu.co";
        const adminGeneralResult = await client.query(`INSERT INTO usuario (email, password, nombre, apellido, activo, estado, id_tipodocumento, documento, telefono)
       VALUES ($1, $2, $3, $4, true, 'ACTIVO', $5, $6, $7) RETURNING id_usuario`, [adminGeneralEmail, adminGeneralHash, "Admin", "General", DOCUMENT_TYPE_CC, "1000000000", "3000000000"]);
        await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [
            adminGeneralResult.rows[0].id_usuario,
            roleIds.admin_general,
        ]);
        // Sembrar valores por defecto para la configuraciÃ³n de la plataforma (DuraciÃ³n de Supervisiones)
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
        // â”€â”€ Phase 6: Schools (staff) â”€â”€
        for (const school of schools) {
            console.log(`ðŸ« Creando staff para ${school.nombre}...`);
            await insertSchool(client, school, roleIds, directivoHash, docenteHash, credentials);
        }
        // â”€â”€ Phase 7: Academic structure â”€â”€
        for (const school of schools) {
            console.log(`ðŸ“š Creando estructura acadÃ©mica para ${school.nombre}...`);
            await insertSchoolAcademicStructure(client, school, sectionIds);
        }
        // â”€â”€ Phase 7.5: Enrollment configs â”€â”€
        await seedEnrollmentConfigs(client);
        // â”€â”€ Phase 8: Students and parents (5 per MAÃ‘ANA-A group) â”€â”€
        for (const school of schools) {
            console.log(`ðŸ‘¨â€ðŸ‘©â€ðŸ‘§â€ðŸ‘¦ Creando estudiantes y padres para ${school.nombre}...`);
            await insertStudentsAndParents(client, school, roleIds, parentHash, studentHash, credentials);
        }
        // â”€â”€ Phase 9: Sample attendance â”€â”€
        console.log("ðŸ“… Generando registros de asistencia de prueba...");
        await insertSampleAttendance(client);
        // â”€â”€ Phase 9.5: Seed Admin General Supervisions â”€â”€
        console.log("ðŸ•µï¸ Generando supervisiones de auditorÃ­a del Administrador General...");
        const adminGenId = adminGeneralResult.rows[0].id_usuario;
        const directivosRes = await client.query(`SELECT DISTINCT ON (id_colegio) id, id_colegio FROM directivo`);
        for (const d of directivosRes.rows) {
            await client.query(`
        INSERT INTO auditoria_supervision (
          id_admin_general, id_colegio, id_directivo_aprobador, motivo_solicitud,
          tipo_supervision, estado_supervision, fecha_aprobacion, motivo_entrada,
          fecha_entrada, fecha_salida, duracion_maxima_minutos
        ) VALUES (
          $1, $2, $3, 'RevisiÃ³n rutinaria de calificaciones y planeaciÃ³n curricular',
          'SOLO_LECTURA'::tipo_supervision, 'FINALIZADA'::estado_supervision, NOW() - INTERVAL '2 days',
          'Entrada autorizada para auditorÃ­a semestral', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '45 minutes', 60
        )
      `, [adminGenId, d.id_colegio, d.id]);
        }
        // â”€â”€ Phase 10: Sync sequences â”€â”€
        console.log("ðŸ”„ Sincronizando secuencias de base de datos...");
        await client.query(`
      SELECT setval(pg_get_serial_sequence('colegio', 'id_colegio'), COALESCE(MAX(id_colegio), 1)) FROM colegio;
      SELECT setval(pg_get_serial_sequence('tipo_documento', 'id_tipodocumento'), COALESCE(MAX(id_tipodocumento), 1)) FROM tipo_documento;
      SELECT setval(pg_get_serial_sequence('auditoria_supervision', 'id_auditoria'), COALESCE(MAX(id_auditoria), 1)) FROM auditoria_supervision;
    `);
        await client.query("COMMIT");
        console.log("âœ… TransacciÃ³n principal completada.");
        // â”€â”€ Phase 10.5: Seeding DBA Catalog and curriculums â”€â”€
        await seedDbaCatalog();
        // â”€â”€ Phase 10.6: Seeding Competencies and Evidences based on DBA â”€â”€
        await seedDbaCompetenciesAndEvidences();
        // â”€â”€ Phase 11: Competency schema (outside transaction) â”€â”€
        console.log("ðŸ§  Sincronizando esquema de competencias de respaldo...");
        await (0, competencyMigration_1.ensureCompetencySchema)();
        // â”€â”€ Phase 13: Write credentials â”€â”€
        const credentialsPath = writeCredentialsFile(credentials);
        // â”€â”€ Phase 14: Populate academic grades â”€â”€
        console.log("\nðŸ“Š Generando calificaciones y datos acadÃ©micos de prueba...");
        try {
            // En el contenedor Docker (dist compilado), ts-node-dev no estÃ¡ disponible.
            // Detectamos si estamos corriendo desde el JS compilado o desde TypeScript.
            const isCompiled = __filename.endsWith(".js");
            const gradesCmd = isCompiled
                ? `node ${path_1.default.resolve(__dirname, "seed_grades.js")}`
                : "npm run seed:grades";
            const gradesCwd = isCompiled
                ? undefined
                : path_1.default.resolve(__dirname, "../..");
            (0, child_process_1.execSync)(gradesCmd, { stdio: "inherit", cwd: gradesCwd });
        }
        catch (err) {
            console.error("âš ï¸ Error al generar calificaciones:", err);
        }
        // â”€â”€ Summary â”€â”€
        const totalStudents = schools.length * 42 * STUDENTS_PER_GROUP;
        const expelled = credentials.filter(() => false).length; // Not in credentials
        console.log(`\nðŸŽ‰ Base de datos reseteada correctamente para ${schools.length} colegios.`);
        console.log(`   ðŸ“Š Estudiantes totales: ${totalStudents} (${STUDENTS_PER_GROUP}/grupo Ã— 42 grupos Ã— ${schools.length} colegios)`);
        console.log(`   âš ï¸  ~5% SANCIONADOS, ~5% EXPULSADOS, ~5% RETIRADOS`);
        console.log(`   ðŸ“„ Credenciales: ${credentialsPath}`);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("âŒ Error durante el reseteo de la base de datos:", error);
        process.exitCode = 1;
    }
    finally {
        client.release();
        await db_1.pool.end();
    }
}
async function seedDbaCatalog() {
    console.log("\nðŸŒ± Iniciando importaciÃ³n y siembra del catÃ¡logo de DBA...");
    const rootDir = path_1.default.resolve(__dirname, "../../..");
    const dbaPdfs = [
        { pdf: path_1.default.join(rootDir, "guides/DBA/DBA_matematicas.pdf"), area: "MatemÃ¡ticas", version: "2016", startPage: 8, script: "importar_dba.py" },
        { pdf: path_1.default.join(rootDir, "guides/DBA/DBA_lenguaje.pdf"), area: "EspaÃ±ol", version: "2016", startPage: 8, script: "importar_dba.py" },
        { pdf: path_1.default.join(rootDir, "guides/DBA/DBA_naturales.pdf"), area: "Ciencias Naturales", version: "2016", startPage: 8, script: "importar_dba.py" },
        { pdf: path_1.default.join(rootDir, "guides/DBA/DBA_sociales.pdf"), area: "Ciencias Sociales", version: "2016", startPage: 8, script: "importar_dba.py" },
        { pdf: path_1.default.join(rootDir, "guides/DBA/DBA_transicion.pdf"), area: "Desarrollo Integral", version: "2016", startPage: 8, script: "importar_dba.py" },
        { pdf: path_1.default.join(rootDir, "guides/DBA/dba_ingles_transicion_quinto.pdf"), area: "InglÃ©s", version: "2016", startPage: 8, script: "importar_dba_primaria_ingles.py" },
        { pdf: path_1.default.join(rootDir, "guides/DBA/DBA_ingles_sexto_once.pdf"), area: "InglÃ©s", version: "2016", startPage: 15, script: "importar_dba.py" }
    ];
    // 1. Ejecutar importaciones de Python
    for (const item of dbaPdfs) {
        console.log(`â³ Importando ${item.area} desde ${item.pdf} (pÃ¡g. ${item.startPage})...`);
        try {
            const pdfPath = item.pdf.replace(/\\/g, "/");
            const cmd = `python scripts/${item.script} --pdf "${pdfPath}" --area "${item.area}" --version "${item.version}" --start-page ${item.startPage}`;
            (0, child_process_1.execSync)(cmd, { stdio: "inherit", cwd: path_1.default.resolve(__dirname, "../..") });
        }
        catch (err) {
            console.error(`âŒ Error importando ${item.pdf}:`, err);
        }
    }
    // 2. Realizar consultas para reasignaciÃ³n y mapeo
    const client = await db_1.pool.connect();
    try {
        // A. Reasignar DBA de inglÃ©s transiciÃ³n a la materia "Desarrollo Integral" sumando 100 a su nÃºmero para evitar colisiÃ³n de llave Ãºnica con los DBA tradicionales de transiciÃ³n
        console.log("ðŸ”„ Reasignando DBA de inglÃ©s TransiciÃ³n a la materia Desarrollo Integral...");
        await client.query(`
      UPDATE dba 
      SET area = 'Desarrollo Integral',
          numero_dba = numero_dba + 100
      WHERE area = 'InglÃ©s' AND grado = 'TRANSICION' AND version_curricular = '2016'
    `);
        // B. Obtener todos los colegios
        const colegiosRes = await client.query("SELECT id_colegio FROM colegio");
        // C. Mapear versiÃ³n curricular 2016
        console.log("ðŸ“‹ Poblando colegio_version_curricular con versiÃ³n 2016...");
        const subjectsGrades = [
            { area: "MatemÃ¡ticas", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
            { area: "EspaÃ±ol", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
            { area: "Ciencias Naturales", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
            { area: "Ciencias Sociales", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
            { area: "InglÃ©s", grades: ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
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
        console.log("âœ… Proceso de siembra de DBA completado exitosamente.");
    }
    catch (err) {
        console.error("âŒ Error en base de datos al sembrar DBA:", err);
    }
    finally {
        client.release();
    }
}
function distributeDbas(dbasCount, periodStates) {
    const K = periodStates.length;
    const C = periodStates.filter(state => state === 'CERRADO').length;
    const counts = periodStates.map(() => 1);
    let remaining = dbasCount - K;
    if (remaining > 0) {
        const weights = periodStates.map(state => {
            if (state === 'CERRADO')
                return 0.20;
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
    }
    else if (remaining < 0) {
        for (let idx = 0; idx < K; idx++) {
            counts[idx] = idx < dbasCount ? 1 : 0;
        }
    }
    return counts;
}
async function seedDbaCompetenciesAndEvidences() {
    console.log("\nðŸ§  Generando competencias y evidencias basadas en DBA oficiales...");
    const client = await db_1.pool.connect();
    try {
        // 1. Obtener catÃ¡logo de dimensiones de preescolar
        const dimRes = await client.query("SELECT id_dimension, nombre FROM dimensiones_preescolar ORDER BY id_dimension");
        const dimensiones = dimRes.rows;
        const dimComunicativa = dimensiones.find(d => d.nombre === "Comunicativa");
        // 2. Obtener todos los colegios y sus aÃ±os lectivos
        const schoolsRes = await client.query("SELECT id_colegio, nombre FROM colegio");
        for (const school of schoolsRes.rows) {
            console.log(`   Colegio: ${school.nombre}`);
            const yearRes = await client.query("SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 AND (calendario = '2025' OR calendario = '2024-2025') ORDER BY id_anio ASC LIMIT 1", [school.id_colegio]);
            const yearId = yearRes.rows[0]?.id_anio;
            if (!yearId)
                continue;
            // Obtener periodos del aÃ±o lectivo, ordenados
            const periodsRes = await client.query("SELECT id_periodo, nombre, estado, trimestre FROM periodo_academico WHERE id_anio = $1 ORDER BY trimestre ASC", [yearId]);
            const periods = periodsRes.rows;
            if (periods.length === 0)
                continue;
            const periodStates = periods.map(p => p.estado);
            const C = periodStates.filter(state => state === 'CERRADO').length;
            // Obtener todos los grupos del colegio
            const groupsRes = await client.query(`SELECT g.id_grupo, g.id_nivel, g.id_tipo_grado, tg.nombre as grade_name
         FROM grupos g
         JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
         WHERE g.id_colegio = $1`, [school.id_colegio]);
            // Agrupar grupos por su grado (tipo_grado)
            const groupsByGrade = new Map();
            for (const group of groupsRes.rows) {
                if (!groupsByGrade.has(group.grade_name)) {
                    groupsByGrade.set(group.grade_name, []);
                }
                groupsByGrade.get(group.grade_name).push(group);
            }
            // Obtener las materias del colegio
            const subjectsRes = await client.query("SELECT id_materia, nombre FROM materias WHERE id_colegio = $1", [school.id_colegio]);
            const subjects = subjectsRes.rows;
            for (const [gradeName, gradeGroups] of groupsByGrade.entries()) {
                const isPreescolar = gradeName === "PREJARDIN" || gradeName === "JARDIN" || gradeName === "TRANSICION";
                if (isPreescolar) {
                    // Preescolar solo ve la materia "Desarrollo Integral"
                    const devSubject = subjects.find(s => s.nombre === "Desarrollo Integral");
                    if (!devSubject)
                        continue;
                    if (gradeName === "PREJARDIN" || gradeName === "JARDIN") {
                        // Regla: PrejardÃ­n y JardÃ­n no tienen DBA, pero es OBLIGATORIO asociar las competencias a las 6 dimensiones oficiales.
                        // Para cada periodo, crearemos una competencia por cada una de las 6 dimensiones.
                        for (const period of periods) {
                            for (const dim of dimensiones) {
                                const syncUuid = (0, crypto_1.randomUUID)();
                                const compDesc = `Desarrollo de habilidades y competencias integrales en la dimensiÃ³n ${dim.nombre}.`;
                                for (const group of gradeGroups) {
                                    const compInsert = await client.query(`INSERT INTO competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension, nombre)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id_competencia`, [yearId, group.id_grupo, devSubject.id_materia, period.id_periodo, compDesc, school.id_colegio, syncUuid, dim.id_dimension, `Competencia DimensiÃ³n ${dim.nombre}`]);
                                    // Evidencias por defecto relacionadas con la dimensiÃ³n
                                    await client.query(`INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
                     VALUES 
                       ($1, $2, 1, $3),
                       ($1, $2, 2, $3),
                       ($1, $2, 3, $3)`, [
                                        compInsert.rows[0].id_competencia,
                                        `Identifica y explora elementos clave relacionados con la dimensiÃ³n ${dim.nombre}.`,
                                        school.id_colegio
                                    ]);
                                }
                            }
                        }
                    }
                    else if (gradeName === "TRANSICION") {
                        // Regla: TransiciÃ³n tiene DBA de Desarrollo Integral y DBA de InglÃ©s TransiciÃ³n reasignado a Desarrollo Integral.
                        // La asignaciÃ³n de dimensiones para TransiciÃ³n es OPCIONAL.
                        const dbasRes = await client.query(`SELECT id_dba, numero_dba, enunciado, area 
               FROM dba 
               WHERE area = 'Desarrollo Integral' AND grado = 'TRANSICION' AND version_curricular = '2016' AND estado = 'ACTIVO'
               ORDER BY numero_dba ASC`);
                        const dbas = dbasRes.rows;
                        if (dbas.length > 0) {
                            const counts = distributeDbas(dbas.length, periodStates);
                            let dbaIdx = 0;
                            for (let pIdx = 0; pIdx < periods.length; pIdx++) {
                                const period = periods[pIdx];
                                const dbaCountForPeriod = counts[pIdx];
                                for (let d = 0; d < dbaCountForPeriod; d++) {
                                    if (dbaIdx >= dbas.length)
                                        break;
                                    const dba = dbas[dbaIdx];
                                    dbaIdx++;
                                    const syncUuid = (0, crypto_1.randomUUID)();
                                    // Decidir opcionalidad de dimensiÃ³n: 50% de las competencias llevan dimensiÃ³n, el otro 50% no.
                                    // Si el DBA es de inglÃ©s (tiene numero_dba >= 100), la dimensiÃ³n es Comunicativa
                                    let idDimension = null;
                                    if (dba.numero_dba >= 100) {
                                        if (dbaIdx % 2 === 0 && dimComunicativa) {
                                            idDimension = dimComunicativa.id_dimension;
                                        }
                                    }
                                    else {
                                        if (dbaIdx % 2 === 0) {
                                            idDimension = dimensiones[dbaIdx % dimensiones.length].id_dimension;
                                        }
                                    }
                                    for (const group of gradeGroups) {
                                        const compInsert = await client.query(`INSERT INTO competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension, nombre)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id_competencia`, [
                                            yearId,
                                            group.id_grupo,
                                            devSubject.id_materia,
                                            period.id_periodo,
                                            dba.enunciado,
                                            school.id_colegio,
                                            syncUuid,
                                            idDimension,
                                            `Competencia DBA #${dba.numero_dba}`
                                        ]);
                                        // Poblar evidencias oficiales del DBA
                                        const evRes = await client.query("SELECT id_evidencia_dba, descripcion, orden FROM evidencias_dba WHERE id_dba = $1 AND estado = 'ACTIVO' ORDER BY orden ASC", [dba.id_dba]);
                                        const evidencias = evRes.rows;
                                        if (evidencias.length > 0) {
                                            for (const ev of evidencias.slice(0, 3)) {
                                                await client.query(`INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio, id_evidencia_dba)
                           VALUES ($1, $2, $3, $4, $5)`, [compInsert.rows[0].id_competencia, ev.descripcion, ev.orden, school.id_colegio, ev.id_evidencia_dba]);
                                            }
                                        }
                                        else {
                                            await client.query(`INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
                         VALUES 
                           ($1, 'Desarrolla las evidencias de aprendizaje propuestas para la competencia.', 1, $2),
                           ($1, 'Muestra apropiaciÃ³n de las metas de aprendizaje de la unidad.', 2, $2),
                           ($1, 'Aplica los desempeÃ±os esperados en el contexto institucional.', 3, $2)`, [compInsert.rows[0].id_competencia, school.id_colegio]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                else {
                    // Primaria, Secundaria y Media
                    for (const subject of subjects) {
                        if (subject.nombre === "Desarrollo Integral")
                            continue;
                        // Obtener DBAs para este grado y materia
                        const dbasRes = await client.query(`SELECT id_dba, numero_dba, enunciado, area 
               FROM dba 
               WHERE area = $1 AND grado = $2 AND version_curricular = '2016' AND estado = 'ACTIVO'
               ORDER BY numero_dba ASC`, [subject.nombre, gradeName]);
                        const dbas = dbasRes.rows;
                        if (dbas.length > 0) {
                            const counts = distributeDbas(dbas.length, periodStates);
                            let dbaIdx = 0;
                            for (let pIdx = 0; pIdx < periods.length; pIdx++) {
                                const period = periods[pIdx];
                                const dbaCountForPeriod = counts[pIdx];
                                for (let d = 0; d < dbaCountForPeriod; d++) {
                                    if (dbaIdx >= dbas.length)
                                        break;
                                    const dba = dbas[dbaIdx];
                                    dbaIdx++;
                                    const syncUuid = (0, crypto_1.randomUUID)();
                                    for (const group of gradeGroups) {
                                        const compInsert = await client.query(`INSERT INTO competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension, nombre)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8) RETURNING id_competencia`, [
                                            yearId,
                                            group.id_grupo,
                                            subject.id_materia,
                                            period.id_periodo,
                                            dba.enunciado,
                                            school.id_colegio,
                                            syncUuid,
                                            `Competencia DBA #${dba.numero_dba}`
                                        ]);
                                        // Poblar evidencias oficiales del DBA
                                        const evRes = await client.query("SELECT id_evidencia_dba, descripcion, orden FROM evidencias_dba WHERE id_dba = $1 AND estado = 'ACTIVO' ORDER BY orden ASC", [dba.id_dba]);
                                        const evidencias = evRes.rows;
                                        if (evidencias.length > 0) {
                                            for (const ev of evidencias.slice(0, 3)) {
                                                await client.query(`INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio, id_evidencia_dba)
                           VALUES ($1, $2, $3, $4, $5)`, [compInsert.rows[0].id_competencia, ev.descripcion, ev.orden, school.id_colegio, ev.id_evidencia_dba]);
                                            }
                                        }
                                        else {
                                            await client.query(`INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
                         VALUES 
                           ($1, 'Comprende y asimila los conceptos temÃ¡ticos planteados.', 1, $2),
                           ($1, 'Resuelve problemas acadÃ©micos y prÃ¡cticos de forma autÃ³noma.', 2, $2),
                           ($1, 'Demuestra actitud colaborativa y participativa en el aula.', 3, $2)`, [compInsert.rows[0].id_competencia, school.id_colegio]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // â”€â”€â”€ 2026 DEFAULT COMPETENCIES FOR CLOSED PERIODS (Period 1 and Period 2) â”€â”€â”€
            const year2026Res = await client.query("SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 AND (calendario = '2026' OR calendario = '2025-2026') ORDER BY id_anio ASC LIMIT 1", [school.id_colegio]);
            const yearId2026 = year2026Res.rows[0]?.id_anio;
            if (yearId2026) {
                const closedPeriods2026Res = await client.query("SELECT id_periodo FROM periodo_academico WHERE id_anio = $1 AND estado = 'CERRADO' ORDER BY trimestre ASC", [yearId2026]);
                const dg2026Res = await client.query("SELECT DISTINCT id_grupo, id_materia FROM detalle_grados WHERE id_colegio = $1 AND id_anio = $2", [school.id_colegio, yearId2026]);
                for (const period of closedPeriods2026Res.rows) {
                    for (const dg of dg2026Res.rows) {
                        const syncUuid = (0, crypto_1.randomUUID)();
                        await client.query(`INSERT INTO competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, nombre)
               SELECT $1, $2, $3, $4, $5, $6, $7, $8
               WHERE NOT EXISTS (
                 SELECT 1 FROM competencias 
                 WHERE id_anio = $1 AND id_grupo = $2 AND id_materia = $3 AND id_periodo = $4
               )`, [
                            yearId2026,
                            dg.id_grupo,
                            dg.id_materia,
                            period.id_periodo,
                            "Competencia pendiente por definir.",
                            school.id_colegio,
                            syncUuid,
                            "Competencia Predeterminada"
                        ]);
                    }
                }
            }
            // â”€â”€â”€ 2025 PROMOTION DECISIONS SEEDING FOR ALL STUDENTS â”€â”€â”€
            const year2025Res = await client.query("SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 AND (calendario = '2025' OR calendario = '2024-2025') ORDER BY id_anio ASC LIMIT 1", [school.id_colegio]);
            const yearId2025 = year2025Res.rows[0]?.id_anio;
            const directivoUserRes = await client.query("SELECT u.id_usuario FROM usuario u JOIN directivo d ON d.id_usuario = u.id_usuario WHERE d.id_colegio = $1 ORDER BY u.id_usuario ASC LIMIT 1", [school.id_colegio]);
            const directiveUserId = directivoUserRes.rows[0]?.id_usuario || 1;
            if (yearId2025) {
                const enrollments2025 = await client.query(`SELECT m.id_estudiante, m.id_grupo, g.id_tipo_grado
           FROM matricula m
           JOIN grupos g ON g.id_grupo = m.id_grupo
           WHERE m.id_colegio = $1 AND m.id_anio = $2 AND m.estado NOT IN ('CANCELADA', 'RECHAZADA')`, [school.id_colegio, yearId2025]);
                for (const enr of enrollments2025.rows) {
                    const existCheck = await client.query("SELECT 1 FROM decision_promocion_directivo WHERE id_estudiante = $1 AND id_anio_anterior = $2", [enr.id_estudiante, yearId2025]);
                    if (existCheck.rows.length === 0) {
                        await client.query(`INSERT INTO decision_promocion_directivo 
               (id_colegio, id_estudiante, id_anio_anterior, resultado_calculado, decision_tomada, id_grado_anterior, id_grado_asignado, id_usuario_decision, observacion)
               VALUES ($1, $2, $3, 'APROBADO', 'PROMOVER_SIGUIENTE_GRADO', $4, $4, $5, 'Estudiante promovido satisfactoriamente al siguiente grado lectivo por el Consejo AcadÃ©mico.')`, [school.id_colegio, enr.id_estudiante, yearId2025, enr.id_tipo_grado, directiveUserId]);
                    }
                }
                console.log(`âœ… Decisiones de promociÃ³n 2025 registradas para ${enrollments2025.rows.length} estudiantes de ${school.nombre}.`);
            }
        }
        console.log("âœ… Siembra de competencias y evidencias basada en DBA completada exitosamente.");
    }
    catch (err) {
        console.error("âŒ Error al sembrar competencias basadas en DBA:", err);
    }
    finally {
        client.release();
    }
}
run();
