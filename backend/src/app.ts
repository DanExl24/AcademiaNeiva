import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import rateLimit from "express-rate-limit";
import matriculaRoutes from "./routes/matricula.routes";
import gradoRoutes from "./routes/grado.routes";
import authRoutes from "./routes/auth.routes";
import teacherRoutes from "./routes/teacher.routes";
import academicAdminRoutes from "./routes/academicAdmin.routes";
import boletinRoutes from "./routes/boletin.routes";
import studentRoutes from "./routes/student.routes";
import adminGeneralRoutes from "./routes/adminGeneral.routes";
import dbaRoutes from "./routes/dba.routes";
import supportRoutes from "./routes/support.routes";
import reingresoRoutes from "./routes/reingreso.routes";
import parentRoutes from "./routes/parent.routes";

const app = express();

// Confiar en el Proxy Inverso (Nginx / Cloudflare) para obtener la IP real del cliente
app.set("trust proxy", 1);

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000,
  message: { error: "Demasiadas peticiones. Intenta de nuevo en 15 minutos." }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { error: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos." }
});

const enrollmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 solicitudes cada 15 min (solicitud del usuario)
  message: { error: "Límite de solicitudes de matrícula alcanzado. Intenta de nuevo en 15 minutos." }
});

// Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "http:", "https:"],
      connectSrc: ["'self'", "http://localhost:5173", "http://localhost:3000", "https:"],
      frameAncestors: ["'self'", "http://localhost:5173", "http://localhost:3000", "https:"]
    }
  },
  frameguard: false
}));

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://academianeiva.adsoproject.dev",
  "https://api-academianeiva.adsoproject.dev"
];
if (process.env.FRONTEND_URL) {
  defaultAllowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()) 
  : defaultAllowedOrigins;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Apply rate limiting
app.use(globalLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/student-login", loginLimiter);
app.use("/api/matriculas/submit", enrollmentLimiter);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/matriculas", matriculaRoutes);
app.use("/api/grados", gradoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/academic-admin", academicAdminRoutes);
app.use("/api/boletines", boletinRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminGeneralRoutes);
app.use("/api/admin", dbaRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/reingreso", reingresoRoutes);
app.use("/api/parents", parentRoutes);

app.get("/", (req, res) => {
  res.json({ message: "API TS funcionando segura" });
});

export default app;
