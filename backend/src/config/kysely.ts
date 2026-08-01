import { Kysely, PostgresDialect } from 'kysely';
import { pool } from './db';
import { DB } from '../types/db.types';

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
});
