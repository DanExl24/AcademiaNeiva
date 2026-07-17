BEGIN;

-- Crear tabla catálogo de dimensiones
CREATE TABLE IF NOT EXISTS public.dimensiones_preescolar (
    id_dimension SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

-- Insertar las dimensiones por defecto
INSERT INTO public.dimensiones_preescolar (nombre) VALUES
    ('Comunicativa'),
    ('Cognitiva'),
    ('Corporal'),
    ('Socioafectiva'),
    ('Estética'),
    ('Ética y Valores')
ON CONFLICT (nombre) DO NOTHING;

-- Agregar relación a la tabla competencias
ALTER TABLE public.competencias 
ADD COLUMN IF NOT EXISTS id_dimension INTEGER REFERENCES public.dimensiones_preescolar(id_dimension) ON DELETE SET NULL;

-- Crear tabla de asociación intermedia de muchos a muchos entre dba y dimensiones
CREATE TABLE IF NOT EXISTS public.dba_dimensiones_preescolar (
    id_dba INTEGER NOT NULL REFERENCES public.dba(id_dba) ON DELETE CASCADE,
    id_dimension INTEGER NOT NULL REFERENCES public.dimensiones_preescolar(id_dimension) ON DELETE CASCADE,
    PRIMARY KEY (id_dba, id_dimension)
);

COMMIT;
