"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCurrentAcademicPeriodOrder = exports.getDefaultMonthsLabelForPeriodOrder = exports.DEFAULT_ACADEMIC_PERIOD_MONTH_RULES = exports.DEFAULT_ACADEMIC_CALENDAR_REFERENCES = void 0;
// Configuración central editable: meses de referencia por periodo.
exports.DEFAULT_ACADEMIC_CALENDAR_REFERENCES = [
    {
        key: "PERIODO_1",
        label: "1er período",
        monthsLabel: "Enero/febrero a marzo/abril",
    },
    {
        key: "PERIODO_2",
        label: "2do período",
        monthsLabel: "Abril a junio",
    },
    {
        key: "VACACIONES_MITAD_ANO",
        label: "Vacaciones mitad de año",
        monthsLabel: "Junio a julio",
    },
    {
        key: "PERIODO_3",
        label: "3er período",
        monthsLabel: "Julio a septiembre",
    },
    {
        key: "PERIODO_4",
        label: "4to período",
        monthsLabel: "Octubre a noviembre/diciembre",
    },
];
// Mapeo operativo por mes para determinar el periodo habilitado.
// Se deja separado de las etiquetas porque los rangos descriptivos tienen meses frontera compartidos.
exports.DEFAULT_ACADEMIC_PERIOD_MONTH_RULES = [
    { order: 1, label: "1er período", startMonth: 1, endMonth: 3 },
    { order: 2, label: "2do período", startMonth: 4, endMonth: 6 },
    { order: 3, label: "3er período", startMonth: 7, endMonth: 9 },
    { order: 4, label: "4to período", startMonth: 10, endMonth: 12 },
];
const getDefaultMonthsLabelForPeriodOrder = (order) => {
    const reference = exports.DEFAULT_ACADEMIC_CALENDAR_REFERENCES.find((item) => item.key === `PERIODO_${order}`);
    return reference?.monthsLabel ?? null;
};
exports.getDefaultMonthsLabelForPeriodOrder = getDefaultMonthsLabelForPeriodOrder;
const resolveCurrentAcademicPeriodOrder = (date = new Date()) => {
    const currentMonth = date.getMonth() + 1;
    const matchedRule = exports.DEFAULT_ACADEMIC_PERIOD_MONTH_RULES.find((rule) => currentMonth >= rule.startMonth && currentMonth <= rule.endMonth);
    return matchedRule?.order ?? null;
};
exports.resolveCurrentAcademicPeriodOrder = resolveCurrentAcademicPeriodOrder;
