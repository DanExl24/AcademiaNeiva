export function formatGrade(grade: number | null | undefined): string {
  if (grade === null || grade === undefined || isNaN(Number(grade))) return '-'
  return Number(grade).toFixed(2)
}

export function getGradeScaleColor(grade: number | null | undefined, passGrade = 3.0): { text: string; bg: string } {
  if (grade === null || grade === undefined || isNaN(Number(grade))) {
    return { text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' }
  }
  const val = Number(grade)
  if (val < passGrade) {
    return { text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50' }
  }
  if (val >= 4.6) {
    return { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50' }
  }
  if (val >= 4.0) {
    return { text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50' }
  }
  return { text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50' }
}
