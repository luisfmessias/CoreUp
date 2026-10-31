"use client";

import { Check, ChevronRight, Loader2, Plus, Timer, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatKg,
  isTimedPrescription,
  lastSetsFor,
  logVolume,
  personalRecords,
  type ApiWorkoutLog
} from "@/lib/history";
import type { Exercise, WorkoutDay } from "@/types/fitness";
import { ConfirmPanel } from "@/components/ui/ConfirmPanel";

type SetEntry = { load: string; reps: string; done: boolean };
type SessionState = {
  dayId: string;
  startedAt: number;
  exercises: Array<{ exerciseId: number; sets: SetEntry[] }>;
};

export type SessionPayload = {
  workoutId: string;
  title: string;
  durationMin: number;
  sets: Array<{ exerciseId: number; setNumber: number; reps?: number; loadKg?: number; done: true }>;
};

const storageKey = (userId: string) => `coreup.session.${userId}`;

export function readActiveSession(userId: string): SessionState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

function writeSession(userId: string, state: SessionState | null) {
  try {
    if (state) {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
    } else {
      window.localStorage.removeItem(storageKey(userId));
    }
  } catch {
    // Sem armazenamento local o treino continua funcionando, so nao sobrevive a recarga.
  }
}

function buildSession(day: WorkoutDay, logs: ApiWorkoutLog[]): SessionState {
  return {
    dayId: day.id,
    startedAt: Date.now(),
    exercises: day.exercises.map((item) => {
      const last = lastSetsFor(logs, item.exerciseId)?.sets ?? [];
      const count = Math.max(item.sets || 3, 1);

      return {
        exerciseId: item.exerciseId,
        sets: Array.from({ length: count }, (_, index) => {
          const previous = last[index] ?? last[last.length - 1];
          return {
            load: previous?.loadKg ? String(previous.loadKg).replace(".", ",") : "",
            reps: previous?.reps ? String(previous.reps) : "",
            done: false
          };
        })
      };
    })
  };
}

