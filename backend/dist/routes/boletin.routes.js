"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const boletinController_1 = require("../controllers/boletinController");
const router = (0, express_1.Router)();
// Validate if period is closed (used for enabling bulk generation button)
router.get('/validate/:id_colegio/:id_periodo', boletinController_1.validatePeriodClosed);
// Get boletin for a specific student
router.get('/student/:id_estudiante/:id_periodo', boletinController_1.getStudentBoletin);
// Get boletines mass generation for a grade limit
router.get('/grade/:id_grupo/:id_periodo', boletinController_1.getGradeBoletines);
exports.default = router;
