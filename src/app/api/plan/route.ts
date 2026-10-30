import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, badRequest, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { planSchema, preferencesSchema } from "@/lib/schemas";
import { getMissingExerciseIds } from "@/lib/validate-exercise-ids";

const workoutInclude = {
  exercises: {
    orderBy: { order: "asc" as const }
  }
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const workouts = await prisma.workout.findMany({
    where: { userId: user.id },
    include: workoutInclude,
    orderBy: [{ weekday: "asc" }, { createdAt: "asc" }]
  });

  return json({
    workouts,
    preferences: preferencesSchema.safeParse(user.preferences).data ?? null
  });
}

// Substitui o plano inteiro do usuario: apaga os treinos atuais e grava os novos
// na mesma transacao. O historico de execucao e preservado (workoutId vira null).
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const payload = planSchema.parse(await request.json());
    const missingIds = getMissingExerciseIds(
      payload.days.flatMap((day) => day.exercises.map((exercise) => exercise.exerciseId))
    );

    if (missingIds.length) {
      return json({ error: "Exercicios nao encontrados.", exerciseIds: missingIds }, 400);
    }

    const results = await prisma.$transaction([
      prisma.workout.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
        where: { id: user.id },
        data: { preferences: payload.preferences }
      }),
      ...payload.days.map((day) =>
        prisma.workout.create({
          data: {
            userId: user.id,
            title: day.title,
            weekday: day.weekday,
            intensity: day.intensity,
            durationMin: day.durationMin,
            notes: day.notes,
            exercises: {
              create: day.exercises.map((exercise, index) => ({
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
          include: workoutInclude
        })
      )
    ]);

    return json({ workouts: results.slice(2), preferences: payload.preferences });
  } catch (error) {
    return badRequest(error);
  }
}
