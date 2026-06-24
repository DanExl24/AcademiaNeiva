const fs = require('fs');
const path = require('path');

const files = [
  '../../frontend/src/views/teacher/TeacherObservations.vue',
  '../../frontend/src/views/teacher/TeacherGrades.vue',
  '../../frontend/src/views/teacher/TeacherAttendance.vue',
  '../../frontend/src/views/teacher/TeacherClosure.vue',
  '../../frontend/src/views/teacher/TeacherCourses.vue',
  '../../frontend/src/views/teacher/TeacherDashboard.vue'
];

files.forEach(relativePath => {
  const absolutePath = path.resolve(__dirname, relativePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File does not exist: ${absolutePath}`);
    return;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  
  // Filter out lines containing [LOG-VISTA]
  const filteredLines = lines.filter(line => {
    return !line.includes('[LOG-VISTA]');
  });

  fs.writeFileSync(absolutePath, filteredLines.join('\n'), 'utf8');
  console.log(`Cleaned logs from: ${relativePath} (Removed ${lines.length - filteredLines.length} lines)`);
});
