export const DEFAULT_LADDER = "1,3,7,14,30";

export function parseLadder(s: string): number[] {
  return s.split(",").map((p) => Number(p.trim()));
}

const DAY_MS = 86_400_000;

export function addDays(isoDate: string, days: number): string {
  const t = Date.parse(isoDate + "T00:00:00Z");
  return new Date(t + days * DAY_MS).toISOString().slice(0, 10);
}

export function scheduleDates(firstDate: string, steps: number[]): string[] {
  return steps.map((step) => addDays(firstDate, step));
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
