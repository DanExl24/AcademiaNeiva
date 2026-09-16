import { db } from '../config/kysely';
import { PoolClient } from 'pg';

/**
 * Resolves the institutional email for a user in a specific school.
 * Resolution order:
 * 1. usuario_colegio_email.email_institucional (if assigned for this user x school)
 * 2. personalEmail parameter fallback
 * 3. usuario.email (personal fallback via extra query)
 */
export async function resolveInstitutionalEmail(
  userId: number,
  schoolId: number,
  personalEmail?: string | null
): Promise<string> {
  const row = await db
    .selectFrom('usuario_colegio_email as uce')
    .select('uce.email_institucional')
    .where('uce.id_usuario', '=', userId)
    .where('uce.id_colegio', '=', schoolId)
    .executeTakeFirst();

  if (row?.email_institucional) {
    return row.email_institucional;
  }

  if (personalEmail) {
    return personalEmail;
  }

  const user = await db
    .selectFrom('usuario')
    .select('email')
    .where('id_usuario', '=', userId)
    .executeTakeFirst();

  return user?.email ?? '';
}

/**
 * Upserts the institutional email for a user in a specific school.
 * If the provided email matches the user's personal email, removes any existing
 * institutional override so the system falls back to personal email naturally.
 * Can be called with a pg PoolClient to run inside an existing transaction.
 */
export async function upsertInstitutionalEmail(
  userId: number,
  schoolId: number,
  email: string,
  personalEmail: string | null | undefined,
  client?: any
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const normalizedPersonal = (personalEmail || '').trim().toLowerCase();

  const executor = (client && typeof client.selectFrom === 'function') ? client : db;

  if (!normalized || normalized === normalizedPersonal) {
    await executor
      .deleteFrom('usuario_colegio_email')
      .where('id_usuario', '=', userId)
      .where('id_colegio', '=', schoolId)
      .execute();
    return;
  }

  await executor
    .insertInto('usuario_colegio_email')
    .values({
      id_usuario: userId,
      id_colegio: schoolId,
      email_institucional: normalized,
    })
    .onConflict((oc: any) =>
      oc.constraint('uq_usuario_colegio_email').doUpdateSet({
        email_institucional: normalized,
      })
    )
    .execute();
}
