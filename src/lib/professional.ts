export const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
] as const;

export type BrazilianState = (typeof brazilianStates)[number];

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

const crefPattern = /^(?:CREF)?(\d{1,6})-?([GP])(?:\/[A-Z]{2})?$/;

export function normalizeCref(value: string) {
  const match = value.replace(/[\s.]+/g, "").toUpperCase().match(crefPattern);

  if (!match) {
    return null;
  }

  return `${match[1].padStart(6, "0")}-${match[2]}`;
}

// Ignora a categoria (G/P) de proposito: trocar a letra nao pode liberar o mesmo CREF.
export function crefKeyFor(crefNumber: string, crefState: string) {
  return `${crefNumber.slice(0, 6)}/${crefState}`;
}

export const requestStatusLabels: Record<RequestStatus, string> = {
  PENDING: "Em analise",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado"
};

export const duplicateCrefMessages: Record<RequestStatus, string> = {
  PENDING: "Este CREF ja possui uma solicitacao em andamento. Aguarde a analise do administrador antes de realizar uma nova tentativa.",
  APPROVED: "Este CREF ja esta associado a uma conta profissional. Nao e possivel realizar outro cadastro utilizando esse registro.",
  REJECTED: "Este CREF ja foi utilizado em uma solicitacao rejeitada. Nao e possivel criar uma nova conta profissional utilizando o mesmo registro."
};

export const requestStatusMessages: Record<RequestStatus, string> = {
  PENDING:
    "Seu cadastro profissional esta em analise. O administrador esta verificando as informacoes do seu CREF. Voce recebera uma notificacao quando houver uma decisao.",
  APPROVED:
    "Seu cadastro profissional foi aprovado! Agora voce pode acessar todas as funcionalidades profissionais do aplicativo.",
  REJECTED:
    "Seu cadastro profissional foi rejeitado. Consulte o motivo informado pelo administrador para entender o que aconteceu."
};
