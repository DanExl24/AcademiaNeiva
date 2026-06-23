export interface CourseGroup {
  tipo_grado_nombre?: string;
  grado_nombre?: string;
  seccion_nombre: string;
}

export function getCourseDisplayName(group: CourseGroup | null | undefined): string {
  if (!group) return '';
  const gradeName = (group.tipo_grado_nombre || group.grado_nombre || '').trim();
  const sec = (group.seccion_nombre || '').trim();
  const secLower = sec.toLowerCase();

  // A section is default if it is a single letter (a-z) or 'unica'
  const isDefault = (secLower.length === 1 && secLower >= 'a' && secLower <= 'z') || secLower === 'unica';

  if (isDefault && gradeName) {
    return `${gradeName} ${sec}`;
  }
  return sec;
}

export function getNextSectionName(existingSections: string[]): string {
  if (!existingSections || existingSections.length === 0) {
    return 'A';
  }

  // Clean and filter empty names
  const names = existingSections.map(s => s.trim()).filter(Boolean);
  if (names.length === 0) {
    return 'A';
  }

  // Sort names naturally: numeric names and higher sequences end up last
  const naturalCompare = (a: string, b: string) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  };
  names.sort(naturalCompare);
  const lastName = names[names.length - 1];

  // Special case for 'unica'
  if (lastName.toLowerCase() === 'unica') {
    return 'A';
  }

  // 1. Purely numeric name (e.g. "601", "602", "1103")
  if (/^\d+$/.test(lastName)) {
    const num = parseInt(lastName, 10);
    return String(num + 1);
  }

  // 2. Ends with digits (e.g. "10-1", "10-2", "6.3", "6-02")
  const digitMatch = lastName.match(/^(.*?)(\d+)$/);
  if (digitMatch) {
    const prefix = digitMatch[1];
    const numStr = digitMatch[2];
    const num = parseInt(numStr, 10);
    const nextNumStr = String(num + 1).padStart(numStr.length, '0');
    return prefix + nextNumStr;
  }

  // 3. Ends with letters (e.g. "10-A", "B", "DECIMO A", "Jardin A")
  const letterMatch = lastName.match(/^(.*?)([a-zA-Z]+)$/);
  if (letterMatch) {
    const prefix = letterMatch[1];
    const letterStr = letterMatch[2];
    const isUpper = letterStr === letterStr.toUpperCase();

    const letterToIndex = (s: string): number => {
      let idx = 0;
      const up = s.toUpperCase();
      for (let i = 0; i < up.length; i++) {
        idx = idx * 26 + (up.charCodeAt(i) - 64);
      }
      return idx - 1;
    };

    const indexToLetter = (idx: number): string => {
      let temp = idx;
      let out = '';
      while (temp >= 0) {
        out = String.fromCharCode((temp % 26) + 65) + out;
        temp = Math.floor(temp / 26) - 1;
      }
      return out;
    };

    const nextIndex = letterToIndex(letterStr) + 1;
    let nextLetter = indexToLetter(nextIndex);
    if (!isUpper) {
      nextLetter = nextLetter.toLowerCase();
    }
    return prefix + nextLetter;
  }

  // Fallback: append "-B" if we can't parse a sequence
  return lastName + '-B';
}
