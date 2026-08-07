-- Migration 027: Agregar estado 'CORREGIDA' a estado_matricula ENUM
ALTER TYPE public.estado_matricula ADD VALUE IF NOT EXISTS 'CORREGIDA';
