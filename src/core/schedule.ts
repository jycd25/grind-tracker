export const DEFAULT_LADDER = "1,3,7,14,30";

export function parseLadder(s: string): number[] {
  const parts = s.split(",").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) {
    throw new Error("ladder must be comma-separated integers, e.g. 1,3,7,14,30");
  }
  const steps = parts.map(Number);
  if (steps.some((x) => x <= 0)) {
    throw new Error("ladder steps must be positive integers");
  }
  if (!steps.every((x, i) => i === 0 || steps[i - 1] < x)) {
    throw new Error("ladder steps must be strictly ascending");
  }
  return steps;
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
  return new Date().toLocaleDateString("en-CA");
}
