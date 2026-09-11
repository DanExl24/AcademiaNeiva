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
      .leftJoin("padre_familia as pf", "pf.id_usuario", "u.id_usuario")
      .select([
        "u.id_usuario",
        "u.nombre",
        "u.apellido",
        "u.email",
        "u.telefono",
        "u.id_tipodocumento",
        "pf.nombre as pf_nombre",
        "pf.apellido as pf_apellido",
        sql<string[]>`array_agg(r.nombre)`.as("roles")
      ])
      .where("u.documento", "=", document)
      .groupBy([
        "u.id_usuario",
        "u.nombre",
        "u.apellido",
        "u.email",
        "u.telefono",
        "u.id_tipodocumento",
        "pf.nombre",
        "pf.apellido"
      ])
      .executeTakeFirst();

    if (user) {
      let finalNombre = user.nombre;
      let finalApellido = user.apellido;

      // Si en usuario está como marcador genérico 'Padre Familia', pero en padre_familia está su nombre real:
      const isPlaceholder = (finalNombre === 'Padre' && finalApellido === 'Familia') || !finalNombre || !finalApellido;
      if (isPlaceholder) {
        if (user.pf_nombre && user.pf_apellido) {
          finalNombre = user.pf_nombre;
          finalApellido = user.pf_apellido;
        }

        // Auto-reparar la tabla usuario para futuras consultas
        if (finalNombre !== 'Padre' || finalApellido !== 'Familia') {
          await db
            .updateTable("usuario")
            .set({ nombre: finalNombre, apellido: finalApellido })
            .where("id_usuario", "=", user.id_usuario)
            .execute();
        }
      }

      const roles: string[] = user.roles || [];
      let displayRole = 'usuario';
      if (roles.includes('admin_general') || roles.includes('admin')) displayRole = 'admin';
      else if (roles.includes('directivo')) displayRole = 'directivo';
      else if (roles.includes('docente')) displayRole = 'docente';
      else if (roles.includes('padre')) displayRole = 'padre de familia';
      else if (roles.includes('estudiante')) displayRole = 'estudiante';

      res.json({
        exists: true,
        user: { 
          id_usuario: user.id_usuario,
          nombre: finalNombre, 
          apellido: finalApellido, 
          email: user.email,
          telefono: user.telefono,
          id_tipodocumento: user.id_tipodocumento 
        },
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
