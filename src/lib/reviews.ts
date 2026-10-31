import type { Prisma } from "@prisma/client";

export const reviewInclude = {
  professional: {
    select: {
      id: true,
      name: true,
      professional: {
        select: { crefNumber: true, crefState: true, specialty: true, verificationStatus: true }
      }
    }
  }
} satisfies Prisma.WorkoutReviewInclude;

type ReviewWithProfessional = Prisma.WorkoutReviewGetPayload<{ include: typeof reviewInclude }>;

export function serializeReview(review: ReviewWithProfessional, currentUserId: string) {
  const profile = review.professional.professional;

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
      specialty: profile?.specialty ?? "",
      crefNumber: profile?.crefNumber ?? "",
      crefState: profile?.crefState ?? "",
      verificationStatus: profile?.verificationStatus ?? "PENDING"
    }
  };
}

export type PublicReview = ReturnType<typeof serializeReview>;
