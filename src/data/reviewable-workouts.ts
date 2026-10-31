import type { TrainingGoal, TrainingLevel, TrainingPreset } from "@/lib/workout-generator";

// Nao mude a key de um treino existente: e ela que liga as avaliacoes gravadas no banco.
export type ReviewableWorkout = {
  key: string;
  name: string;
  preset: TrainingPreset;
  goal: TrainingGoal;
  level: TrainingLevel;
  daysPerWeek: number;
  minutesPerSession: number;
};

export const reviewableWorkouts: ReviewableWorkout[] = [
  { key: "ppl-hipertrofia", name: "Push Pull Legs", preset: "ppl", goal: "hipertrofia", level: "intermediario", daysPerWeek: 5, minutesPerSession: 50 },
  { key: "superiores-inferiores-forca", name: "Superiores / inferiores", preset: "superiores-inferiores", goal: "forca", level: "avancado", daysPerWeek: 4, minutesPerSession: 60 },
  { key: "pernas-hipertrofia", name: "Foco em pernas", preset: "pernas", goal: "hipertrofia", level: "intermediario", daysPerWeek: 5, minutesPerSession: 55 },
  { key: "livre-emagrecimento", name: "Corpo todo para emagrecimento", preset: "livre", goal: "emagrecimento", level: "iniciante", daysPerWeek: 3, minutesPerSession: 45 },
  { key: "peito-avancado", name: "Foco em peito", preset: "peito", goal: "hipertrofia", level: "avancado", daysPerWeek: 5, minutesPerSession: 60 },
  { key: "costas-saude", name: "Foco em costas", preset: "costas", goal: "saude", level: "iniciante", daysPerWeek: 3, minutesPerSession: 40 },
  { key: "livre-saude-2dias", name: "Corpo todo em 2 dias", preset: "livre", goal: "saude", level: "intermediario", daysPerWeek: 2, minutesPerSession: 40 },
  { key: "ppl-forca-avancado", name: "Push Pull Legs para forca", preset: "ppl", goal: "forca", level: "avancado", daysPerWeek: 4, minutesPerSession: 60 }
];

export const reviewableWorkoutKeys = new Set(reviewableWorkouts.map((workout) => workout.key));
