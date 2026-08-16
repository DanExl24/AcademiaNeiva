import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Definición tipada básica para el querybuilder de Kysely en Playwright
export interface DatabaseSchema {
  usuario: {
    id_usuario: number;
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    estado: 'ACTIVO' | 'SUSPENDIDO' | 'BANEADO' | 'ELIMINADO';
    activo: boolean;
    logged_out_at: Date | null;
    id_tipodocumento: number;
    documento: string;
    telefono: string | null;
  };
  estudiante: {
    id_estudiante: number;
    id_usuario: number;
    id_colegio: number;
    codigo: string;
    estado: 'ACTIVO' | 'RETIRADO' | 'EXPULSADO' | 'GRADUADO';
  };
  token_blacklist: {
    jti: string;
    created_at: Date;
  };
  codigo_verificacion_email: {
    id_verificacion: number;
    email: string;
    codigo: string;
    tipo: string;
    verified: boolean;
    expires_at: Date;
    created_at: Date;
  };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/AcademiaNeivaTest',
});

export const db = new Kysely<DatabaseSchema>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export class DbHelper {
  static async getUserByEmail(email: string) {
    return await db
      .selectFrom('usuario')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();
  }

  static async setUserStatus(email: string, estado: 'ACTIVO' | 'SUSPENDIDO' | 'BANEADO' | 'ELIMINADO') {
    return await db
      .updateTable('usuario')
      .set({ estado, activo: estado === 'ACTIVO' })
      .where('email', '=', email)
      .execute();
  }

  static async isTokenBlacklisted(jti: string) {
    const record = await db
      .selectFrom('token_blacklist')
      .selectAll()
      .where('jti', '=', jti)
      .executeTakeFirst();
    return !!record;
  }

  static async getStudentByCode(codigo: string) {
    return await db
      .selectFrom('estudiante')
      .innerJoin('usuario', 'usuario.id_usuario', 'estudiante.id_usuario')
      .selectAll()
      .where('estudiante.codigo', '=', codigo)
      .executeTakeFirst();
  }

  static async close() {
    await pool.end();
  }
}
