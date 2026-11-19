export type LocalDateRange = {
  from: string | null;
  toExclusive: string | null;
};

function localMidnight(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
  if (date.getFullYear() !== Number(yearText)
    || date.getMonth() !== Number(monthText) - 1
    || date.getDate() !== Number(dayText)) return null;
  return date;
}

export function localDateRangeToInstants(
  startDate: string | null,
  endDate: string | null,
): LocalDateRange | null {
  const start = startDate === null ? null : localMidnight(startDate);
  const end = endDate === null ? null : localMidnight(endDate);
  if ((startDate !== null && !start) || (endDate !== null && !end)) return null;
  if (start && end && start.getTime() > end.getTime()) return null;

  const toExclusive = end ? new Date(end) : null;
  toExclusive?.setDate(toExclusive.getDate() + 1);
  return {
    from: start?.toISOString() ?? null,
    toExclusive: toExclusive?.toISOString() ?? null,
  };
}
