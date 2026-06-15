"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDocument = void 0;
const db_1 = require("../config/db");
const checkDocument = async (req, res) => {
    const { document } = req.params;
    try {
        // 1. Buscar en tabla docente (tiene campo documento directo)
        const docenteRes = await db_1.pool.query(`SELECT u.id_usuario, u.nombre, u.apellido, u.email,
              ARRAY_AGG(r.nombre) as roles
       FROM docente d
       JOIN usuario u ON d.id_usuario = u.id_usuario
       JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE d.documento = $1
       GROUP BY u.id_usuario, u.nombre, u.apellido, u.email`, [document]);
        if (docenteRes.rows.length > 0) {
            const user = docenteRes.rows[0];
            const roles = user.roles;
            // Determinar rol principal para mostrar (prioridad: directivo > admin > docente)
            let displayRole = 'docente';
            if (roles.includes('directivo'))
                displayRole = 'directivo';
            else if (roles.includes('admin'))
                displayRole = 'admin';
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
    }
    catch (error) {
        console.error("Error checking document:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.checkDocument = checkDocument;
