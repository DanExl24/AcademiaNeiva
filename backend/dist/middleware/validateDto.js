"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDto = void 0;
const zod_1 = require("zod");
/**
 * Middleware genérico para validar solicitudes HTTP contra esquemas Zod.
 * Soporta validación de body, query y params.
 */
const validateDto = (schema) => {
    return async (req, res, next) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            if (parsed && typeof parsed === 'object') {
                if (parsed.body)
                    req.body = parsed.body;
                if (parsed.query)
                    req.query = parsed.query;
                if (parsed.params)
                    req.params = parsed.params;
            }
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const issues = error.issues || error.errors || [];
                const details = issues.map((err) => ({
                    field: String(err.path.join('.')).replace(/^(body|query|params)\./, ''),
                    message: err.message
                }));
                console.error(`\x1b[31m[DTO Validation Error] ${req.method} ${req.originalUrl}\x1b[0m`);
                console.error(JSON.stringify(details, null, 2));
                const mainErrorMessage = details.length > 0 && details[0].message
                    ? details[0].message
                    : 'El número de documento o los datos ingresados no son correctos.';
                res.status(400).json({
                    error: mainErrorMessage,
                    details
                });
                return;
            }
            console.error(`\x1b[31m[Validation Error] ${req.method} ${req.originalUrl}:\x1b[0m`, error);
            next(error);
        }
    };
};
exports.validateDto = validateDto;
