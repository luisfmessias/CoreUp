export type Exercise = {
  id: number;
  nome: string;
  grupoMuscular: string;
  equipamento: string;
  nivel: string;
  imagem: string;
};

export type WorkoutExercise = {
  exerciseId: number;
  sets: number;
  reps: string;
  rest: string;
  note?: string;
};

export type WorkoutDay = {
  id: string;
  label: string;
  focus: string;
  duration: string;
  intensity: "Leve" | "Moderado" | "Forte";
  exercises: WorkoutExercise[];
};
