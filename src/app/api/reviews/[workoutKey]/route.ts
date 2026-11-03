import { NextRequest } from "next/server";
import { reviewableWorkoutKeys } from "@/data/reviewable-workouts";
import { getCurrentUser } from "@/lib/auth";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canReviewWorkouts } from "@/lib/professional-requests";
import { reviewInclude, serializeReview } from "@/lib/reviews";
import { workoutReviewSchema } from "@/lib/schemas";

type Context = { params: Promise<{ workoutKey: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  if (!canReviewWorkouts(user)) {
    return json({ error: "Apenas profissionais de Educação Física aprovados podem avaliar treinos." }, 403);
  }

  const { workoutKey } = await context.params;

  if (!reviewableWorkoutKeys.has(workoutKey)) {
    return notFound("Treino");
  }

  try {
    const payload = workoutReviewSchema.parse(await request.json());
    const review = await prisma.workoutReview.upsert({
      where: { professionalId_workoutKey: { professionalId: user.id, workoutKey } },
      create: { professionalId: user.id, workoutKey, ...payload },
      update: payload,
      include: reviewInclude
    });

    return json({ review: serializeReview(review, user.id) });
  } catch (error) {
    return badRequest(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  if (!canReviewWorkouts(user)) {
    return forbidden();
  }

  const { workoutKey } = await context.params;
  const deleted = await prisma.workoutReview.deleteMany({
    where: { professionalId: user.id, workoutKey }
  });

  if (!deleted.count) {
    return notFound("Avaliação");
  }

  return json({ ok: true });
}
