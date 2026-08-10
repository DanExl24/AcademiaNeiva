import { Request, Response } from "express";
import { db } from "../config/kysely";
import { sql } from "kysely";

export const checkDocument = async (req: Request, res: Response): Promise<void> => {
  const { document } = req.params;

  try {
    const user = await db
      .selectFrom("usuario as u")
      .innerJoin("usuario_rol as ur", "ur.id_usuario", "u.id_usuario")
      .innerJoin("rol as r", "r.id_rol", "ur.id_rol")
      .select([
        "u.id_usuario",
        "u.nombre",
        "u.apellido",
        "u.email",
        sql<string[]>`array_agg(r.nombre)`.as("roles")
      ])
      .where("u.documento", "=", document)
      .groupBy(["u.id_usuario", "u.nombre", "u.apellido", "u.email"])
      .executeTakeFirst();

    if (user) {
      const roles: string[] = user.roles;
      let displayRole = 'docente';
      if (roles.includes('directivo')) displayRole = 'directivo';
      else if (roles.includes('admin')) displayRole = 'admin';

      res.json({
        exists: true,
        user: { nombre: user.nombre, apellido: user.apellido, email: user.email },
        role: displayRole,
        roles: roles
      });
      return;
    }

    res.json({ exists: false });
  } catch (error: any) {
    console.error("Error checking document:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};
