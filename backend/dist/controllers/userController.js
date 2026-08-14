"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDocument = void 0;
const kysely_1 = require("../config/kysely");
const kysely_2 = require("kysely");
const checkDocument = async (req, res) => {
    const { document } = req.params;
    try {
        const user = await kysely_1.db
            .selectFrom("usuario as u")
            .innerJoin("usuario_rol as ur", "ur.id_usuario", "u.id_usuario")
            .innerJoin("rol as r", "r.id_rol", "ur.id_rol")
            .select([
            "u.id_usuario",
            "u.nombre",
            "u.apellido",
            "u.email",
            "u.id_tipodocumento",
            (0, kysely_2.sql) `array_agg(r.nombre)`.as("roles")
        ])
            .where("u.documento", "=", document)
            .groupBy(["u.id_usuario", "u.nombre", "u.apellido", "u.email", "u.id_tipodocumento"])
            .executeTakeFirst();
        if (user) {
            const roles = user.roles || [];
            let displayRole = 'usuario';
            if (roles.includes('admin_general') || roles.includes('admin'))
                displayRole = 'admin';
            else if (roles.includes('directivo'))
                displayRole = 'directivo';
            else if (roles.includes('docente'))
                displayRole = 'docente';
            else if (roles.includes('padre'))
                displayRole = 'padre de familia';
            else if (roles.includes('estudiante'))
                displayRole = 'estudiante';
            res.json({
                exists: true,
                user: {
                    id_usuario: user.id_usuario,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    email: user.email,
                    id_tipodocumento: user.id_tipodocumento
                },
                role: displayRole,
                roles: roles
            });
            return;
        }
        res.json({ exists: false });
    }
    catch (error) {
        console.error("Error checking document:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.checkDocument = checkDocument;
