import type { Prisma, ProfessionalRequest, User } from "@prisma/client";

export const latestRequestInclude = {
  professionalRequests: { orderBy: { createdAt: "desc" }, take: 1 }
} satisfies Prisma.UserInclude;

type UserWithRequests = User & { professionalRequests?: ProfessionalRequest[] };

export function toPublicUser(user: UserWithRequests) {
  const request = user.professionalRequests?.[0] ?? null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    heightCm: user.heightCm,
    weightKg: user.weightKg,
    createdAt: user.createdAt,
    accountType: user.accountType,
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    professional: request
      ? {
          status: request.status,
          crefNumber: request.crefNumber,
          crefState: request.crefState,
          specialty: request.specialty,
          education: request.education,
          rejectionReason: request.rejectionReason,
          createdAt: request.createdAt,
          reviewedAt: request.reviewedAt
        }
      : null
  };
}
