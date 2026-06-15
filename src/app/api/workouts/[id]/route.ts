import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, badRequest, notFound, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { workoutUpdateSchema } from "@/lib/schemas";
import { getMissingExerciseIds } from "@/lib/validate-exercise-ids";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const workout = await prisma.workout.findFirst({
    where: {
      id,
      userId: user.id
    },
    include: {
      exercises: {
        orderBy: { order: "asc" }
      }
    }
  });

  if (!workout) {
    return notFound("Treino");
  }

  return json({ workout });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const payload = workoutUpdateSchema.parse(await request.json());
    const { id } = await context.params;
    const existing = await prisma.workout.findFirst({
      where: {
        id,
        userId: user.id
      },
      select: { id: true }
    });

    if (!existing) {
      return notFound("Treino");
    }

    if (payload.exercises) {
      const missingIds = getMissingExerciseIds(payload.exercises.map((exercise) => exercise.exerciseId));

      if (missingIds.length) {
        return json({ error: "Exercicios nao encontrados.", exerciseIds: missingIds }, 400);
      }
    }

    const workout = await prisma.$transaction(async (tx) => {
      if (payload.exercises) {
        await tx.workoutExercise.deleteMany({ where: { workoutId: id } });
      }

      return tx.workout.update({
        where: { id },
        data: {
          title: payload.title,
          weekday: payload.weekday,
          notes: payload.notes,
          exercises: payload.exercises
            ? {
                create: payload.exercises.map((exercise, index) => ({
                  exerciseId: exercise.exerciseId,
                  order: exercise.order ?? index,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restSeconds: exercise.restSeconds,
                  loadKg: exercise.loadKg,
                  notes: exercise.notes
                }))
              }
            : undefined
        },
        include: {
          exercises: {
            orderBy: { order: "asc" }
          }
        }
      });
    });

    return json({ workout });
  } catch (error) {
    return badRequest(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const deleted = await prisma.workout.deleteMany({
    where: {
      id,
      userId: user.id
    }
  });

  if (!deleted.count) {
    return notFound("Treino");
  }

  return json({ ok: true });
}
