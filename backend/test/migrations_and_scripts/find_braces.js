const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../../src/controllers/academicAdminController.ts");
const content = fs.readFileSync(filePath, "utf-8");

let braces = 0;
const lines = content.split("\n");
const stack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes("export const ") || line.includes("const ") && line.includes("=>")) {
    if (braces === 0) {
      console.log(`[Line ${i+1}] Declared function: ${line.trim()}`);
    }
  }
  for (let j = 0; j < line.length; j++) {
    if (line[j] === "{") {
      braces++;
      stack.push(i + 1);
    }
    if (line[j] === "}") {
      braces--;
      stack.pop();
    }
  }
}
console.log("Unclosed braces opened at lines:", stack);
