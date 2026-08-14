import type { GradeScale } from '../types/grade.types'

export function calculateWeightedAverage(
  scores: Record<number, number | null>,
  weights: Record<number, number>
): number | null {
  let totalScore = 0
  let totalWeight = 0

  for (const [idStr, score] of Object.entries(scores)) {
    const id = Number(idStr)
    const weight = weights[id] || 0
    if (score !== null && score !== undefined && !isNaN(score) && weight > 0) {
      totalScore += Number(score) * (weight / 100)
      totalWeight += weight
    }
  }

  if (totalWeight === 0) return null
  // Normalizar si la suma de pesos evaluados es menor a 100
  return Number((totalScore * (100 / totalWeight)).toFixed(2))
}

export function getPerformanceScale(
  score: number | null | undefined,
  scales: GradeScale[]
): GradeScale | null {
  if (score === null || score === undefined || isNaN(score)) return null
  return scales.find(s => score >= s.nota_minima && score <= s.nota_maxima) || null
}

export function isValidGradeRange(
  grade: number,
  min = 0,
  max = 5
): boolean {
  return !isNaN(grade) && grade >= min && grade <= max
}
