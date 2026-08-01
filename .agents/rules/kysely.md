---
trigger: model_decision
description: Al requerir nuevas consultas o actualizacion de consultas manuales en SQL
---

El proyecto ahora mismo tiene incorporado kysely, una libreria que su funcion es:
Ser de querybuilder sql con tipado de Typescript.
Kysely sabe:

qué tablas existen
qué columnas tiene cada tabla
el tipo de cada columna
si una columna no existe
si intentas insertar un tipo incorrecto
La generacion de kysely esta en el archivo db.types.ts
Por que es recomendable usar kysely?
Construye consultas SQL.
Evita errores de columnas y tipos.
Hace el acceso a la base de datos mucho más seguro.
Es importante empezar a usar kyseky para mayor seguridad y rapidez en las consultas SQL
