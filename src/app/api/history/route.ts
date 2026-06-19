import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, badRequest, notFound, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { workoutLogSchema } from "@/lib/schemas";
import { getMissingExerciseIds } from "@/lib/validate-exercise-ids";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const history = await prisma.workoutLog.findMany({
    where: { userId: user.id },
    include: {
      workout: true,
      sets: {
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }]
      }
    },
    orderBy: { performedAt: "desc" },
    take: 50
  });

  return json({ history });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const payload = workoutLogSchema.parse(await request.json());
    const missingIds = getMissingExerciseIds(payload.sets.map((set) => set.exerciseId));

    if (missingIds.length) {
      return json({ error: "Exercicios nao encontrados.", exerciseIds: missingIds }, 400);
    }

    if (payload.workoutId) {
      const workout = await prisma.workout.findFirst({
        where: {
          id: payload.workoutId,
          userId: user.id
        },
        select: { id: true }
      });

      if (!workout) {
        return notFound("Treino");
      }
    }

    const log = await prisma.workoutLog.create({
      data: {
        userId: user.id,
        workoutId: payload.workoutId,
        performedAt: payload.performedAt ? new Date(payload.performedAt) : undefined,
        durationMin: payload.durationMin,
        notes: payload.notes,
        sets: {
          create: payload.sets.map((set) => ({
            exerciseId: set.exerciseId,
            setNumber: set.setNumber,
            reps: set.reps,
            loadKg: set.loadKg,
            done: set.done ?? true
          }))
        }
      },
      include: {
        workout: true,
        sets: {
          orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }]
        }
      }
    });

    return json({ log }, 201);
  } catch (error) {
    return badRequest(error);
  }
}
