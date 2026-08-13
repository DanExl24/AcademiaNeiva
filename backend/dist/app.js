"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const matricula_routes_1 = __importDefault(require("./routes/matricula.routes"));
const grado_routes_1 = __importDefault(require("./routes/grado.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const teacher_routes_1 = __importDefault(require("./routes/teacher.routes"));
const academicAdmin_routes_1 = __importDefault(require("./routes/academicAdmin.routes"));
const boletin_routes_1 = __importDefault(require("./routes/boletin.routes"));
const student_routes_1 = __importDefault(require("./routes/student.routes"));
const adminGeneral_routes_1 = __importDefault(require("./routes/adminGeneral.routes"));
const dba_routes_1 = __importDefault(require("./routes/dba.routes"));
const support_routes_1 = __importDefault(require("./routes/support.routes"));
const reingreso_routes_1 = __importDefault(require("./routes/reingreso.routes"));
const parent_routes_1 = __importDefault(require("./routes/parent.routes"));
const traslado_routes_1 = __importDefault(require("./routes/traslado.routes"));
const authMiddleware_1 = require("./middleware/authMiddleware");
const app = (0, express_1.default)();
// Confiar en el Proxy Inverso (Nginx / Cloudflare) para obtener la IP real del cliente
app.set("trust proxy", 1);
// Rate Limiters
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 2000,
    message: { error: "Demasiadas peticiones. Intenta de nuevo en 15 minutos." }
});
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 50, // 50 intentos fallidos por IP cada 15 min
    skipSuccessfulRequests: true, // Inicios de sesión exitosos NO cuentan como intentos de fuerza bruta
    message: { error: "Demasiados intentos fallidos de inicio de sesión. Intenta de nuevo en 15 minutos." }
});
const enrollmentLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: Number(process.env.ENROLLMENT_RATE_LIMIT_MAX) || 100,
    message: { error: "Límite de solicitudes de matrícula alcanzado. Intenta de nuevo en 15 minutos." }
});
// Middlewares
app.use((0, helmet_1.default)({
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
const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : [];
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
// Apply rate limiting
app.use(globalLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/student-login", loginLimiter);
app.use("/api/matriculas/submit", enrollmentLimiter);
// Serve uploaded files (public access allowed for logos/images, authentication required for documents)
app.use("/uploads", (req, res, next) => {
    const fileExt = path_1.default.extname(req.path).toLowerCase();
    const isPublicImage = [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(fileExt) || req.path.includes("escudo");
    if (isPublicImage) {
        return next();
    }
    return (0, authMiddleware_1.verifyTokenOptional)(req, res, () => {
        if (req.user) {
            return next();
        }
        res.status(403).json({ error: "Acceso denegado: Este archivo requiere autenticación previa." });
    });
}, express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.use("/api/matriculas", matricula_routes_1.default);
app.use("/api/grados", grado_routes_1.default);
app.use("/api/auth", auth_routes_1.default);
app.use("/api/teacher", teacher_routes_1.default);
app.use("/api/academic-admin", academicAdmin_routes_1.default);
app.use("/api/boletines", boletin_routes_1.default);
app.use("/api/student", student_routes_1.default);
app.use("/api/admin", adminGeneral_routes_1.default);
app.use("/api/admin", dba_routes_1.default);
app.use("/api/support", support_routes_1.default);
app.use("/api/reingreso", reingreso_routes_1.default);
app.use("/api/parents", parent_routes_1.default);
app.use("/api/traslados", traslado_routes_1.default);
app.get("/", (req, res) => {
    res.json({ message: "API TS funcionando segura" });
});
exports.default = app;
