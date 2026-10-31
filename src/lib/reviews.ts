import type { Prisma } from "@prisma/client";

export const reviewInclude = {
  professional: {
    select: {
      id: true,
      name: true,
      accountType: true,
      professionalRequests: {
        where: { status: "APPROVED" },
        orderBy: { reviewedAt: "desc" },
        take: 1,
        select: { crefNumber: true, crefState: true, specialty: true }
      }
    }
  }
} satisfies Prisma.WorkoutReviewInclude;

type ReviewWithProfessional = Prisma.WorkoutReviewGetPayload<{ include: typeof reviewInclude }>;

export function serializeReview(review: ReviewWithProfessional, currentUserId: string) {
  const profile = review.professional.professionalRequests[0];
  const isAdmin = review.professional.accountType === "ADMIN";

  return {
    id: review.id,
    workoutKey: review.workoutKey,
    rating: review.rating,
    comment: review.comment,
    strengths: review.strengths,
    limitations: review.limitations,
    recommendations: review.recommendations,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    isMine: review.professionalId === currentUserId,
    professional: {
      name: review.professional.name,
      role: isAdmin && !profile ? ("ADMIN" as const) : ("PROFESSIONAL" as const),
      specialty: profile?.specialty ?? (isAdmin ? "Administrador do app" : ""),
      crefNumber: profile?.crefNumber ?? "",
      crefState: profile?.crefState ?? ""
    }
  };
}
