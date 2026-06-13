import { findExercise } from "@/lib/exercises";

export function getMissingExerciseIds(exerciseIds: number[]) {
  return [...new Set(exerciseIds)].filter((exerciseId) => !findExercise(exerciseId));
}
