export function intEnv(name: string, fallback: number, min = 1): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} kamida ${min} bo‘lgan butun son bo‘lishi kerak (hozir: "${raw}")`);
  }
  return value;
}
