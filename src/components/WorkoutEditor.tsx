"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Exercise, WorkoutDay } from "@/types/fitness";
import { ExercisePicker } from "@/components/ExerciseSheets";

export type EditedExercise = {
  exerciseId: number;
  sets: string;
  reps: string;
  rest: string;
  note?: string;
};

export type EditorPayload = Array<{
  exerciseId: number;
  order: number;
  sets: number;
  reps: string;
  restSeconds?: number;
  notes?: string;
}>;

type PickerState = { mode: "replace"; index: number } | { mode: "add" } | null;

export function WorkoutEditor({
  day,
  exercises,
  byId,
  onCancel,
  onSave
}: {
  day: WorkoutDay;
  exercises: Exercise[];
  byId: Map<number, Exercise>;
  onCancel: () => void;
  onSave: (payload: EditorPayload) => Promise<string | null>;
}) {
  const [items, setItems] = useState<EditedExercise[]>(() =>
    day.exercises.map((item) => ({
      exerciseId: item.exerciseId,
      sets: String(item.sets || 3),
      reps: item.reps === "--" ? "" : item.reps,
      rest: String(Number.parseInt(item.rest, 10) || ""),
      note: item.note
    }))
  );
  const [picker, setPicker] = useState<PickerState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (index: number, patch: Partial<EditedExercise>) =>
    setItems((current) => current.map((item, position) => (position === index ? { ...item, ...patch } : item)));

  const move = (index: number, direction: -1 | 1) =>
    setItems((current) => {
      const next = [...current];
      const target = index + direction;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  async function save() {
    setError("");

    if (!items.length) {
      setError("O dia precisa ter pelo menos um exercicio. Para tirar o dia inteiro, use Remover dia.");
      return;
    }

    const invalid = items.findIndex((item) => {
      const sets = Number(item.sets);
      return !Number.isInteger(sets) || sets < 1 || sets > 10 || !item.reps.trim() || item.reps.length > 40;
    });

    if (invalid >= 0) {
      setError(`Confira ${byId.get(items[invalid].exerciseId)?.nome}: series de 1 a 10 e repeticoes preenchidas.`);
      return;
    }

    setSaving(true);
    const message = await onSave(
      items.map((item, index) => {
        const rest = Number(item.rest);
        return {
          exerciseId: item.exerciseId,
          order: index,
          sets: Number(item.sets),
          reps: item.reps.trim(),
          restSeconds: Number.isInteger(rest) && rest > 0 && rest <= 600 ? rest : undefined,
          notes: item.note
        };
      })
    );
    setSaving(false);

    if (message) {
      setError(message);
    }
  }

  const pickerTitle = picker?.mode === "replace" ? "Trocar exercicio" : "Adicionar exercicio";
  const pickerGroup =
    picker?.mode === "replace" ? byId.get(items[picker.index].exerciseId)?.grupoMuscular ?? "Todos" : "Todos";

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-medium text-accent">Editando · {day.label}</p>
        <h3 className="mt-1 text-xl font-semibold leading-tight tracking-tight">{day.focus}</h3>
        <p className="mt-1 text-sm text-white/55">Troque exercicios, ajuste series e mude a ordem.</p>
      </div>

      <ol className="space-y-3">
        {items.map((item, index) => {
          const exercise = byId.get(item.exerciseId);

          return (
            <li key={`${item.exerciseId}-${index}`} className="glass rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">
                    <span className="mr-2 tabular-nums text-white/35">{index + 1}</span>
                    {exercise?.nome}
                  </p>
                  <p className="text-xs text-white/45">
                    {exercise?.grupoMuscular} · {exercise?.equipamento}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconAction disabled={index === 0} label="Subir" onClick={() => move(index, -1)}>
                    <ArrowUp size={16} />
                  </IconAction>
                  <IconAction disabled={index === items.length - 1} label="Descer" onClick={() => move(index, 1)}>
                    <ArrowDown size={16} />
                  </IconAction>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Field label="Series" value={item.sets} inputMode="numeric" onChange={(sets) => update(index, { sets: sets.replace(/\D/g, "").slice(0, 2) })} />
                <Field label="Reps" value={item.reps} onChange={(reps) => update(index, { reps: reps.slice(0, 20) })} />
                <Field label="Pausa (s)" value={item.rest} inputMode="numeric" onChange={(rest) => update(index, { rest: rest.replace(/\D/g, "").slice(0, 3) })} />
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm text-white/80 transition hover:bg-white/[0.05]"
                  onClick={() => setPicker({ mode: "replace", index })}
                  type="button"
                >
                  <Repeat size={15} />
                  Trocar
                </button>
                <button
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-red-300/90 transition hover:bg-red-500/10"
                  onClick={() => setItems((current) => current.filter((_, position) => position !== index))}
                  type="button"
                >
                  <Trash2 size={15} />
                  Remover
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-sm font-medium text-white/75 transition hover:border-white/30 hover:text-white"
        onClick={() => setPicker({ mode: "add" })}
        type="button"
      >
        <Plus size={16} />
        Adicionar exercicio
      </button>

      {error && (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      )}

      <div className="glass-nav sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-10 grid grid-cols-2 gap-2 rounded-2xl p-3">
        <button
          className="h-11 rounded-xl border border-white/10 text-sm font-medium text-white/80 transition hover:bg-white/[0.05]"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="btn-primary flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
          disabled={saving}
          onClick={() => void save()}
          type="button"
        >
          {saving && <Loader2 className="animate-spin" size={16} />}
          Salvar dia
        </button>
      </div>

      {picker && (
        <ExercisePicker
          excludeIds={items.map((item) => item.exerciseId)}
          exercises={exercises}
          initialGroup={pickerGroup}
          title={pickerTitle}
          onClose={() => setPicker(null)}
          onPick={(exercise) => {
            if (picker.mode === "replace") {
              update(picker.index, { exerciseId: exercise.id, note: undefined });
            } else {
              const last = items[items.length - 1];
              setItems((current) => [
                ...current,
                { exerciseId: exercise.id, sets: last?.sets ?? "3", reps: last?.reps || "8-12", rest: last?.rest ?? "60" }
              ]);
            }
            setPicker(null);
          }}
        />
      )}
    </section>
  );
}

function IconAction({
  label,
  disabled,
  onClick,
  children
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  inputMode,
  onChange
}: {
  label: string;
  value: string;
  inputMode?: "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-white/45">{label}</span>
      <input
        className="glass-field h-10 w-full min-w-0 rounded-lg px-2.5 text-[15px] tabular-nums text-white outline-none"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}
