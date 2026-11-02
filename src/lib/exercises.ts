import exercises from "@/data/exercises.json";
import { normalizeText } from "@/lib/text";

export { normalizeText };

export type Exercise = {
  id: number;
  nome: string;
  grupoMuscular: string;
  equipamento: string;
  nivel: string;
  imagem: string;
};

const equipmentNames: Record<string, string> = {
  barra: "Barra",
  "barra w": "Barra W",
  halteres: "Halteres",
  halter: "Halteres",
  polia: "Polia",
  "polia unilateral": "Polia",
  maquina: "Máquina",
  "maquina assistida": "Máquina",
  smith: "Smith",
  "peso corporal": "Peso corporal",
  kettlebell: "Kettlebell",
  elastico: "Elástico",
  anilha: "Anilha",
  anilhas: "Anilha",
  disco: "Anilha",
  "medicine ball": "Medicine ball",
  "corda naval": "Corda naval",
  corda: "Corda",
  esteira: "Esteira",
  ergometrica: "Bicicleta ergométrica",
  ergometro: "Ergômetro",
  "trap bar": "Trap bar",
  "hand gripper": "Hand gripper",
  "roda abdominal": "Roda abdominal",
  bola: "Bola"
};

export function normalizeEquipment(value: string) {
  const trimmed = value.trim();
  return equipmentNames[normalizeText(trimmed)] ?? trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export const exerciseList: Exercise[] = (exercises as Exercise[]).map((exercise) => ({
  ...exercise,
  equipamento: normalizeEquipment(exercise.equipamento)
}));

const exerciseById = new Map(exerciseList.map((exercise) => [exercise.id, exercise]));

export function findExercise(id: number) {
  return exerciseById.get(id) ?? null;
}
