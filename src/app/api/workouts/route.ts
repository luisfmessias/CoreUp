import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, badRequest, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { workoutSchema } from "@/lib/schemas";
import { getMissingExerciseIds } from "@/lib/validate-exercise-ids";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const weekday = searchParams.get("weekday") ?? undefined;

  const workouts = await prisma.workout.findMany({
    where: {
      userId: user.id,
      weekday: weekday as never
    },
    include: {
      exercises: {
        orderBy: { order: "asc" }
      }
    },
    orderBy: [{ weekday: "asc" }, { createdAt: "desc" }]
  });

  return json({ workouts });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const payload = workoutSchema.parse(await request.json());
    const missingIds = getMissingExerciseIds(payload.exercises.map((exercise) => exercise.exerciseId));

    if (missingIds.length) {
      return json({ error: "Exercicios nao encontrados.", exerciseIds: missingIds }, 400);
    }

    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        title: payload.title,
        weekday: payload.weekday,
        notes: payload.notes,
        exercises: {
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
      },
      include: {
        exercises: {
          orderBy: { order: "asc" }
        }
      }
    });

    return json({ workout }, 201);
  } catch (error) {
    return badRequest(error);
  }
}
