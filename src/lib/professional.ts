export const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
] as const;

export type BrazilianState = (typeof brazilianStates)[number];

const crefPattern = /^(\d{1,6})-?([GP])?$/;

export function normalizeCref(value: string) {
  const match = value.replace(/\s+/g, "").toUpperCase().match(crefPattern);

  if (!match) {
    return null;
  }

  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

export const verificationLabels = {
  PENDING: "Verificacao pendente",
  VERIFIED: "CREF verificado",
  REJECTED: "Registro nao confirmado"
} as const;
