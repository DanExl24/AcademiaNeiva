const fs = require('fs');
const path = require('path');

const collection = {
  info: {
    name: "AcademiaNeiva API Collection",
    description: "Colección oficial de Postman para probar todos los módulos y endpoints de la plataforma AcademiaNeiva.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000", type: "string" },
    { key: "token", value: "", type: "string" },
    { key: "schoolId", value: "1", type: "string" },
    { key: "yearId", value: "1", type: "string" }
  ],
  auth: {
    type: "bearer",
    bearer: [
      { key: "token", value: "{{token}}", type: "string" }
    ]
  },
  item: [
    {
      name: "01. Autenticación y Usuarios",
      item: [
        {
          name: "Login Admin General",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.token) {",
                  "  pm.collectionVariables.set('token', jsonData.token);",
                  "  pm.environment.set('token', jsonData.token);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                documento: "100000000",
                password: "adminGeneral123"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/auth/login",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "login"]
            }
          }
        },
        {
          name: "Login Directivo (CEA School)",
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "if (jsonData.token) {",
                  "  pm.collectionVariables.set('token', jsonData.token);",
                  "  pm.environment.set('token', jsonData.token);",
                  "}"
                ],
                type: "text/javascript"
              }
            }
          ],
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                documento: "1075214001",
                password: "directivo123"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/auth/login",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "login"]
            }
          }
        },
        {
          name: "Verificar Documento",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/auth/check-document/1075214001",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "check-document", "1075214001"]
            }
          }
        }
      ]
    },
    {
      name: "02. Gestión de Colegios (Admin General)",
      item: [
        {
          name: "Listar Colegios",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/admin-general/colegios",
              host: ["{{baseUrl}}"],
              path: ["api", "admin-general", "colegios"]
            }
          }
        },
        {
          name: "Detalle Colegio",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/admin-general/colegios/{{schoolId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "admin-general", "colegios", "{{schoolId}}"]
            }
          }
        }
      ]
    },
    {
      name: "03. Catálogo DBA Nacional",
      item: [
        {
          name: "Listar DBA",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/admin/dba",
              host: ["{{baseUrl}}"],
              path: ["api", "admin", "dba"]
            }
          }
        },
        {
          name: "Estadísticas DBA",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/admin/dba/estadisticas",
              host: ["{{baseUrl}}"],
              path: ["api", "admin", "dba", "estadisticas"]
            }
          }
        },
        {
          name: "Obtener Versiones Curriculares",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/admin/dba/versiones",
              host: ["{{baseUrl}}"],
              path: ["api", "admin", "dba", "versiones"]
            }
          }
        }
      ]
    },
    {
      name: "04. Estructura Escolar y Cupos",
      item: [
        {
          name: "Obtener Cursos Disponibles (Grupos/Secciones)",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/school-structure/available-courses?id_colegio={{schoolId}}&nivel=PRIMARIA&tipo_grado=PRIMERO&jornada=1",
              host: ["{{baseUrl}}"],
              path: ["api", "school-structure", "available-courses"],
              query: [
                { key: "id_colegio", value: "{{schoolId}}" },
                { key: "nivel", value: "PRIMARIA" },
                { key: "tipo_grado", value: "PRIMERO" },
                { key: "jornada", value: "1" }
              ]
            }
          }
        }
      ]
    },
    {
      name: "05. Matrículas y Traslados",
      item: [
        {
          name: "Listar Solicitudes de Traslado (Admin General)",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/traslados/admin/solicitudes",
              host: ["{{baseUrl}}"],
              path: ["api", "traslados", "admin", "solicitudes"]
            }
          }
        },
        {
          name: "Listar Solicitudes de Traslado (Directivo Colegio)",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/traslados/colegio/{{schoolId}}/solicitudes",
              host: ["{{baseUrl}}"],
              path: ["api", "traslados", "colegio", "{{schoolId}}", "solicitudes"]
            }
          }
        }
      ]
    },
    {
      name: "06. Docentes y Panel Académico",
      item: [
        {
          name: "Obtener Cursos Asignados al Docente",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/teacher/courses",
              host: ["{{baseUrl}}"],
              path: ["api", "teacher", "courses"]
            }
          }
        },
        {
          name: "Obtener Estudiantes por Grupo",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/teacher/courses/1/students",
              host: ["{{baseUrl}}"],
              path: ["api", "teacher", "courses", "1", "students"]
            }
          }
        }
      ]
    },
    {
      name: "07. Estudiantes y Padres",
      item: [
        {
          name: "Listar Estudiantes del Colegio",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/students/colegio/{{schoolId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "students", "colegio", "{{schoolId}}"]
            }
          }
        },
        {
          name: "Listar Padres de Familia (Gestión Directivo)",
          request: {
            method: "GET",
            url: {
              raw: "{{baseUrl}}/api/parents-management/colegio/{{schoolId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "parents-management", "colegio", "{{schoolId}}"]
            }
          }
        }
      ]
    }
  ]
};

const environment = {
  id: "academianeiva-env",
  name: "AcademiaNeiva Local Environment",
  values: [
    { key: "baseUrl", value: "http://localhost:3000", enabled: true },
    { key: "token", value: "", enabled: true },
    { key: "schoolId", value: "1", enabled: true },
    { key: "yearId", value: "1", enabled: true }
  ]
};

const outDir = path.join(__dirname, "../../../guides/postman");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, "AcademiaNeiva.postman_collection.json"), JSON.stringify(collection, null, 2));
fs.writeFileSync(path.join(outDir, "AcademiaNeiva.postman_environment.json"), JSON.stringify(environment, null, 2));

console.log("✅ Archivos de Postman generados con éxito en guides/postman/");
