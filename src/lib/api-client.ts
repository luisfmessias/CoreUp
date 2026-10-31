export function apiFetch(token: string, path: string, init: RequestInit = {}) {
  return fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  });
}

export type AccountType = "USER" | "PROFESSIONAL";

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export type ProfessionalInfo = {
  crefNumber: string;
  crefState: string;
  specialty: string;
  education: string;
  verificationStatus: VerificationStatus;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  heightCm?: number | null;
  weightKg?: number | null;
  accountType: AccountType;
  professional: ProfessionalInfo | null;
};
