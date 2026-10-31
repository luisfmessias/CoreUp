import type { WorkoutDay } from "@/types/fitness";

export type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export type ApiWorkout = {
  id: string;
  title: string;
  weekday: Weekday | null;
  intensity: string | null;
  durationMin: number | null;
  exercises: Array<{
    exerciseId: number;
    sets: number | null;
    reps: string | null;
    restSeconds: number | null;
    notes: string | null;
  }>;
};

const weekdayByLabel: Record<string, Weekday> = {
  Seg: "MONDAY",
  Ter: "TUESDAY",
  Qua: "WEDNESDAY",
  Qui: "THURSDAY",
  Sex: "FRIDAY",
  Sab: "SATURDAY",
  Dom: "SUNDAY"
};

const labelByWeekday = Object.fromEntries(
  Object.entries(weekdayByLabel).map(([label, weekday]) => [weekday, label])
) as Record<Weekday, string>;

const intensities: WorkoutDay["intensity"][] = ["Leve", "Moderado", "Forte"];

export function toWorkoutDay(workout: ApiWorkout): WorkoutDay {
  return {
    id: workout.id,
    label: workout.weekday ? labelByWeekday[workout.weekday] : workout.title.slice(0, 3),
    focus: workout.title,
    duration: workout.durationMin ? `${workout.durationMin} min` : "--",
    intensity: intensities.find((intensity) => intensity === workout.intensity) ?? "Moderado",
    exercises: workout.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets ?? 0,
      reps: exercise.reps ?? "--",
      rest: exercise.restSeconds ? `${exercise.restSeconds}s` : "--",
      note: exercise.notes ?? undefined
    }))
  };
}

export function toPlanDays(days: WorkoutDay[]) {
  return days.map((day) => ({
    title: day.focus,
    weekday: weekdayByLabel[day.label],
    intensity: day.intensity,
    durationMin: parsePositiveInt(day.duration),
    exercises: day.exercises.map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      order: index,
      sets: exercise.sets,
      reps: exercise.reps,
      restSeconds: parsePositiveInt(exercise.rest),
      notes: exercise.note
    }))
  }));
}

function parsePositiveInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
