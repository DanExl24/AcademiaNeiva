/**
 * Normaliza nombres de grados académicos para detección estricta de duplicados y variaciones.
 * Convierte acentos, elimina prefijos como "GRADO"/"NIVEL", mapea números/ordinales a palabras canónicas,
 * y colapsa caracteres consecutivos repetidos (ej: "SEXXTO" -> "SEXTO").
 */
export function normalizeGradeName(str: string): string {
  if (!str || typeof str !== 'string') return '';

  let text = str.toUpperCase().trim();

  // 1. Eliminar acentos y diacríticos
  text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 2. Eliminar prefijos/sufijos comunes como "GRADO", "NIVEL", "CURSO", "AÑO", "ANIO"
  text = text.replace(/\b(GRADO|GRADOS|NIVEL|NIVELES|CURSO|CURSOS|ANO|ANIO|SISTEMA)\b/g, '').trim();

  // 3. Eliminar símbolos y puntuación comunes en ordinales (°, º, ., -, #, ,)
  text = text.replace(/[\°\º\.\-\_\#\,\:]/g, '').trim();

  // 4. Mapear palabras/números ordinals a su forma canónica estándar
  const ordinalMap: Record<string, string> = {
    '1': 'PRIMERO', '1RO': 'PRIMERO', '1ER': 'PRIMERO', 'FIRST': 'PRIMERO',
    '2': 'SEGUNDO', '2DO': 'SEGUNDO', '2ND': 'SEGUNDO',
    '3': 'TERCERO', '3RO': 'TERCERO', '3ER': 'TERCERO', '3RD': 'TERCERO',
    '4': 'CUARTO', '4TO': 'CUARTO', '4TH': 'CUARTO',
    '5': 'QUINTO', '5TO': 'QUINTO', '5TH': 'QUINTO',
    '6': 'SEXTO', '6TO': 'SEXTO', '6TH': 'SEXTO',
    '7': 'SEPTIMO', '7MO': 'SEPTIMO', '7TH': 'SEPTIMO',
    '8': 'OCTAVO', '8VO': 'OCTAVO', '8TH': 'OCTAVO',
    '9': 'NOVENO', '9NO': 'NOVENO', '9TH': 'NOVENO',
    '10': 'DECIMO', '10MO': 'DECIMO', '10TH': 'DECIMO',
    '11': 'ONCE', '11VO': 'ONCE', 'UNDECIMO': 'ONCE', '11TH': 'ONCE',
    '12': 'DOCE', '12VO': 'DOCE', 'DUODECIMO': 'DOCE', '12TH': 'DOCE',
    'PARVULO': 'PARVULOS', 'PARVULOS': 'PARVULOS',
    'PREJARDIN': 'PREJARDIN', 'PREKINDER': 'PREJARDIN',
    'JARDIN': 'JARDIN', 'KINDER': 'JARDIN',
    'TRANSICION': 'TRANSICION'
  };

  const words = text.split(/\s+/).filter(Boolean);
  const mappedWords = words.map(w => ordinalMap[w] || w);
  text = mappedWords.join('');

  // 5. Colapsar caracteres alfabéticos repetidos consecutivos (ej. SEXXTO -> SEXTO, SEGGUNDO -> SEGUNDO)
  text = text.replace(/([A-Z])\1+/g, '$1');

  return text;
}

/**
 * Compara dos nombres de grado y determina si son equivalentes o duplicados.
 */
export function isDuplicateOrSimilarGrade(name1: string, name2: string): boolean {
  const norm1 = normalizeGradeName(name1);
  const norm2 = normalizeGradeName(name2);
  return norm1.length > 0 && norm1 === norm2;
}
