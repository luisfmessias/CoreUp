import type { Exercise, WorkoutDay, WorkoutExercise } from "@/types/fitness";
import { normalizeText } from "@/lib/exercises";

export type TrainingGoal = "hipertrofia" | "forca" | "emagrecimento" | "saude";
export type TrainingLevel = "iniciante" | "intermediario" | "avancado";
export type TrainingPreset = "ppl" | "superiores-inferiores" | "peito" | "costas" | "pernas" | "livre";

export type GeneratorPreferences = {
  goal: TrainingGoal;
  level: TrainingLevel;
  planPreset: TrainingPreset;
  daysPerWeek: number;
  minutesPerSession: number;
  availableEquipment: string[];
  favoriteExerciseIds: number[];
};

type DayBlueprint = {
  id: string;
  label: string;
  focus: string;
  groups: string[];
  intensity: WorkoutDay["intensity"];
};

export type GeneratedPlan = {
  days: WorkoutDay[];
  coverage: Record<string, number>;
  notes: string[];
};

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const mustCoverGroups = ["Peito", "Costas", "Quadríceps", "Posterior de Coxa", "Glúteos", "Ombros", "Abdômen"];

const equipmentAliases: Record<string, string[]> = {
  Academia: ["Barra", "Halteres", "Máquina", "Polia", "Peso corporal", "Elástico", "Kettlebell"],
  Casa: ["Peso corporal", "Elástico", "Halteres", "Kettlebell"],
  "Peso corporal": ["Peso corporal"],
  Halteres: ["Halteres", "Peso corporal"],
  Barra: ["Barra", "Peso corporal"],
  Polia: ["Polia", "Peso corporal"],
  Maquina: ["Máquina", "Peso corporal"]
};

export const generatorOptions = {
  goals: [
    { id: "hipertrofia", label: "Hipertrofia" },
    { id: "forca", label: "Forca" },
    { id: "emagrecimento", label: "Emagrecimento" },
    { id: "saude", label: "Saude geral" }
  ] satisfies Array<{ id: TrainingGoal; label: string }>,
  levels: [
    { id: "iniciante", label: "Iniciante" },
    { id: "intermediario", label: "Intermediario" },
    { id: "avancado", label: "Avancado" }
  ] satisfies Array<{ id: TrainingLevel; label: string }>,
  equipment: ["Academia", "Casa", "Peso corporal", "Halteres", "Barra", "Polia", "Maquina"],
  presets: [
    { id: "ppl", label: "Push Pull Legs" },
    { id: "superiores-inferiores", label: "Superiores / inferiores" },
    { id: "peito", label: "Foco em peito" },
    { id: "costas", label: "Foco em costas" },
    { id: "pernas", label: "Foco em pernas" },
    { id: "livre", label: "Livre" }
  ] satisfies Array<{ id: TrainingPreset; label: string }>
};

export function generateWorkoutPlan(exercises: Exercise[], preferences: GeneratorPreferences): GeneratedPlan {
  const blueprints = getBlueprints(preferences);
  const pickedIds = new Set<number>();
  const favoriteIds = new Set(preferences.favoriteExerciseIds);
  const allowedEquipment = getAllowedEquipment(preferences.availableEquipment);
  const candidates = exercises.filter((exercise) => allowedEquipment.has(exercise.equipamento));
  const fallbackCandidates = candidates.length ? candidates : exercises;
  const targetPerDay = getTargetExerciseCount(preferences.minutesPerSession, preferences.level);

  const days = blueprints.map((blueprint, dayIndex) => {
    const dayExercises: WorkoutExercise[] = [];
    const groups = expandGroupsForGoal(blueprint.groups, preferences.goal);

    groups.forEach((group) => {
      if (dayExercises.length >= targetPerDay) {
        return;
      }

      const exercise = pickExercise(fallbackCandidates, group, groups, favoriteIds, pickedIds, dayExercises.length);

      if (exercise) {
        pickedIds.add(exercise.id);
        dayExercises.push(prescribeExercise(exercise, preferences, dayExercises.length));
      }
    });

    while (dayExercises.length < targetPerDay) {
      const group = groups[dayExercises.length % groups.length];
      const exercise = pickExercise(fallbackCandidates, group, groups, favoriteIds, pickedIds, dayExercises.length);

      if (!exercise) {
        break;
      }

      pickedIds.add(exercise.id);
      dayExercises.push(prescribeExercise(exercise, preferences, dayExercises.length));
    }

    return {
      id: `gerado-${dayIndex + 1}`,
      label: dayLabels[dayIndex] ?? `D${dayIndex + 1}`,
      focus: getWorkoutTitle(blueprint.groups, blueprint.focus),
      duration: `${preferences.minutesPerSession} min`,
      intensity: blueprint.intensity,
      exercises: dayExercises
    };
  });

  const coverage = summarizePlanCoverage(days, exercises);

  return {
    days,
    coverage,
    notes: buildPlanNotes(preferences, coverage)
  };
}

