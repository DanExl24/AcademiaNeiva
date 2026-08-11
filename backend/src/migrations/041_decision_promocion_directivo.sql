-- Migración 041: Crear tabla decision_promocion_directivo para registro de decisiones institucionales de promoción

CREATE TABLE IF NOT EXISTS public.decision_promocion_directivo (
    id_decision SERIAL PRIMARY KEY,
    id_estudiante INTEGER NOT NULL REFERENCES public.estudiante(id_estudiante) ON DELETE CASCADE,
    id_colegio INTEGER NOT NULL REFERENCES public.colegio(id_colegio) ON DELETE CASCADE,
    id_anio_anterior INTEGER NOT NULL REFERENCES public.anio_lectivo(id_anio) ON DELETE CASCADE,
    resultado_calculado VARCHAR(50) NOT NULL,
    decision_tomada VARCHAR(50) NOT NULL,
    id_grado_anterior INTEGER REFERENCES public.grados(id_grado) ON DELETE SET NULL,
    id_grado_asignado INTEGER REFERENCES public.grados(id_grado) ON DELETE SET NULL,
    id_usuario_decision INTEGER NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    fecha_decision TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    observacion TEXT
);

CREATE INDEX IF NOT EXISTS idx_decision_promocion_estudiante ON public.decision_promocion_directivo (id_estudiante, id_colegio);
CREATE INDEX IF NOT EXISTS idx_decision_promocion_anio ON public.decision_promocion_directivo (id_anio_anterior);
