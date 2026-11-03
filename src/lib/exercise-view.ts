import type { Exercise, WorkoutDay } from "@/types/fitness";

export function exerciseMap(exercises: Exercise[]) {
  return new Map(exercises.map((exercise) => [exercise.id, exercise]));
}

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function getTodayWorkout(plan: WorkoutDay[]) {
  const today = weekdayLabels[new Date().getDay()];
  return plan.find((day) => day.label === today) ?? plan[0];
}

export function summarizeGroups(exercises: Exercise[]) {
  return exercises.reduce<Record<string, number>>((groups, exercise) => {
    groups[exercise.grupoMuscular] = (groups[exercise.grupoMuscular] ?? 0) + 1;
    return groups;
  }, {});
}
