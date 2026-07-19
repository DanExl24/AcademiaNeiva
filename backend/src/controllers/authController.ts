import { Request, Response } from "express";
import { pool } from "../config/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (typeof email !== "string" || !email.trim()) {
    res.status(400).json({ error: "El correo o código es obligatorio" });
    return;
  }

  const credential = email.trim();

  try {
    if (credential.includes("@")) {
      // --- LOGIN GENERAL (Email: directivo, docente, padre, admin_general) ---
      const userRes = await pool.query(
        `SELECT u.*, array_agg(r.nombre) as roles
         FROM usuario u
         JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE u.email = $1
         GROUP BY u.id_usuario`,
        [credential]
      );

      if (userRes.rows.length === 0) {
        res.status(401).json({ error: "Credenciales incorrectas" });
        return;
      }

      const user = userRes.rows[0];

      // Verificar estado del usuario
      if (user.estado === 'BANEADO') {
        res.status(403).json({ error: "Tu cuenta ha sido baneada. Contacta al administrador." });
        return;
      }
      if (user.estado === 'SUSPENDIDO') {
        res.status(403).json({ error: "Tu cuenta se encuentra suspendida." });
        return;
      }
      if (user.estado === 'ELIMINADO') {
        res.status(401).json({ error: "Credenciales incorrectas" });
        return;
      }

      // Verificar estado del colegio (si el usuario pertenece a uno)
      if (user.id_colegio) {
        const colegioRes = await pool.query(
          'SELECT estado FROM colegio WHERE id_colegio = $1',
          [user.id_colegio]
        );
        if (colegioRes.rows.length > 0) {
          const estadoColegio = colegioRes.rows[0].estado;
          if (estadoColegio === 'PENDIENTE') {
            res.status(403).json({ error: "El colegio asociado aún no ha sido aprobado." });
            return;
          }
          if (estadoColegio === 'SUSPENDIDO') {
            res.status(403).json({ error: "El colegio asociado se encuentra suspendido." });
            return;
          }
          if (estadoColegio === 'RECHAZADO' || estadoColegio === 'ELIMINADO') {
            res.status(403).json({ error: "El colegio asociado no tiene acceso al sistema." });
            return;
          }
        }
      }

      // Verificar contraseña
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        res.status(401).json({ error: "Credenciales incorrectas" });
        return;
      }

      // Query schoolIds for parent
      let schoolIds: number[] = [];
      if (user.roles.includes("padre")) {
        const parentInfoRes = await pool.query(
          `SELECT id_padrefamilia FROM padre_familia WHERE id_usuario = $1`,
          [user.id_usuario]
        );
        if (parentInfoRes.rows.length > 0) {
          const idPadre = parentInfoRes.rows[0].id_padrefamilia;
          const schoolsRes = await pool.query(
            `SELECT DISTINCT id_colegio FROM detalle_padrefamilia WHERE id_padrefamilia = $1`,
            [idPadre]
          );
          schoolIds = schoolsRes.rows.map(r => Number(r.id_colegio));
        }
      }

      // Generar JWT
      const jti = crypto.randomUUID();
      const token = jwt.sign(
        { 
          id: user.id_usuario, 
          email: user.email, 
          role: user.roles[0], 
          roles: user.roles,
          schoolId: user.id_colegio,
          schoolIds: schoolIds.length > 0 ? schoolIds : undefined,
          jti
        },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      const { password: _, ...userWithoutPassword } = user;
      res.json({
        user: {
          id: userWithoutPassword.id_usuario,
          name: userWithoutPassword.nombre,
          email: userWithoutPassword.email,
          role: userWithoutPassword.roles[0],
          roles: userWithoutPassword.roles,
          schoolId: userWithoutPassword.id_colegio,
          schoolIds: schoolIds.length > 0 ? schoolIds : undefined
        },
        token
      });

    } else {
      // --- LOGIN ESTUDIANTE (Código: e.g. EST-1-12) ---
      const studentRes = await pool.query(
        `SELECT e.id_usuario, e.estado AS estado_estudiante, u.email, u.nombre, u.password, u.id_colegio, u.estado, array_agg(r.nombre) as roles
         FROM estudiante e
         JOIN usuario u ON e.id_usuario = u.id_usuario
         JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE e.codigo = $1
         GROUP BY e.id_usuario, e.estado, u.email, u.nombre, u.password, u.id_colegio, u.estado`,
        [credential]
      );

      if (studentRes.rows.length === 0) {
        res.status(401).json({ error: "Código o contraseña incorrectos" });
        return;
      }

      const user = studentRes.rows[0];

      // Verificar estado del estudiante (expulsado no puede ingresar)
      if (user.estado_estudiante === 'EXPULSADO') {
        res.status(403).json({ error: "Tu cuenta ha sido suspendida por expulsión. No tienes acceso al sistema." });
        return;
      }

      // Verificar estado del usuario
      if (user.estado !== 'ACTIVO') {
        res.status(403).json({ error: "Tu cuenta no se encuentra activa. Contacta al administrador." });
        return;
      }

      // Verificar contraseña
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        res.status(401).json({ error: "Código o contraseña incorrectos" });
        return;
      }

      // Generar JWT
      const jti = crypto.randomUUID();
      const token = jwt.sign(
        { 
          id: user.id_usuario, 
          email: user.email, 
          role: "estudiante", 
          roles: user.roles,
          schoolId: user.id_colegio,
          jti
        },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.json({
        user: {
          id: user.id_usuario,
          name: user.nombre,
          email: user.email,
          role: "estudiante",
          roles: user.roles,
          schoolId: user.id_colegio
        },
        token
      });
    }
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const studentLogin = async (req: Request, res: Response): Promise<void> => {
  const { codigo, password } = req.body;

  try {
    // 1. Buscar el estudiante por su código (incluye estado del estudiante)
    const studentRes = await pool.query(
      `SELECT e.id_usuario, e.estado AS estado_estudiante, u.email, u.nombre, u.password, u.id_colegio, u.estado, array_agg(r.nombre) as roles
       FROM estudiante e
       JOIN usuario u ON e.id_usuario = u.id_usuario
       JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE e.codigo = $1
       GROUP BY e.id_usuario, e.estado, u.email, u.nombre, u.password, u.id_colegio, u.estado`,
      [codigo]
    );

    if (studentRes.rows.length === 0) {
      res.status(401).json({ error: "Código o contraseña incorrectos" });
      return;
    }

    const user = studentRes.rows[0];

    // Verificar estado del estudiante (expulsado no puede ingresar)
    if (user.estado_estudiante === 'EXPULSADO') {
      res.status(403).json({ error: "Tu cuenta ha sido suspendida por expulsión. No tienes acceso al sistema." });
      return;
    }

    // Verificar estado del usuario
    if (user.estado !== 'ACTIVO') {
      res.status(403).json({ error: "Tu cuenta no se encuentra activa. Contacta al administrador." });
      return;
    }

    // 2. Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: "Código o contraseña incorrectos" });
      return;
    }

    // 3. Generar JWT
    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { 
        id: user.id_usuario, 
        email: user.email, 
        role: "estudiante", 
        roles: user.roles,
        schoolId: user.id_colegio,
        jti
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // 4. Responder
    res.json({
      user: {
        id: user.id_usuario,
        name: user.nombre,
        email: user.email,
        role: "estudiante",
        roles: user.roles,
        schoolId: user.id_colegio
      },
      token
    });

  } catch (error: any) {
    console.error("Student Login error:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getSchoolIdentity = async (req: Request, res: Response): Promise<void> => {
  const schoolId = Number(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const schoolRes = await pool.query(
      `SELECT id_colegio, nombre, escudo_url, color_primario, color_secundario 
       FROM colegio 
       WHERE id_colegio = $1`,
      [schoolId]
    );

    if (schoolRes.rows.length === 0) {
      res.status(404).json({ error: "Colegio no encontrado" });
      return;
    }

    const school = schoolRes.rows[0];
    
    const DEFAULT_PRIMARY = "#4f46e5";
    const DEFAULT_SECONDARY = "#0f172a";

    res.json({
      id_colegio: school.id_colegio,
      nombre: school.nombre,
      escudo_url: school.escudo_url || null,
      color_primario: school.color_primario || DEFAULT_PRIMARY,
      color_secundario: school.color_secundario || DEFAULT_SECONDARY
    });
  } catch (error: any) {
    console.error("Error getting school identity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

/**
 * GET /api/auth/verify
 * Verifica que el JWT sea válido y que el usuario siga activo.
 * Usado por el frontend en el router guard para evitar acceso con tokens expirados/invalidados.
 */
export const verifySession = async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ valid: false, error: 'Token requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Verificar blacklist
    if (decoded.jti) {
      const blacklistRes = await pool.query(
        'SELECT 1 FROM token_blacklist WHERE jti = $1',
        [decoded.jti]
      );
      if (blacklistRes.rows.length > 0) {
        res.status(401).json({ valid: false, error: 'Sesión invalidada' });
        return;
      }
    }

    // Verificar estado del usuario e invalidación global
    const userDbRes = await pool.query(
      'SELECT estado, logged_out_at FROM usuario WHERE id_usuario = $1',
      [decoded.id]
    );

    if (userDbRes.rows.length === 0) {
      res.status(401).json({ valid: false, error: 'Usuario no encontrado' });
      return;
    }

    const dbUser = userDbRes.rows[0];

    if (dbUser.estado !== 'ACTIVO') {
      res.status(401).json({ valid: false, error: 'Cuenta inactiva o suspendida' });
      return;
    }

    if (dbUser.logged_out_at && decoded.iat) {
      const loggedOutTime = new Date(dbUser.logged_out_at).getTime();
      const tokenIssuedTime = decoded.iat * 1000;
      if (tokenIssuedTime < loggedOutTime) {
        res.status(401).json({ valid: false, error: 'Sesión expirada' });
        return;
      }
    }

    res.json({ valid: true, userId: decoded.id });
  } catch {
    res.status(401).json({ valid: false, error: 'Token inválido o expirado' });
  }
};

export const updateProfileEmail = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { nuevo_email } = req.body;

  if (!user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  if (!nuevo_email || !nuevo_email.includes("@")) {
    res.status(400).json({ error: "Debe proporcionar un correo electrónico válido." });
    return;
  }

  try {
    const userId = Number(user.id);
    
    // Verificar si el correo ya está en uso por otro usuario
    const checkRes = await pool.query(
      'SELECT 1 FROM usuario WHERE email = $1 AND id_usuario != $2',
      [nuevo_email.trim(), userId]
    );

    if (checkRes.rows.length > 0) {
      res.status(400).json({ error: "El correo electrónico ya se encuentra registrado en el sistema." });
      return;
    }

    // Actualizar correo
    await pool.query(
      'UPDATE usuario SET email = $1 WHERE id_usuario = $2',
      [nuevo_email.trim(), userId]
    );

    res.json({ message: "Correo electrónico actualizado exitosamente." });
  } catch (error) {
    console.error("Error updating profile email:", error);
    res.status(500).json({ error: "Error al actualizar el correo electrónico." });
  }
};

export const updateProfilePassword = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { password_actual, nueva_password } = req.body;

  if (!user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  if (!password_actual || !nueva_password || nueva_password.length < 6) {
    res.status(400).json({ error: "Debe proporcionar la contraseña actual y una nueva contraseña de al menos 6 caracteres." });
    return;
  }

  try {
    const userId = Number(user.id);
    
    // Obtener contraseña actual hasheada
    const userRes = await pool.query(
      'SELECT password FROM usuario WHERE id_usuario = $1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }

    const dbPassword = userRes.rows[0].password;

    // Verificar contraseña actual
    const validPassword = await bcrypt.compare(password_actual, dbPassword);
    if (!validPassword) {
      res.status(400).json({ error: "La contraseña actual es incorrecta." });
      return;
    }

    // Hashear y actualizar la nueva contraseña
    const hashedNew = await bcrypt.hash(nueva_password, 10);
    await pool.query(
      'UPDATE usuario SET password = $1 WHERE id_usuario = $2',
      [hashedNew, userId]
    );

    res.json({ message: "Contraseña actualizada exitosamente." });
  } catch (error) {
    console.error("Error updating profile password:", error);
    res.status(500).json({ error: "Error al actualizar la contraseña." });
  }
};

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  try {
    const userId = Number(user.id);
    
    // Obtener los datos básicos de la tabla usuario
    const userRes = await pool.query(
      `SELECT id_usuario, nombre, apellido, email, estado, fecha_creacion
       FROM usuario WHERE id_usuario = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "Usuario no encontrado." });
      return;
    }

    const basicUser = userRes.rows[0];
    
    // El rol lo tomamos del token del middleware (user.role)
    const userRole = (user.role || '').toUpperCase();
    
    let documento = null;
    let tipo_documento = null;

    // Buscar documento y tipo según el rol del usuario en su respectiva tabla
    if (userRole === 'DOCENTE') {
      const docRes = await pool.query(
        `SELECT d.documento, td.tipo AS tipo_documento 
         FROM docente d 
         LEFT JOIN tipo_documento td ON d.id_tipodocumento = td.id_tipodocumento 
         WHERE d.id_usuario = $1`,
        [userId]
      );
      if (docRes.rows.length > 0) {
        documento = docRes.rows[0].documento;
        tipo_documento = docRes.rows[0].tipo_documento;
      }
    } else if (userRole === 'PADRE') {
      const docRes = await pool.query(
        `SELECT p.documento, td.tipo AS tipo_documento 
         FROM padre_familia p 
         LEFT JOIN tipo_documento td ON p.id_tipodocumento = td.id_tipodocumento 
         WHERE p.id_usuario = $1`,
        [userId]
      );
      if (docRes.rows.length > 0) {
        documento = docRes.rows[0].documento;
        tipo_documento = docRes.rows[0].tipo_documento;
      }
    } else if (userRole === 'ESTUDIANTE') {
      const docRes = await pool.query(
        `SELECT e.documento, td.tipo AS tipo_documento 
         FROM estudiante e 
         LEFT JOIN tipo_documento td ON e.id_tipodocumento = td.id_tipodocumento 
         WHERE e.id_usuario = $1`,
        [userId]
      );
      if (docRes.rows.length > 0) {
        documento = docRes.rows[0].documento;
        tipo_documento = docRes.rows[0].tipo_documento;
      }
    }

    // Retornamos el objeto unificado
    res.json({
      user: {
        ...basicUser,
        rol: userRole,
        documento: documento || 'No Registrado',
        tipo_documento: tipo_documento || 'No Registrado'
      }
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Error al consultar los datos del perfil." });
  }
};


