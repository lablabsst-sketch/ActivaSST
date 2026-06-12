// Validación de NIT colombiano según algoritmo oficial DIAN.
// Pesos: 71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3
// Suma ponderada mod 11; resto 0 o 1 -> dígito = resto, otro -> 11 - resto.

const PESOS = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];

export function calcularDigitoNit(nitBase: string): number {
  const digits = nitBase.replace(/\D/g, "");
  if (digits.length === 0 || digits.length > PESOS.length) {
    throw new Error("NIT con longitud inválida");
  }
  const offset = PESOS.length - digits.length;
  let suma = 0;
  for (let i = 0; i < digits.length; i++) {
    suma += parseInt(digits[i]!, 10) * PESOS[i + offset]!;
  }
  const resto = suma % 11;
  return resto < 2 ? resto : 11 - resto;
}

export function verificarDigitoNit(nitConDv: string): boolean {
  const match = /^(\d{6,15})-(\d)$/.exec(nitConDv.trim());
  if (!match) return false;
  const [, base, dv] = match;
  try {
    return calcularDigitoNit(base!) === parseInt(dv!, 10);
  } catch {
    return false;
  }
}

// Regex base aceptado por el sistema (DV opcional para no romper datos legacy).
export const NIT_REGEX = /^\d{6,15}(-\d)?$/;
export const CEDULA_REGEX = /^\d{6,12}$/;
