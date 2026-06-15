"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const matricula_routes_1 = __importDefault(require("./routes/matricula.routes"));
const grado_routes_1 = __importDefault(require("./routes/grado.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const teacher_routes_1 = __importDefault(require("./routes/teacher.routes"));
const academicAdmin_routes_1 = __importDefault(require("./routes/academicAdmin.routes"));
const boletin_routes_1 = __importDefault(require("./routes/boletin.routes"));
const student_routes_1 = __importDefault(require("./routes/student.routes"));
const app = (0, express_1.default)();
// Middlewares
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
    frameguard: false,
}));
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve uploaded files
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.use("/api/matriculas", matricula_routes_1.default);
app.use("/api/grados", grado_routes_1.default);
app.use("/api/auth", auth_routes_1.default);
app.use("/api/teacher", teacher_routes_1.default);
app.use("/api/academic-admin", academicAdmin_routes_1.default);
app.use("/api/boletines", boletin_routes_1.default);
app.use("/api/student", student_routes_1.default);
app.get("/", (req, res) => {
    res.json({ message: "API TS funcionando segura" });
});
exports.default = app;
