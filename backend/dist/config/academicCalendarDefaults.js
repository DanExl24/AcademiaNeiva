"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultMonthsLabelForPeriodOrder = exports.resolveCurrentAcademicPeriodOrder = exports.getAcademicYearLabel = exports.getPeriodRules = exports.DEFAULT_ACADEMIC_CALENDAR_REFERENCES = exports.DEFAULT_ACADEMIC_PERIOD_MONTH_RULES = exports.CALENDAR_B_PERIOD_RULES = exports.CALENDAR_A_PERIOD_RULES = void 0;
// ============================================================
// CALENDARIO A: Jan → Dec (most common - public/private)
// ============================================================
exports.CALENDAR_A_PERIOD_RULES = [
    { order: 1, label: 'Primer Periodo', startMonth: 1, endMonth: 3 },
    { order: 2, label: 'Segundo Periodo', startMonth: 4, endMonth: 6 },
    { order: 3, label: 'Tercer Periodo', startMonth: 7, endMonth: 9 },
    { order: 4, label: 'Cuarto Periodo', startMonth: 10, endMonth: 12 },
];
// ============================================================
// CALENDARIO B: Aug (Year N) → Jul (Year N+1) (international)
// ============================================================
exports.CALENDAR_B_PERIOD_RULES = [
    { order: 1, label: 'Primer Periodo', startMonth: 8, endMonth: 10 },
    { order: 2, label: 'Segundo Periodo', startMonth: 11, endMonth: 12 },
    { order: 3, label: 'Tercer Periodo', startMonth: 1, endMonth: 3 },
    { order: 4, label: 'Cuarto Periodo', startMonth: 4, endMonth: 7 },
];
// Legacy alias for backward compatibility
exports.DEFAULT_ACADEMIC_PERIOD_MONTH_RULES = exports.CALENDAR_A_PERIOD_RULES;
exports.DEFAULT_ACADEMIC_CALENDAR_REFERENCES = [
    { key: 'PERIODO_1', label: '1er período', monthsLabel: 'Enero/febrero a marzo/abril' },
    { key: 'PERIODO_2', label: '2do período', monthsLabel: 'Abril a junio' },
    { key: 'VACACIONES_MITAD_ANO', label: 'Vacaciones mitad de año', monthsLabel: 'Junio a julio' },
    { key: 'PERIODO_3', label: '3er período', monthsLabel: 'Julio a septiembre' },
    { key: 'PERIODO_4', label: '4to período', monthsLabel: 'Octubre a noviembre/diciembre' },
];
/**
 * Get the period rules for a given calendar type.
 */
const getPeriodRules = (tipo = 'A') => {
    return tipo === 'B' ? exports.CALENDAR_B_PERIOD_RULES : exports.CALENDAR_A_PERIOD_RULES;
};
exports.getPeriodRules = getPeriodRules;
/**
 * Get the academic year label for display.
 * - Calendario A: "2026"
 * - Calendario B: "2025-2026" (spans two calendar years)
 */
const getAcademicYearLabel = (year, tipo = 'A') => {
    if (tipo === 'B') {
        return `${year - 1}-${year}`;
    }
    return String(year);
};
exports.getAcademicYearLabel = getAcademicYearLabel;
/**
 * Resolve the current academic period order based on current date and calendar type.
 */
const resolveCurrentAcademicPeriodOrder = (date = new Date(), tipo = 'A') => {
    const currentMonth = date.getMonth() + 1;
    const rules = (0, exports.getPeriodRules)(tipo);
    const matchedRule = rules.find((rule) => currentMonth >= rule.startMonth && currentMonth <= rule.endMonth);
    return matchedRule?.order ?? null;
};
exports.resolveCurrentAcademicPeriodOrder = resolveCurrentAcademicPeriodOrder;
const getDefaultMonthsLabelForPeriodOrder = (order) => {
    const reference = exports.DEFAULT_ACADEMIC_CALENDAR_REFERENCES.find((item) => item.key === `PERIODO_${order}`);
    return reference?.monthsLabel ?? null;
};
exports.getDefaultMonthsLabelForPeriodOrder = getDefaultMonthsLabelForPeriodOrder;
