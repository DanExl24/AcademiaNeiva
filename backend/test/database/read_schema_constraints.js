const fs = require("fs");
const path = require("path");

const filePath = "c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql";
const content = fs.readFileSync(filePath, "utf-8");

const lines = content.split("\n");
console.log("=== CONSTRAINTS AND REFERENCES FOR año_lectivo ===");
for (const line of lines) {
  if (line.toLowerCase().includes("año_lectivo") && (line.toLowerCase().includes("primary key") || line.toLowerCase().includes("foreign key") || line.toLowerCase().includes("alter table") || line.toLowerCase().includes("sequence"))) {
    console.log(line);
  }
}
