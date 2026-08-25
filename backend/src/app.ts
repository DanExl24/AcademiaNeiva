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
import trasladoRoutes from "./routes/traslado.routes";
import { verifyTokenOptional } from "./middleware/authMiddleware";

const app = express();

// Confiar en el Proxy Inverso (Nginx / Cloudflare) para obtener la IP real del cliente
app.set("trust proxy", 1);

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 2000,
  message: { error: "Demasiadas peticiones. Intenta de nuevo en 15 minutos." }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 50, // 50 intentos fallidos por IP cada 15 min
  skipSuccessfulRequests: true, // Inicios de sesión exitosos NO cuentan como intentos de fuerza bruta
  message: { error: "Demasiados intentos fallidos de inicio de sesión. Intenta de nuevo en 15 minutos." }
});

const enrollmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: Number(process.env.ENROLLMENT_RATE_LIMIT_MAX) || 100,
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
  "http://localhost:3001",
  "http://localhost:3002",
  "https://academianeiva.adsoproject.dev",
  "https://api-academianeiva.adsoproject.dev"
];
if (process.env.FRONTEND_URL) {
  defaultAllowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

const envOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim().replace(/\/$/, '')) 
  : [];
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin.endsWith('.adsoproject.dev') ||
      cleanOrigin.includes('localhost') ||
      cleanOrigin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-school-id',
    'x-academic-year-id',
    'X-Monitoring-Mode',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['x-total-count'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Apply rate limiting
app.use(globalLimiter);
app.use(["/api/auth/login", "/auth/login"], loginLimiter);
app.use(["/api/auth/student-login", "/auth/student-login"], loginLimiter);
app.use(["/api/matriculas/submit", "/matriculas/submit"], enrollmentLimiter);

// Serve uploaded files (public access allowed for logos/images, authentication required for documents)
app.use(["/api/uploads", "/uploads"], (req, res, next) => {
  const fileExt = path.extname(req.path).toLowerCase();
  const isPublicImage = [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(fileExt) || req.path.includes("escudo");

  if (isPublicImage) {
    return next();
  }

  return verifyTokenOptional(req, res, () => {
    if ((req as any).user) {
      return next();
    }
    res.status(403).json({ error: "Acceso denegado: Este archivo requiere autenticación previa." });
  });
}, express.static(path.join(__dirname, "../uploads")));

app.use(["/api/matriculas", "/matriculas"], matriculaRoutes);
app.use(["/api/grados", "/grados"], gradoRoutes);
app.use(["/api/auth", "/auth"], authRoutes);
app.use(["/api/teacher", "/teacher"], teacherRoutes);
app.use(["/api/academic-admin", "/academic-admin"], academicAdminRoutes);
app.use(["/api/boletines", "/boletines"], boletinRoutes);
app.use(["/api/student", "/student"], studentRoutes);
app.use(["/api/admin", "/admin"], adminGeneralRoutes);
app.use(["/api/admin", "/admin"], dbaRoutes);
app.use(["/api/support", "/support"], supportRoutes);
app.use(["/api/reingreso", "/reingreso"], reingresoRoutes);
app.use(["/api/parents", "/parents"], parentRoutes);
app.use(["/api/traslados", "/traslados"], trasladoRoutes);

app.get(["/", "/api"], (req, res) => {
  res.json({ message: "API TS funcionando segura" });
});


export default app;
