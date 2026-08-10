const fs = require("fs");
const path = require("path");

const filePath = "c:/Users/alejo/Downloads/segundoProyecto/guides/AcademiaNeivaBD.sql";
const content = fs.readFileSync(filePath, "utf-8");

// Search for CREATE TABLE "año_lectivo" or CREATE TABLE periodo_academico
const lines = content.split("\n");
let inTable = false;
let tableName = "";
let tableLines = [];

for (const line of lines) {
  if (line.includes("CREATE TABLE")) {
    inTable = true;
    tableName = line;
    tableLines = [line];
  } else if (inTable) {
    tableLines.push(line);
    if (line.includes(");")) {
      inTable = false;
      if (tableName.includes("año_lectivo") || tableName.includes("periodo_academico")) {
        console.log(`=== TABLE DEFINITION: ${tableName} ===`);
        console.log(tableLines.join("\n"));
      }
    }
  }
}
