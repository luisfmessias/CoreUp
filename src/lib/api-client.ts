import type { RequestStatus } from "@/lib/professional";

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

export type AccountType = "USER" | "PROFESSIONAL" | "ADMIN";

export type ProfessionalInfo = {
  status: RequestStatus;
  crefNumber: string;
  crefState: string;
  specialty: string;
  education: string;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  heightCm?: number | null;
  weightKg?: number | null;
  accountType: AccountType;
  onboardingCompleted: boolean;
  professional: ProfessionalInfo | null;
};

export type AppNotification = {
  id: string;
  type: "PROFESSIONAL_REQUEST_CREATED" | "PROFESSIONAL_REQUEST_APPROVED" | "PROFESSIONAL_REQUEST_REJECTED";
  title: string;
  message: string;
  requestId: string | null;
  readAt: string | null;
  createdAt: string;
  request: { status: RequestStatus; crefNumber: string; crefState: string; fullName: string } | null;
};

export function canReviewWorkouts(user: Pick<AuthUser, "accountType">) {
  return user.accountType === "PROFESSIONAL" || user.accountType === "ADMIN";
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
