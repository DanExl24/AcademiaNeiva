# 📄 Reglas Globales: Documentos de Identidad

Este documento especifica las reglas universales de formato, validación, almacenamiento e integridad para los números de documento de identidad en **AcademiaNeiva**.

---

## 📋 Catálogo de Tipos de Documento y Expresiones Regulares

| ID | Tipo de Documento | Abreviatura | Caracteres Permitidos | Rango de Longitud | Expresión Regular | Ejemplo Válido |
| :-: | :--- | :-: | :--- | :--- | :--- | :--- |
| `1` | **Registro Civil** | RC | Solo números | 6 a 11 dígitos | `/^\d{6,11}$/` | `1075123456` |
| `2` | **Tarjeta de Identidad** | TI | Solo números | 6 a 11 dígitos | `/^\d{6,11}$/` | `1075654321` |
| `3` | **Cédula de Ciudadanía** | CC | Solo números | 6 a 10 dígitos | `/^\d{6,10}$/` | `1234567890` |
| `4` | **Cédula de Extranjería** | CE | Solo números | 1 a 10 dígitos | `/^\d{1,10}$/` | `123456789` |
| `5` | **PEP / PPT** | PEP / PPT | Solo números | 1 a 10 dígitos | `/^\d{1,10}$/` | `987654321` |
| `6` | **Pasaporte** | PAS | Alfanumérico (letras y números) | 1 a 15 caracteres | `/^[a-zA-Z0-9]{1,15}$/` | `AB1234567` |

---

## ⚙️ Comportamiento del Sistema

### 1. Normalización y Formato
- Todo número de documento es procesado mediante la función backend `normalizeDocument()`, la cual elimina espacios al inicio/final y convierte letras a mayúsculas en el caso de Pasaportes.
- No se permiten espacios en blanco, guiones (`-`), puntos (`.`), comas ni símbolos especiales en ningún tipo de documento.

### 2. Mensajes de Error Estandarizados (Backend & Frontend)
- **CC:** *"La Cédula de Ciudadanía debe contener solo números (6 a 10 dígitos)."*
- **TI / RC:** *"El documento debe contener solo números (6 a 11 dígitos)."*
- **CE / PEP / PPT:** *"El documento debe contener solo números (hasta 10 dígitos)."*
- **Pasaporte:** *"El Pasaporte debe ser alfanumérico (hasta 15 caracteres sin espacios ni símbolos)."*

### 3. Unicidad Absoluta
- Un número de documento de identidad es **único en toda la plataforma**, sin importar el colegio ni el rol del usuario.
- Si un usuario ya existe en la base de datos con ese número de documento, el sistema retorna un error `409 Conflict` especificando el titular asociado.

---

## 🗄️ Implementación Física en Base de Datos

En PostgreSQL (tabla `usuario`):
```sql
ALTER TABLE usuario 
ADD CONSTRAINT chk_usuario_documento_format 
CHECK (documento IS NULL OR documento ~ '^[a-zA-Z0-9]+$');
```
