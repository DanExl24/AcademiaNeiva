-- Centralización de Usuarios y Roles

-- Eliminar si existen para recrear con estructura correcta
DROP TABLE IF EXISTS usuario_rol CASCADE;
DROP TABLE IF EXISTS usuario CASCADE;
DROP TABLE IF EXISTS rol CASCADE;

-- 1. Tabla de Roles
CREATE TABLE rol (
    id_rol SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
);

-- 2. Tabla de Usuarios Centralizada (Sin id_colegio - multicolegio desacoplado en usuario_colegio)
CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    apellido VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Relación Usuario-Rol (Muchos a Muchos)
CREATE TABLE usuario_rol (
    id_usuario INTEGER REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_rol INTEGER REFERENCES rol(id_rol) ON DELETE CASCADE,
    PRIMARY KEY (id_usuario, id_rol)
);

-- 4. Índices para rendimiento
CREATE INDEX idx_usuario_email ON usuario(email);
