import { Request, Response } from "express";
import { pool } from "../config/db";

export const checkDocument = async (req: Request, res: Response): Promise<void> => {
  const { document } = req.params;

  try {
    // 1. Buscar en tabla docente (tiene campo documento directo)
    const docenteRes = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.email,
              ARRAY_AGG(r.nombre) as roles
       FROM docente d
       JOIN usuario u ON d.id_usuario = u.id_usuario
       JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE d.documento = $1
       GROUP BY u.id_usuario, u.nombre, u.apellido, u.email`,
      [document]
    );

    if (docenteRes.rows.length > 0) {
      const user = docenteRes.rows[0];
      const roles: string[] = user.roles;
      // Determinar rol principal para mostrar (prioridad: directivo > admin > docente)
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

    // 2. No encontrado en docente, no hay otra tabla de personal con documento
    res.json({ exists: false });
  } catch (error: any) {
    console.error("Error checking document:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};
