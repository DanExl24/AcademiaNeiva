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

// ============================================================
// CALENDARIO A: Jan → Dec (most common - public/private)
// ============================================================
export const CALENDAR_A_PERIOD_RULES: AcademicPeriodMonthDefault[] = [
  { order: 1, label: 'Primer Periodo',   startMonth: 1,  endMonth: 3  },
  { order: 2, label: 'Segundo Periodo',  startMonth: 4,  endMonth: 6  },
  { order: 3, label: 'Tercer Periodo',   startMonth: 7,  endMonth: 9  },
  { order: 4, label: 'Cuarto Periodo',   startMonth: 10, endMonth: 12 },
];

// ============================================================
// CALENDARIO B: Aug (Year N) → Jul (Year N+1) (international)
// ============================================================
export const CALENDAR_B_PERIOD_RULES: AcademicPeriodMonthDefault[] = [
  { order: 1, label: 'Primer Periodo',   startMonth: 8,  endMonth: 10 },
  { order: 2, label: 'Segundo Periodo',  startMonth: 11, endMonth: 12 },
  { order: 3, label: 'Tercer Periodo',   startMonth: 1,  endMonth: 3  },
  { order: 4, label: 'Cuarto Periodo',   startMonth: 4,  endMonth: 7  },
];

// Legacy alias for backward compatibility
export const DEFAULT_ACADEMIC_PERIOD_MONTH_RULES = CALENDAR_A_PERIOD_RULES;

export const DEFAULT_ACADEMIC_CALENDAR_REFERENCES: AcademicCalendarReference[] = [
  { key: 'PERIODO_1', label: '1er período', monthsLabel: 'Enero/febrero a marzo/abril' },
  { key: 'PERIODO_2', label: '2do período', monthsLabel: 'Abril a junio' },
  { key: 'VACACIONES_MITAD_ANO', label: 'Vacaciones mitad de año', monthsLabel: 'Junio a julio' },
  { key: 'PERIODO_3', label: '3er período', monthsLabel: 'Julio a septiembre' },
  { key: 'PERIODO_4', label: '4to período', monthsLabel: 'Octubre a noviembre/diciembre' },
];

/**
 * Get the period rules for a given calendar type.
 */
export const getPeriodRules = (tipo: 'A' | 'B' = 'A'): AcademicPeriodMonthDefault[] => {
  return tipo === 'B' ? CALENDAR_B_PERIOD_RULES : CALENDAR_A_PERIOD_RULES;
};

/**
 * Get the academic year label for display.
 * - Calendario A: "2026"
 * - Calendario B: "2025-2026" (spans two calendar years)
 */
export const getAcademicYearLabel = (year: number, tipo: 'A' | 'B' = 'A'): string => {
  if (tipo === 'B') {
    return `${year - 1}-${year}`;
  }
  return String(year);
};

/**
 * Resolve the current academic period order based on current date and calendar type.
 */
export const resolveCurrentAcademicPeriodOrder = (date = new Date(), tipo: 'A' | 'B' = 'A'): number | null => {
  const currentMonth = date.getMonth() + 1;
  const rules = getPeriodRules(tipo);
  const matchedRule = rules.find(
    (rule) => currentMonth >= rule.startMonth && currentMonth <= rule.endMonth
  );
  return matchedRule?.order ?? null;
};

export const getDefaultMonthsLabelForPeriodOrder = (order: number): string | null => {
  const reference = DEFAULT_ACADEMIC_CALENDAR_REFERENCES.find((item) => item.key === `PERIODO_${order}`);
  return reference?.monthsLabel ?? null;
};
