import { Request, Response } from "express";
import { pool } from "../config/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export class AuthController {
  static async login(req: Request, res: Response) {
    const { email, password, schoolId } = req.body;

    try {
      const userRes = await pool.query(
        "SELECT * FROM usuario WHERE correo = $1 AND id_colegio = $2",
        [email, schoolId]
      );

      if (userRes.rows.length === 0) {
        return res.status(401).json({ message: "Credenciales inválidas o colegio incorrecto" });
      }

      const user = userRes.rows[0];
      const validPass = await bcrypt.compare(password, user.password);

      if (!validPass) {
        return res.status(401).json({ message: "Contraseña incorrecta" });
      }

      // Obtener roles
      const rolesRes = await pool.query(
        `SELECT r.nombre 
         FROM usuario_rol ur
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE ur.id_usuario = $1`,
        [user.id_usuario]
      );
      const roles = rolesRes.rows.map(r => r.nombre.toLowerCase());

      // Obtener IDs de entidades relacionadas
      const entities: any = {};
      
      if (roles.includes('docente')) {
        const dRes = await pool.query("SELECT id_docente FROM docente WHERE id_usuario = $1", [user.id_usuario]);
        if (dRes.rows.length > 0) entities.docenteId = dRes.rows[0].id_docente;
      }
      
      if (roles.includes('padre_familia')) {
        const pRes = await pool.query("SELECT id_padrefamilia FROM padre_familia WHERE id_usuario = $1", [user.id_usuario]);
        if (pRes.rows.length > 0) entities.padreId = pRes.rows[0].id_padrefamilia;
      }
      
      if (roles.includes('estudiante')) {
        const eRes = await pool.query("SELECT id_estudiante, id_grado FROM estudiante WHERE id_usuario = $1", [user.id_usuario]);
        if (eRes.rows.length > 0) {
          entities.studentId = eRes.rows[0].id_estudiante;
          entities.gradoId = eRes.rows[0].id_grado;
        }
      }

      if (roles.includes('directivo')) {
        const dirRes = await pool.query("SELECT id FROM directivo WHERE id_usuario = $1", [user.id_usuario]);
        if (dirRes.rows.length > 0) entities.directivoId = dirRes.rows[0].id;
      }

      const token = jwt.sign(
        { id: user.id_usuario, email: user.correo, roles, schoolId: user.id_colegio, ...entities },
        process.env.JWT_SECRET || "secret_key",
        { expiresIn: "8h" }
      );

      res.json({
        token,
        user: {
          id: user.id_usuario,
          email: user.correo,
          roles,
          schoolId: user.id_colegio,
          ...entities
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Error en el servidor" });
    }
  }

  static async studentLogin(req: Request, res: Response) {
    const { studentCode, password } = req.body;

    try {
      if (!studentCode || !password) {
        return res.status(400).json({ message: "Código y contraseña requeridos" });
      }

      // Buscar estudiante por código
      const studentRes = await pool.query(
        `SELECT e.*, u.correo, u.password as hashed_password, u.id_colegio 
         FROM estudiante e
         JOIN usuario u ON e.id_usuario = u.id_usuario
         WHERE e.codigo = $1`,
        [studentCode]
      );

      if (studentRes.rows.length === 0) {
        return res.status(401).json({ message: "Código estudiantil no encontrado" });
      }

      const student = studentRes.rows[0];

      // Verificar contraseña
      const validPass = await bcrypt.compare(password, student.hashed_password);
      if (!validPass) {
        return res.status(401).json({ message: "Contraseña incorrecta" });
      }
      
      // Obtener roles (debería tener al menos 'estudiante')
      const rolesRes = await pool.query(
        `SELECT r.nombre 
         FROM usuario_rol ur
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE ur.id_usuario = $1`,
        [student.id_usuario]
      );
      const roles = rolesRes.rows.map(r => r.nombre.toLowerCase());

      const entities = {
        studentId: student.id_estudiante,
        gradoId: student.id_grado
      };

      const token = jwt.sign(
        { 
          id: student.id_usuario, 
          email: student.correo, 
          roles, 
          schoolId: student.id_colegio, 
          ...entities 
        },
        process.env.JWT_SECRET || "secret_key",
        { expiresIn: "8h" }
      );

      res.json({
        token,
        user: {
          id: student.id_usuario,
          email: student.correo,
          roles,
          schoolId: student.id_colegio,
          ...entities
        }
      });
    } catch (error) {
      console.error("Student login error:", error);
      res.status(500).json({ message: "Error en el servidor" });
    }
  }
}