function parseNumber(value: string, max: number) {
  const parsed = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(parsed) && parsed >= 0 && parsed <= max ? parsed : undefined;
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function WorkoutSession({
  userId,
  day,
  byId,
  logs,
  onSave,
  onExit,
  onOpenExercise,
  onOpenProgress
}: {
  userId: string;
  day: WorkoutDay;
  byId: Map<number, Exercise>;
  logs: ApiWorkoutLog[];
  onSave: (payload: SessionPayload) => Promise<ApiWorkoutLog | null>;
  onExit: () => void;
  onOpenExercise: (exerciseId: number) => void;
  onOpenProgress: () => void;
}) {
  const [session, setSession] = useState<SessionState>(() => {
    const stored = readActiveSession(userId);
    return stored?.dayId === day.id ? stored : buildSession(day, logs);
  });
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [finished, setFinished] = useState<{ log: ApiWorkoutLog; records: Array<{ exerciseId: number; load: number }> } | null>(
    null
  );
  const previousLogs = useMemo(() => logs, [logs]);

  useEffect(() => {
    if (!finished) {
      writeSession(userId, session);
    }
  }, [finished, session, userId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const doneCount = session.exercises.reduce((total, item) => total + item.sets.filter((set) => set.done).length, 0);
  const totalCount = session.exercises.reduce((total, item) => total + item.sets.length, 0);

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetEntry>) {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((item, index) =>
        index === exerciseIndex
          ? { ...item, sets: item.sets.map((set, position) => (position === setIndex ? { ...set, ...patch } : set)) }
          : item
      )
    }));
  }

  function addSet(exerciseIndex: number) {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.map((item, index) => {
        if (index !== exerciseIndex) return item;
        const last = item.sets[item.sets.length - 1];
        return { ...item, sets: [...item.sets, { load: last?.load ?? "", reps: last?.reps ?? "", done: false }] };
      })
    }));
  }

  async function finish() {
    setError("");
    const sets = session.exercises.flatMap((item) =>
      item.sets
        .map((set, index) => ({ set, setNumber: index + 1 }))
        .filter(({ set }) => set.done)
        .map(({ set, setNumber }) => ({
          exerciseId: item.exerciseId,
          setNumber,
          reps: parseNumber(set.reps, 500) !== undefined ? Math.round(parseNumber(set.reps, 500)!) : undefined,
          loadKg: parseNumber(set.load, 1000),
          done: true as const
        }))
    );

    if (!sets.length) {
      setError("Marque pelo menos uma serie como feita para concluir o treino.");
      return;
    }

    setSaving(true);
    const log = await onSave({
      workoutId: day.id,
      title: day.focus,
      durationMin: Math.max(1, Math.round((Date.now() - session.startedAt) / 60000)),
      sets
    });
    setSaving(false);

    if (!log) {
      setError("Nao foi possivel salvar o treino. Seus dados continuam aqui; tente de novo.");
      return;
    }

    writeSession(userId, null);
    setFinished({ log, records: personalRecords(log.sets, previousLogs) });
    window.scrollTo({ top: 0 });
  }

  if (finished) {
    const volume = logVolume(finished.log);

    return (
      <section className="space-y-5">
        <div className="glass-strong rounded-2xl p-5 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent/15 text-accent">
            <Check size={28} strokeWidth={2.5} />
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Treino concluido!</h2>
          <p className="mt-1 text-sm text-white/55">{day.focus}</p>
          <div className="mt-5 grid grid-cols-3 divide-x divide-white/[0.07] rounded-xl border border-white/[0.07]">
            <Stat label="Tempo" value={`${finished.log.durationMin ?? 0} min`} />
            <Stat label="Series" value={String(finished.log.sets.length)} />
            <Stat label="Volume" value={volume ? formatKg(Math.round(volume)) : "--"} />
          </div>
        </div>

        {finished.records.length > 0 && (
          <section className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="text-accent" size={16} />
              {finished.records.length === 1 ? "Novo recorde de carga" : "Novos recordes de carga"}
            </h3>
            <ul className="mt-2 space-y-1.5">
              {finished.records.map((record) => (
                <li key={record.exerciseId} className="flex justify-between gap-3 text-sm">
                  <span className="text-white/80">{byId.get(record.exerciseId)?.nome}</span>
                  <span className="tabular-nums font-medium">{formatKg(record.load)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="space-y-2">
          <button className="btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold" onClick={onOpenProgress} type="button">
            Ver minha evolucao
            <ChevronRight size={18} />
          </button>
          <button className="h-11 w-full rounded-xl text-sm font-medium text-white/65 transition hover:text-white" onClick={onExit} type="button">
            Voltar ao inicio
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-accent">Treinando agora · {day.label}</p>
          <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight">{day.focus}</h2>
          <p className="mt-1 text-sm text-white/55">
            {doneCount} de {totalCount} series feitas
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm tabular-nums text-white/85">
          <Timer size={15} className="text-accent" />
          {formatElapsed(now - session.startedAt)}
        </span>
      </div>
      <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="bar-fill h-full rounded-full transition-all" style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }} />
      </div>

      {session.exercises.map((item, exerciseIndex) => {
        const exercise = byId.get(item.exerciseId);
        const plan = day.exercises.find((planned) => planned.exerciseId === item.exerciseId);
        const timed = plan ? isTimedPrescription(plan.reps) : false;
        const last = lastSetsFor(previousLogs, item.exerciseId);

        return (
          <article key={`${item.exerciseId}-${exerciseIndex}`} className="glass rounded-2xl p-4">
            <button className="block w-full text-left" onClick={() => onOpenExercise(item.exerciseId)} type="button">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[15px] font-semibold">{exercise?.nome}</span>
                <ChevronRight size={16} className="shrink-0 text-white/35" />
              </span>
              <span className="block text-xs text-white/50">
                Meta: {plan ? `${plan.sets} × ${plan.reps}` : "--"} · pausa {plan?.rest ?? "--"}
              </span>
            </button>
            {last && !timed && (
              <p className="mt-1 text-xs text-white/40">
                Ultima vez: {last.sets.map((set) => `${set.loadKg ? formatKg(set.loadKg) : "-"} × ${set.reps ?? "-"}`).join(" · ")}
              </p>
            )}

            <div className="mt-3 space-y-2">
              {!timed && (
                <div className="grid grid-cols-[2rem_1fr_1fr_2.75rem] gap-2 px-1 text-[11px] text-white/40">
                  <span>Serie</span>
                  <span>Carga (kg)</span>
                  <span>Reps</span>
                  <span className="text-center">Feita</span>
                </div>
              )}
              {item.sets.map((set, setIndex) => (
                <div
                  key={setIndex}
                  className={`grid items-center gap-2 rounded-xl px-1 py-1 transition ${
                    timed ? "grid-cols-[1fr_2.75rem]" : "grid-cols-[2rem_1fr_1fr_2.75rem]"
                  } ${set.done ? "bg-accent/[0.07]" : ""}`}
                >
                  {timed ? (
                    <span className="pl-2 text-sm text-white/75">
                      Serie {setIndex + 1} · {plan?.reps}
                    </span>
                  ) : (
                    <>
                      <span className="text-center text-sm tabular-nums text-white/50">{setIndex + 1}</span>
                      <input
                        aria-label={`Carga da serie ${setIndex + 1} de ${exercise?.nome}`}
                        className="glass-field h-10 w-full min-w-0 rounded-lg px-2.5 text-[15px] tabular-nums text-white outline-none placeholder:text-white/30"
                        inputMode="decimal"
                        onChange={(event) => updateSet(exerciseIndex, setIndex, { load: event.target.value.replace(/[^\d.,]/g, "").slice(0, 6) })}
                        placeholder="0"
                        value={set.load}
                      />
                      <input
                        aria-label={`Repeticoes da serie ${setIndex + 1} de ${exercise?.nome}`}
                        className="glass-field h-10 w-full min-w-0 rounded-lg px-2.5 text-[15px] tabular-nums text-white outline-none placeholder:text-white/30"
                        inputMode="numeric"
                        onChange={(event) => updateSet(exerciseIndex, setIndex, { reps: event.target.value.replace(/\D/g, "").slice(0, 3) })}
                        placeholder={plan?.reps.split("-")[0] ?? "0"}
                        value={set.reps}
                      />
                    </>
                  )}
                  <button
                    aria-label={`Marcar serie ${setIndex + 1} de ${exercise?.nome} como feita`}
                    aria-pressed={set.done}
                    className={`mx-auto grid size-10 place-items-center rounded-lg border transition ${
                      set.done ? "border-accent bg-accent text-on-accent" : "border-white/15 text-white/30 hover:border-white/30"
                    }`}
                    onClick={() => updateSet(exerciseIndex, setIndex, { done: !set.done })}
                    type="button"
                  >
                    <Check size={18} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="mt-2 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-white/60 transition hover:bg-white/[0.04] hover:text-white"
              onClick={() => addSet(exerciseIndex)}
              type="button"
            >
              <Plus size={15} />
              Adicionar serie
            </button>
          </article>
        );
      })}

      {error && (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      )}

      {confirmingDiscard ? (
        <ConfirmPanel
          busy={false}
          confirmLabel="Descartar"
          description="As series marcadas neste treino nao serao salvas."
          title="Descartar este treino?"
          onCancel={() => setConfirmingDiscard(false)}
          onConfirm={() => {
            writeSession(userId, null);
            onExit();
          }}
        />
      ) : (
        <div className="glass-nav sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-10 grid grid-cols-[auto_1fr] gap-2 rounded-2xl p-3">
          <button
            className="h-11 rounded-xl px-4 text-sm font-medium text-red-300/90 transition hover:bg-red-500/10"
            disabled={saving}
            onClick={() => setConfirmingDiscard(true)}
            type="button"
          >
            Descartar
          </button>
          <button
            className="btn-primary flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
            disabled={saving}
            onClick={() => void finish()}
            type="button"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
            Concluir treino
          </button>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-white/50">{label}</p>
    </div>
  );
}
