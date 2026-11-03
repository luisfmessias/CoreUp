export type ApiLogSet = {
  id: string;
  exerciseId: number;
  setNumber: number;
  reps: number | null;
  loadKg: number | null;
  done: boolean;
};

export type ApiWorkoutLog = {
  id: string;
  workoutId: string | null;
  title: string | null;
  performedAt: string;
  durationMin: number | null;
  notes: string | null;
  workout: { title: string } | null;
  sets: ApiLogSet[];
};

export type ApiBodyMetric = {
  id: string;
  weightKg: number | null;
  heightCm: number | null;
  bodyFat: number | null;
  measuredAt: string;
  notes: string | null;
};

export function logTitle(log: ApiWorkoutLog) {
  return log.title ?? log.workout?.title ?? "Treino";
}

export function logVolume(log: Pick<ApiWorkoutLog, "sets">) {
  return log.sets.reduce((total, set) => total + (set.done && set.reps && set.loadKg ? set.reps * set.loadKg : 0), 0);
}

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatShortDate(value: string | Date) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatLongDate(value: string | Date) {
  return new Date(value).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export function formatKg(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(".", ",")} kg`;
}

// Logs chegam do mais recente para o mais antigo.
export function lastSetsFor(logs: ApiWorkoutLog[], exerciseId: number) {
  for (const log of logs) {
    const sets = log.sets.filter((set) => set.exerciseId === exerciseId && set.done);

    if (sets.length) {
      return { performedAt: log.performedAt, sets: [...sets].sort((a, b) => a.setNumber - b.setNumber) };
    }
  }

  return null;
}

export function bestLoadFor(logs: ApiWorkoutLog[], exerciseId: number) {
  return logs.reduce((best, log) => {
    const max = Math.max(0, ...log.sets.filter((set) => set.exerciseId === exerciseId && set.done).map((set) => set.loadKg ?? 0));
    return Math.max(best, max);
  }, 0);
}

export function loadSeriesFor(logs: ApiWorkoutLog[], exerciseId: number) {
  return logs
    .map((log) => ({
      date: log.performedAt,
      value: Math.max(0, ...log.sets.filter((set) => set.exerciseId === exerciseId && set.done).map((set) => set.loadKg ?? 0))
    }))
    .filter((point) => point.value > 0)
    .reverse();
}

export function exercisesWithLoad(logs: ApiWorkoutLog[]) {
  const counts = new Map<number, number>();

  logs.forEach((log) => {
    new Set(log.sets.filter((set) => set.done && set.loadKg).map((set) => set.exerciseId)).forEach((id) => {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

export function monthCount(logs: ApiWorkoutLog[], now = new Date()) {
  return logs.filter((log) => {
    const date = new Date(log.performedAt);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
}

function weekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start.getTime();
}

// Semanas seguidas (segunda a domingo) com pelo menos um treino. A semana atual
// só quebra a sequencia depois que termina.
export function weekStreak(logs: ApiWorkoutLog[], now = new Date()) {
  const weeks = new Set(logs.map((log) => weekStart(new Date(log.performedAt))));
  const week = 7 * 24 * 60 * 60 * 1000;
  let cursor = weekStart(now);

  if (!weeks.has(cursor)) {
    cursor -= week;
  }

  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor -= week;
  }

  return streak;
}

export function lastDays(logs: ApiWorkoutLog[], count = 28, now = new Date()) {
  const trained = new Set(logs.map((log) => dayKey(new Date(log.performedAt))));

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1 - index));
    return { date, trained: trained.has(dayKey(date)) };
  });
}

export function personalRecords(sets: Pick<ApiLogSet, "exerciseId" | "loadKg" | "done">[], previousLogs: ApiWorkoutLog[]) {
  const best = new Map<number, number>();

  sets.forEach((set) => {
    if (set.done && set.loadKg) {
      best.set(set.exerciseId, Math.max(best.get(set.exerciseId) ?? 0, set.loadKg));
    }
  });

  return [...best.entries()]
    .filter(([exerciseId, load]) => {
      const previous = bestLoadFor(previousLogs, exerciseId);
      return previous > 0 && load > previous;
    })
    .map(([exerciseId, load]) => ({ exerciseId, load }));
}

export function isTimedPrescription(reps: string) {
  return /(\d\s*s|min)$/i.test(reps.trim());
}
