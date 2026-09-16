export function getCurrentMonthYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getNextMonthYear(): string {
  const now = new Date();
  // Move to next month safely
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function formatMonthYear(monthYearStr?: string): string {
  if (!monthYearStr) return "";
  const parts = monthYearStr.split("-");
  if (parts.length < 2) return monthYearStr;
  const [year, month] = parts;
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const mIndex = parseInt(month, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${monthNames[mIndex]} de ${year}`;
  }
  return monthYearStr;
}

export function formatMonthShort(monthYearStr?: string): string {
  if (!monthYearStr) return "";
  const parts = monthYearStr.split("-");
  if (parts.length < 2) return monthYearStr;
  const [year, month] = parts;
  const monthNames = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];
  const mIndex = parseInt(month, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${monthNames[mIndex]}/${year}`;
  }
  return monthYearStr;
}

export function isCurrentMonth(monthYearStr?: string): boolean {
  return monthYearStr === getCurrentMonthYear();
}

export function getMonthName(monthYearStr?: string): string {
  if (!monthYearStr) return "";
  const parts = monthYearStr.split("-");
  if (parts.length < 2) return "";
  const month = parts[1];
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const mIndex = parseInt(month, 10) - 1;
  return (mIndex >= 0 && mIndex < 12) ? monthNames[mIndex] : "";
}

export function getStandardScheduleTitle(departmentName: string, monthYearStr: string): string {
  const month = getMonthName(monthYearStr);
  return `Escala de ${departmentName} - ${month}`;
}

/**
 * Formata qualquer data (YYYY-MM-DD ou Date) no padrão exigido: DD:MM:AAAA
 * Exemplo: 2026-10-03 -> 03:10:2026
 */
export function formatDateDDMMAAAA(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  if (dateInput instanceof Date) {
    const d = String(dateInput.getDate()).padStart(2, "0");
    const m = String(dateInput.getMonth() + 1).padStart(2, "0");
    const y = dateInput.getFullYear();
    return `${d}:${m}:${y}`;
  }

  const str = String(dateInput).trim();
  // Se contiver traço (YYYY-MM-DD)
  const partsHyphen = str.split("T")[0].split("-");
  if (partsHyphen.length === 3) {
    const [year, month, day] = partsHyphen;
    if (year.length === 4) {
      return `${day.padStart(2, "0")}:${month.padStart(2, "0")}:${year}`;
    }
  }

  // Se contiver barra (DD/MM/YYYY)
  const partsSlash = str.split("/");
  if (partsSlash.length === 3) {
    const [day, month, year] = partsSlash;
    return `${day.padStart(2, "0")}:${month.padStart(2, "0")}:${year}`;
  }

  // Se já estiver no padrão DD:MM:AAAA
  const partsColon = str.split(":");
  if (partsColon.length === 3 && partsColon[2].length === 4) {
    return str;
  }

  return str;
}

/**
 * Formata data no padrão DD:MM:AAAA com dia da semana
 * Exemplo: 2026-10-03 -> 03:10:2026 (Sábado)
 */
export function formatDateWithWeekday(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const ddmmaaaa = formatDateDDMMAAAA(dateInput);
  const parts = ddmmaaaa.split(":");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day);
    const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return `${ddmmaaaa} (${weekdays[dateObj.getDay()]})`;
  }
  return ddmmaaaa;
}

/**
 * Retorna apenas o dia para uso dentro das escalas.
 * Exemplo: 2026-10-03 -> "Dia 03"
 */
export function formatScheduleDay(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const str = String(dateInput).split("T")[0].trim();
  const parts = str.split("-");
  if (parts.length === 3) {
    return `Dia ${parts[2].padStart(2, "0")}`;
  }
  const partsSlash = str.split("/");
  if (partsSlash.length === 3) {
    return `Dia ${partsSlash[0].padStart(2, "0")}`;
  }
  const partsColon = str.split(":");
  if (partsColon.length === 3) {
    return `Dia ${partsColon[0].padStart(2, "0")}`;
  }
  return str;
}

/**
 * Retorna apenas o dia com o dia da semana para uso dentro das escalas.
 * Exemplo: 2026-10-03 -> "Dia 03 (Sábado)"
 */
export function formatScheduleDayWithWeekday(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const str = String(dateInput).split("T")[0].trim();
  const parts = str.split("-");
  const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayNum = parts[2].padStart(2, "0");
    const weekday = weekdays[d.getDay()] || "";
    return `Dia ${dayNum} (${weekday})`;
  }
  return formatScheduleDay(dateInput);
}

/**
 * Retorna o dia abreviado com dia da semana para mensagens e listas compactas.
 * Exemplo: 2026-10-03 -> "Dia 03 (Sáb)"
 */
export function formatScheduleDayShortWeekday(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const str = String(dateInput).split("T")[0].trim();
  const parts = str.split("-");
  const shortWeekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayNum = parts[2].padStart(2, "0");
    const weekday = shortWeekdays[d.getDay()] || "";
    return `Dia ${dayNum} (${weekday})`;
  }
  return formatScheduleDay(dateInput);
}

/**
 * Sanitiza títulos de escala substituindo qualquer padrão de ano e mês numérico (ex: 2026-09 ou 09/2026)
 * pelo nome do mês por extenso (ex: "Escala de Sonoplastia - Setembro").
 */
export function sanitizeScheduleTitle(title?: string, monthYearStr?: string): string {
  if (!title) return "";

  // Se contiver YYYY-MM (ex: 2026-09)
  const yyyymmRegex = /\b(\d{4})-(\d{2})\b/;
  if (yyyymmRegex.test(title)) {
    const match = title.match(yyyymmRegex);
    if (match) {
      const mName = getMonthName(`${match[1]}-${match[2]}`);
      if (mName) {
        return title.replace(yyyymmRegex, mName);
      }
    }
  }

  // Se contiver MM/YYYY (ex: 09/2026)
  const mmyyyyRegex = /\b(\d{2})\/(\d{4})\b/;
  if (mmyyyyRegex.test(title)) {
    const match = title.match(mmyyyyRegex);
    if (match) {
      const mName = getMonthName(`${match[2]}-${match[1]}`);
      if (mName) {
        return title.replace(mmyyyyRegex, mName);
      }
    }
  }

  return title;
}

