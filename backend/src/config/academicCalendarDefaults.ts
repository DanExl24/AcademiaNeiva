export interface AcademicPeriodMonthDefault {
  order: number;
  label: string;
  startMonth: number;
  endMonth: number;
}

export interface AcademicCalendarReference {
  key: string;
  label: string;
  monthsLabel: string;
}

// Configuración central editable: meses de referencia por periodo.
export const DEFAULT_ACADEMIC_CALENDAR_REFERENCES: AcademicCalendarReference[] = [
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
export const DEFAULT_ACADEMIC_PERIOD_MONTH_RULES: AcademicPeriodMonthDefault[] = [
  { order: 1, label: "1er período", startMonth: 1, endMonth: 3 },
  { order: 2, label: "2do período", startMonth: 4, endMonth: 6 },
  { order: 3, label: "3er período", startMonth: 7, endMonth: 9 },
  { order: 4, label: "4to período", startMonth: 10, endMonth: 12 },
];

export const getDefaultMonthsLabelForPeriodOrder = (order: number): string | null => {
  const reference = DEFAULT_ACADEMIC_CALENDAR_REFERENCES.find((item) => item.key === `PERIODO_${order}`);
  return reference?.monthsLabel ?? null;
};

export const resolveCurrentAcademicPeriodOrder = (date = new Date()): number | null => {
  const currentMonth = date.getMonth() + 1;
  const matchedRule = DEFAULT_ACADEMIC_PERIOD_MONTH_RULES.find(
    (rule) => currentMonth >= rule.startMonth && currentMonth <= rule.endMonth
  );

  return matchedRule?.order ?? null;
};
