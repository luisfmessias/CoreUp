import exercises from "@/data/exercises.json";

export type Exercise = {
  id: number;
  nome: string;
  grupoMuscular: string;
  equipamento: string;
  nivel: string;
  imagem: string;
};

export const exerciseList = exercises as Exercise[];

export function findExercise(id: number) {
  return exerciseList.find((exercise) => exercise.id === id) ?? null;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
