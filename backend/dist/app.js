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
const app = (0, express_1.default)();
// Rate Limiters
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200,
    message: { error: "Demasiadas peticiones. Intenta de nuevo en 15 minutos." }
});
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10,
    message: { error: "Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos." }
});
const enrollmentLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // 20 solicitudes cada 15 min (solicitud del usuario)
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
            connectSrc: ["'self'", "http://localhost:5173", "http://localhost:3000"]
        }
    },
    frameguard: { action: "deny" }
}));
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:5173"];
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
app.use(express_1.default.json());
// Apply rate limiting
app.use(globalLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/student-login", loginLimiter);
app.use("/api/matriculas/submit", enrollmentLimiter);
// Serve uploaded files
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.use("/api/matriculas", matricula_routes_1.default);
app.use("/api/grados", grado_routes_1.default);
app.use("/api/auth", auth_routes_1.default);
app.use("/api/teacher", teacher_routes_1.default);
app.use("/api/academic-admin", academicAdmin_routes_1.default);
app.use("/api/boletines", boletin_routes_1.default);
app.use("/api/student", student_routes_1.default);
app.use("/api/admin", adminGeneral_routes_1.default);
app.get("/", (req, res) => {
    res.json({ message: "API TS funcionando segura" });
});
exports.default = app;
