import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import matriculaRoutes from "./routes/matricula.routes";
import gradoRoutes from "./routes/grado.routes";
import authRoutes from "./routes/auth.routes";
import teacherRoutes from "./routes/teacher.routes";

const app = express();

// Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
  frameguard: false,
}));
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/matriculas", matriculaRoutes);
app.use("/api/grados", gradoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);

app.get("/", (req, res) => {
  res.json({ message: "API TS funcionando segura" });
});

export default app;