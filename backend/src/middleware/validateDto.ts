import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';

/**
 * Middleware genérico para validar solicitudes HTTP contra esquemas Zod.
 * Soporta validación de body, query y params o validación directa del body.
 */
export const validateDto = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Determinar si el esquema define 'body', 'query' o 'params' en la raíz
      const def = (schema as any)?._def;
      const shape = def?.shape ? (typeof def.shape === 'function' ? def.shape() : def.shape) : null;
      const isWrappedSchema = shape && ('body' in shape || 'query' in shape || 'params' in shape);

      const targetToParse = isWrappedSchema
        ? { body: req.body, query: req.query, params: req.params }
        : req.body;

      const parsed: any = await schema.parseAsync(targetToParse);

      if (parsed && typeof parsed === 'object') {
        if (isWrappedSchema) {
          if (parsed.body) req.body = parsed.body;
          if (parsed.query) req.query = parsed.query;
          if (parsed.params) req.params = parsed.params;
        } else {
          req.body = parsed;
        }
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues || (error as any).errors || [];
        const details = issues.map((err: any) => ({
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
