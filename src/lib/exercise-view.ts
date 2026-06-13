import type { Exercise, WorkoutDay } from "@/types/fitness";

export function exerciseMap(exercises: Exercise[]) {
  return new Map(exercises.map((exercise) => [exercise.id, exercise]));
}

export function getTodayWorkout(plan: WorkoutDay[]) {
  const today = new Date().getDay();
  const indexByDay = new Map([
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 4]
  ]);

  return plan[indexByDay.get(today) ?? 0];
}

export function summarizeGroups(exercises: Exercise[]) {
  return exercises.reduce<Record<string, number>>((groups, exercise) => {
    groups[exercise.grupoMuscular] = (groups[exercise.grupoMuscular] ?? 0) + 1;
    return groups;
  }, {});
}