export function getEquipmentList(exercises: Exercise[]) {
  return Array.from(new Set(exercises.map((exercise) => exercise.equipamento))).sort((a, b) => a.localeCompare(b));
}

function getBlueprints(preferences: GeneratorPreferences): DayBlueprint[] {
  const daysPerWeek = preferences.daysPerWeek;
  const presetBlueprints = getPresetBlueprints(preferences.planPreset, daysPerWeek);

  if (presetBlueprints.length) {
    return presetBlueprints;
  }

  const blueprints: Record<number, DayBlueprint[]> = {
    2: [
      { id: "full-a", label: "Seg", focus: "Corpo todo A", groups: ["Quadríceps", "Peito", "Costas", "Glúteos", "Abdômen"], intensity: "Moderado" },
      { id: "full-b", label: "Qui", focus: "Corpo todo B", groups: ["Posterior de Coxa", "Ombros", "Costas", "Peito", "Panturrilhas"], intensity: "Moderado" }
    ],
    3: [
      { id: "upper", label: "Seg", focus: "Superiores", groups: ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"], intensity: "Moderado" },
      { id: "lower", label: "Qua", focus: "Inferiores", groups: ["Quadríceps", "Posterior de Coxa", "Glúteos", "Panturrilhas", "Abdômen"], intensity: "Forte" },
      { id: "full", label: "Sex", focus: "Corpo todo", groups: ["Costas", "Peito", "Quadríceps", "Glúteos", "Abdômen"], intensity: "Moderado" }
    ],
    4: [
      { id: "push", label: "Seg", focus: "Empurrar", groups: ["Peito", "Ombros", "Tríceps"], intensity: "Forte" },
      { id: "legs-a", label: "Ter", focus: "Pernas A", groups: ["Quadríceps", "Glúteos", "Panturrilhas", "Abdômen"], intensity: "Forte" },
      { id: "pull", label: "Qui", focus: "Puxar", groups: ["Costas", "Bíceps", "Antebraço"], intensity: "Moderado" },
      { id: "legs-b", label: "Sex", focus: "Pernas B", groups: ["Posterior de Coxa", "Glúteos", "Quadríceps", "Abdômen"], intensity: "Moderado" }
    ],
    5: [
      { id: "push", label: "Seg", focus: "Peito, ombro e triceps", groups: ["Peito", "Ombros", "Tríceps"], intensity: "Forte" },
      { id: "pull", label: "Ter", focus: "Costas e biceps", groups: ["Costas", "Bíceps", "Antebraço"], intensity: "Forte" },
      { id: "legs", label: "Qua", focus: "Pernas", groups: ["Quadríceps", "Posterior de Coxa", "Glúteos", "Panturrilhas"], intensity: "Forte" },
      { id: "upper", label: "Qui", focus: "Superiores leve", groups: ["Costas", "Peito", "Ombros", "Abdômen"], intensity: "Moderado" },
      { id: "full", label: "Sex", focus: "Corpo todo", groups: ["Glúteos", "Quadríceps", "Costas", "Cardio", "Abdômen"], intensity: "Moderado" }
    ]
  };

  return blueprints[Math.min(Math.max(daysPerWeek, 2), 5)];
}

function getPresetBlueprints(preset: TrainingPreset, daysPerWeek: number): DayBlueprint[] {
  const count = Math.min(Math.max(daysPerWeek, 2), 5);
  const presets: Record<TrainingPreset, DayBlueprint[]> = {
    ppl: [
      { id: "push", label: "Seg", focus: "Push", groups: ["Peito", "Ombros", "Tríceps"], intensity: "Forte" },
      { id: "pull", label: "Ter", focus: "Pull", groups: ["Costas", "Bíceps", "Antebraço"], intensity: "Forte" },
      { id: "legs", label: "Qua", focus: "Legs", groups: ["Quadríceps", "Posterior de Coxa", "Glúteos", "Panturrilhas"], intensity: "Forte" },
      { id: "push-b", label: "Qui", focus: "Push B", groups: ["Peito", "Ombros", "Tríceps"], intensity: "Moderado" },
      { id: "pull-b", label: "Sex", focus: "Pull B", groups: ["Costas", "Bíceps", "Antebraço"], intensity: "Moderado" }
    ],
    "superiores-inferiores": [
      { id: "upper-a", label: "Seg", focus: "Superiores A", groups: ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"], intensity: "Forte" },
      { id: "lower-a", label: "Ter", focus: "Inferiores A", groups: ["Quadríceps", "Posterior de Coxa", "Glúteos", "Panturrilhas"], intensity: "Forte" },
      { id: "upper-b", label: "Qui", focus: "Superiores B", groups: ["Costas", "Peito", "Ombros", "Antebraço"], intensity: "Moderado" },
      { id: "lower-b", label: "Sex", focus: "Inferiores B", groups: ["Glúteos", "Posterior de Coxa", "Quadríceps", "Abdômen"], intensity: "Moderado" },
      { id: "core", label: "Sab", focus: "Complementar", groups: ["Abdômen", "Cardio", "Corpo Inteiro / Funcionais"], intensity: "Leve" }
    ],
    peito: [
      { id: "chest-a", label: "Seg", focus: "Peito", groups: ["Peito", "Ombros", "Tríceps"], intensity: "Forte" },
      { id: "back", label: "Ter", focus: "Costas", groups: ["Costas", "Bíceps", "Antebraço"], intensity: "Moderado" },
      { id: "legs", label: "Qua", focus: "Pernas", groups: ["Quadríceps", "Posterior de Coxa", "Glúteos"], intensity: "Forte" },
      { id: "chest-b", label: "Qui", focus: "Peito", groups: ["Peito", "Ombros", "Tríceps"], intensity: "Moderado" },
      { id: "full", label: "Sex", focus: "Corpo todo", groups: ["Costas", "Peito", "Abdômen"], intensity: "Leve" }
    ],
    costas: [
      { id: "back-a", label: "Seg", focus: "Costas", groups: ["Costas", "Bíceps", "Antebraço"], intensity: "Forte" },
      { id: "push", label: "Ter", focus: "Peito", groups: ["Peito", "Ombros", "Tríceps"], intensity: "Moderado" },
      { id: "legs", label: "Qua", focus: "Pernas", groups: ["Quadríceps", "Posterior de Coxa", "Glúteos"], intensity: "Forte" },
      { id: "back-b", label: "Qui", focus: "Costas", groups: ["Costas", "Bíceps", "Antebraço"], intensity: "Moderado" },
      { id: "core", label: "Sex", focus: "Centro", groups: ["Abdômen", "Cardio"], intensity: "Leve" }
    ],
    pernas: [
      { id: "legs-a", label: "Seg", focus: "Pernas", groups: ["Quadríceps", "Glúteos", "Panturrilhas"], intensity: "Forte" },
      { id: "upper", label: "Ter", focus: "Superiores", groups: ["Peito", "Costas", "Ombros"], intensity: "Moderado" },
      { id: "legs-b", label: "Qua", focus: "Pernas", groups: ["Posterior de Coxa", "Glúteos", "Abdômen"], intensity: "Forte" },
      { id: "pull", label: "Qui", focus: "Costas", groups: ["Costas", "Bíceps", "Antebraço"], intensity: "Moderado" },
      { id: "legs-c", label: "Sex", focus: "Pernas", groups: ["Quadríceps", "Posterior de Coxa", "Panturrilhas"], intensity: "Moderado" }
    ],
    livre: []
  };

  return presets[preset].slice(0, count);
}

function getWorkoutTitle(groups: string[], fallback: string) {
  const uniqueGroups = Array.from(new Set(groups));

  if (uniqueGroups.length === 1) {
    return uniqueGroups[0];
  }

  if (uniqueGroups.includes("Peito") && uniqueGroups.includes("Ombros") && uniqueGroups.includes("Tríceps")) {
    return "Peito, ombro e triceps";
  }

  if (uniqueGroups.includes("Costas") && uniqueGroups.includes("Bíceps")) {
    return uniqueGroups.includes("Antebraço") ? "Costas, biceps e antebraco" : "Costas e biceps";
  }

  if (uniqueGroups.includes("Quadríceps") && uniqueGroups.includes("Posterior de Coxa")) {
    return uniqueGroups.includes("Glúteos") ? "Quadriceps, posterior e gluteos" : "Quadriceps e posterior";
  }

  if (uniqueGroups.includes("Peito") && uniqueGroups.includes("Costas")) {
    return "Peito, costas e ombros";
  }

  return fallback;
}

function expandGroupsForGoal(groups: string[], goal: TrainingGoal) {
  if (goal === "emagrecimento") {
    return [...groups, "Cardio", "Corpo Inteiro / Funcionais"];
  }

  if (goal === "saude") {
    return [...groups, "Abdômen"];
  }

  return groups;
}

function getAllowedEquipment(selectedEquipment: string[]) {
  const selected = selectedEquipment.length ? selectedEquipment : ["Academia"];
  const allowed = new Set<string>();

  selected.forEach((equipment) => {
    (equipmentAliases[equipment] ?? [equipment]).forEach((item) => allowed.add(item));
  });

  return allowed;
}

function getTargetExerciseCount(minutes: number, level: TrainingLevel) {
  const base = minutes >= 60 ? 6 : minutes >= 45 ? 5 : 4;

  if (level === "iniciante") {
    return Math.max(4, base - 1);
  }

  if (level === "avancado") {
    return Math.min(7, base + 1);
  }

  return base;
}

function pickExercise(
  exercises: Exercise[],
  group: string,
  allowedGroups: string[],
  favoriteIds: Set<number>,
  pickedIds: Set<number>,
  slotIndex: number
) {
  const sameGroup = exercises.filter((exercise) => exercise.grupoMuscular === group && !pickedIds.has(exercise.id));
  const allowedGroupSet = new Set(allowedGroups);
  const dayPool = exercises.filter((exercise) => allowedGroupSet.has(exercise.grupoMuscular) && !pickedIds.has(exercise.id));
  const pool = sameGroup.length ? sameGroup : dayPool;

  return pool
    .map((exercise) => ({
      exercise,
      score: getExerciseScore(exercise, group, favoriteIds, slotIndex)
    }))
    .sort((a, b) => b.score - a.score || a.exercise.nome.localeCompare(b.exercise.nome))[0]?.exercise;
}

function getExerciseScore(exercise: Exercise, targetGroup: string, favoriteIds: Set<number>, slotIndex: number) {
  let score = exercise.grupoMuscular === targetGroup ? 40 : 0;

  if (favoriteIds.has(exercise.id)) {
    score += exercise.grupoMuscular === targetGroup ? 80 : 18;
  }

  if (slotIndex < 2 && isCompoundName(exercise.nome)) {
    score += 16;
  }

  if (normalizeText(exercise.nivel).includes("iniciante")) {
    score += 4;
  }

  return score;
}

function isCompoundName(name: string) {
  const normalized = normalizeText(name);
  return ["supino", "agachamento", "terra", "remada", "barra", "leg press", "desenvolvimento", "levantamento"].some(
    (term) => normalized.includes(term)
  );
}

function prescribeExercise(exercise: Exercise, preferences: GeneratorPreferences, slotIndex: number): WorkoutExercise {
  const isCoreOrCardio = ["Abdômen", "Cardio", "Corpo Inteiro / Funcionais"].includes(exercise.grupoMuscular);
  const heavy = preferences.goal === "forca" && slotIndex < 2 && !isCoreOrCardio;
  const beginner = preferences.level === "iniciante";

  return {
    exerciseId: exercise.id,
    sets: beginner ? 3 : heavy ? 5 : 4,
    reps: isCoreOrCardio ? (exercise.grupoMuscular === "Cardio" ? "8-12 min" : "30-45s") : heavy ? "4-6" : "8-12",
    rest: heavy ? "120s" : isCoreOrCardio ? "45s" : "75s",
    note: favoriteNote(exercise.id, preferences.favoriteExerciseIds)
  };
}

function favoriteNote(exerciseId: number, favorites: number[]) {
  return favorites.includes(exerciseId) ? "Favorito do aluno" : undefined;
}

function summarizePlanCoverage(days: WorkoutDay[], exercises: Exercise[]) {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  return days.reduce<Record<string, number>>((summary, day) => {
    day.exercises.forEach((item) => {
      const group = byId.get(item.exerciseId)?.grupoMuscular;

      if (group) {
        summary[group] = (summary[group] ?? 0) + (item.sets ?? 0);
      }
    });

    return summary;
  }, {});
}

function buildPlanNotes(preferences: GeneratorPreferences, coverage: Record<string, number>) {
  const missing = mustCoverGroups.filter((group) => !coverage[group]);
  const notes = [
    "Cada sessao combina preferencias do aluno com cobertura dos principais padroes de movimento.",
    "Use carga que deixe 1 a 3 repeticoes em reserva na maior parte das series."
  ];

  if (preferences.daysPerWeek >= 2) {
    notes.push("A semana respeita a base minima de fortalecimento em pelo menos 2 dias.");
  }

  if (missing.length) {
    notes.push(`Revisar disponibilidade de exercicios para: ${missing.join(", ")}.`);
  }

  if (preferences.goal === "emagrecimento") {
    notes.push("Para emagrecimento, combine o treino com passos, cardio leve e ajuste alimentar.");
  }

  return notes;
}
