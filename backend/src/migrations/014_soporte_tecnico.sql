-- Migración para crear la tabla de tickets de soporte técnico
CREATE TABLE IF NOT EXISTS tickets_soporte (
  id_ticket SERIAL PRIMARY KEY,
  id_usuario INTEGER REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  nombre_remitente VARCHAR(155) NOT NULL,
  correo_remitente VARCHAR(155) NOT NULL,
  telefono VARCHAR(50),
  tipo_incidencia VARCHAR(100) NOT NULL,
  asunto VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  estado VARCHAR(50) DEFAULT 'ABIERTO', -- 'ABIERTO', 'EN_PROCESO', 'RESUELTO'
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  id_colegio INTEGER REFERENCES colegio(id_colegio) ON DELETE CASCADE
);
