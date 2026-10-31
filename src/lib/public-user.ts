import type { ProfessionalProfile, User } from "@prisma/client";

type UserWithProfile = User & { professional?: ProfessionalProfile | null };

export function toPublicUser(user: UserWithProfile) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    heightCm: user.heightCm,
    weightKg: user.weightKg,
    createdAt: user.createdAt,
    accountType: user.accountType,
    professional: user.professional
      ? {
          crefNumber: user.professional.crefNumber,
          crefState: user.professional.crefState,
          specialty: user.professional.specialty,
          education: user.professional.education,
          verificationStatus: user.professional.verificationStatus
        }
      : null
  };
}
