export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function text(value: unknown, max: number, required = true): string {
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new AppError("Please check the text fields.");
  return value.trim();
}
export function integer(value: unknown, min = 1, max = 100000): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new AppError("Please enter a whole number within the allowed range.");
  return value;
}
export function questStake(balance: number, requested: number) {
  integer(requested, 10, 35);
  return balance >= requested ? requested : 20;
}
export function normalizeAnswer(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function answerMatches(value: string, alternatives: string[], unordered = false) {
  const normalized = normalizeAnswer(value);
  const canonical = (input: string) => normalizeAnswer(input).split(" ").filter(x => x !== "and").sort().join(" ");
  return alternatives.some(answer => unordered ? canonical(value) === canonical(answer) : normalized === normalizeAnswer(answer));
}
export function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const range = i + 1, ceiling = Math.floor(4294967296 / range) * range;
    let number: number;
    do { number = crypto.getRandomValues(new Uint32Array(1))[0]; } while (number >= ceiling);
    const j = number % range;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
