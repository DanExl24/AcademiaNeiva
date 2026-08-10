async function run() {
  try {
    console.log("=== Debugging Backend API Endpoints via HTTP (using global fetch) ===");

    // 1. Login
    const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "matematicas.1@ceaschool.edu.co",
        password: "docente123"
      })
    });
    
    if (!loginResponse.ok) {
      console.error("Login failed with status:", loginResponse.status, await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json() as any;
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log(`Login OK! Token length: ${token.length}, userId: ${userId}`);

    const headers = { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}` 
    };

    // 2. Fetch courses
    const coursesResponse = await fetch(`http://localhost:3000/api/teacher/courses/${userId}`, { headers });
    if (!coursesResponse.ok) {
      console.error("Fetch courses failed:", coursesResponse.status, await coursesResponse.text());
      return;
    }
    const coursesData = await coursesResponse.json() as any[];
    console.log(`Fetch courses OK! Returned count: ${coursesData.length}`);
    const firstCourse = coursesData[0];
    console.log("First course returned:", firstCourse);

    if (firstCourse) {
      const gradeId = firstCourse.id_grado; // 1
      const detailGradeId = firstCourse.id_detallegrado; // 1

      // 3. Fetch students
      console.log(`\nFetching students for gradeId: ${gradeId}...`);
      try {
        const studentsResponse = await fetch(`http://localhost:3000/api/teacher/students/${gradeId}`, { headers });
        if (studentsResponse.ok) {
          const studentsData = await studentsResponse.json() as any[];
          console.log(`Fetch students OK! Returned count: ${studentsData.length}`);
          console.log("First student:", studentsData[0]);
        } else {
          console.error("Fetch students FAILED:", studentsResponse.status, await studentsResponse.text());
        }
      } catch (err: any) {
        console.error("Fetch students error:", err.message);
      }

      // 4. Fetch attendance
      const date = new Date().toLocaleDateString('en-CA');
      console.log(`\nFetching attendance for detailGradeId: ${detailGradeId}, date: ${date}...`);
      try {
        const attResponse = await fetch(`http://localhost:3000/api/teacher/attendance/${detailGradeId}/${date}`, { headers });
        if (attResponse.ok) {
          const attData = await attResponse.json() as any;
          console.log(`Fetch attendance OK! Students returned count: ${attData.students?.length}`);
          console.log("Attendance metadata:", { editable: attData.editable, error: attData.error, periodId: attData.periodId });
        } else {
          console.error("Fetch attendance FAILED:", attResponse.status, await attResponse.text());
        }
      } catch (err: any) {
        console.error("Fetch attendance error:", err.message);
      }

      // 5. Fetch observations
      const periodId = 2; // Segundo Periodo (Open)
      console.log(`\nFetching observations for detailGradeId: ${detailGradeId}, periodId: ${periodId}...`);
      try {
        const obsResponse = await fetch(`http://localhost:3000/api/teacher/observations/${detailGradeId}/${periodId}`, { headers });
        if (obsResponse.ok) {
          const obsData = await obsResponse.json() as any;
          console.log(`Fetch observations OK! Observations returned count: ${obsData.observations?.length}`);
          console.log("Observations metadata:", { editable: obsData.editable, error: obsData.error });
        } else {
          console.error("Fetch observations FAILED:", obsResponse.status, await obsResponse.text());
        }
      } catch (err: any) {
        console.error("Fetch observations error:", err.message);
      }
    }
  } catch (err: any) {
    console.error("Root API error:", err.message);
  }
}

run();
