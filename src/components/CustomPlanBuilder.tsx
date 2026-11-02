"use client";

import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Exercise, WorkoutDay } from "@/types/fitness";
import {
  ExerciseListEditor,
  findInvalidExercise,
  toEditedExercises,
  type EditedExercise
} from "@/components/WorkoutEditor";
import { ConfirmPanel } from "@/components/ui/ConfirmPanel";

const weekLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

type CustomDay = { key: string; title: string; items: EditedExercise[] };

let nextKey = 0;
const newKey = () => `dia-${Date.now()}-${nextKey++}`;

const emptyDay = (): CustomDay => ({ key: newKey(), title: "", items: [] });

// Cada aba corresponde a um dia da semana pela posicao, entao dias sem treino viram abas vazias.
function fromSavedDays(savedDays: WorkoutDay[]): CustomDay[] {
  const lastIndex = Math.max(...savedDays.map((day) => weekLabels.indexOf(day.label)));

  return weekLabels.slice(0, lastIndex + 1).map((label) => {
    const saved = savedDays.find((day) => day.label === label);
    return saved ? { key: newKey(), title: saved.focus, items: toEditedExercises(saved.exercises) } : emptyDay();
  });
}

function estimateMinutes(items: EditedExercise[]) {
  const seconds = items.reduce((total, item) => total + (Number(item.sets) || 0) * (45 + (Number(item.rest) || 60)), 0);
  return Math.max(10, Math.round(seconds / 60 / 5) * 5);
}

export function CustomPlanBuilder({
  savedDays,
  exercises,
  byId,
  onSave
}: {
  savedDays: WorkoutDay[];
  exercises: Exercise[];
  byId: Map<number, Exercise>;
  onSave: (days: WorkoutDay[]) => Promise<string | null>;
}) {
  const hasSavedPlan = savedDays.length > 0;
  const [days, setDays] = useState<CustomDay[]>(() => (hasSavedPlan ? fromSavedDays(savedDays) : [emptyDay()]));
  const [loadedFromSaved, setLoadedFromSaved] = useState(hasSavedPlan);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [selectedKey, setSelectedKey] = useState(days[0].key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedIndex = Math.max(0, days.findIndex((day) => day.key === selectedKey));
  const selected = days[selectedIndex];
  const filledDays = days.filter((day) => day.items.length).length;
  const totalExercises = days.reduce((total, day) => total + day.items.length, 0);

  const updateSelected = (patch: Partial<CustomDay>) => {
    setError("");
    setDays((current) => current.map((day) => (day.key === selected.key ? { ...day, ...patch } : day)));
  };

  function addDay() {
    if (days.length >= weekLabels.length) {
      return;
    }

    const day = emptyDay();
    setDays((current) => [...current, day]);
    setSelectedKey(day.key);
    setError("");
  }

  const isLastDay = selectedIndex === days.length - 1;

  function removeSelected() {
    if (!isLastDay) {
      updateSelected({ title: "", items: [] });
      return;
    }

    setDays(days.slice(0, -1));
    setSelectedKey(days[selectedIndex - 1].key);
  }

  function startFromScratch() {
    const day = emptyDay();
    setDays([day]);
    setSelectedKey(day.key);
    setLoadedFromSaved(false);
    setConfirmingReset(false);
    setError("");
  }

  async function save() {
    setError("");

    const filled = days.map((day, index) => ({ ...day, label: weekLabels[index] })).filter((day) => day.items.length);

    if (!filled.length) {
      setError("Adicione pelo menos um exercicio em algum dia para salvar.");
      return;
    }

    for (const day of filled) {
      const invalid = day.items.length > 20 ? `O treino de ${day.label} tem ${day.items.length} exercicios. O limite e 20 por dia.` : findInvalidExercise(day.items, byId);

      if (invalid) {
        setSelectedKey(day.key);
        setError(invalid);
        return;
      }
    }

    setSaving(true);
    const message = await onSave(
      filled.map((day) => ({
        id: day.key,
        label: day.label,
        focus: day.title.trim().length >= 2 ? day.title.trim() : `Treino de ${day.label}`,
        duration: `${estimateMinutes(day.items)} min`,
        intensity: "Moderado",
        exercises: day.items.map((item) => ({
          exerciseId: item.exerciseId,
          sets: Number(item.sets),
          reps: item.reps.trim(),
          rest: Number(item.rest) > 0 ? `${Number(item.rest)}s` : "--",
          note: item.note
        }))
      }))
    );
    setSaving(false);

    if (message) {
      setError(message);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Monte do seu jeito</h2>
        <p className="mt-1 text-sm text-white/55">Crie os dias da semana e escolha exercicio por exercicio.</p>
      </div>

      {loadedFromSaved &&
        (confirmingReset ? (
          <ConfirmPanel
            busy={false}
            confirmLabel="Comecar do zero"
            description="Os dias e exercicios abaixo serao apagados desta montagem. Seu treino salvo so muda quando voce salvar."
            onCancel={() => setConfirmingReset(false)}
            onConfirm={startFromScratch}
            title="Comecar do zero?"
          />
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <p className="text-sm text-white/65">Carregamos o seu treino atual. Altere o que quiser.</p>
            <button
              className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-accent transition hover:bg-white/[0.05]"
              onClick={() => setConfirmingReset(true)}
              type="button"
            >
              Comecar do zero
            </button>
          </div>
        ))}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Dias do treino">
        {days.map((day, index) => {
          const active = day.key === selected.key;
          const complete = day.items.length > 0;

          return (
            <button
              key={day.key}
              aria-selected={active}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                active ? "chip-active" : "border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white"
              }`}
              onClick={() => setSelectedKey(day.key)}
              role="tab"
              type="button"
            >
              {weekLabels[index]}
              {complete && <Check size={14} className="text-accent" />}
            </button>
          );
        })}
        {days.length < 7 && (
          <button
            className="flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-white/15 px-3.5 py-2 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white"
            onClick={addDay}
            type="button"
          >
            <Plus size={15} />
            Dia
          </button>
        )}
      </div>

      <section className="space-y-4" role="tabpanel">
        <label className="block">
          <span className="mb-1.5 block text-xs text-white/55">Nome do treino</span>
          <input
            className="glass-field h-11 w-full rounded-xl px-3 text-[15px] text-white outline-none placeholder:text-white/35"
            maxLength={60}
            onChange={(event) => updateSelected({ title: event.target.value })}
            placeholder="Ex.: Peito e triceps"
            value={selected.title}
          />
        </label>

        <div className="space-y-3">
          <p className="text-xs text-white/55">
            Exercicios · {selected.items.length}
            {selected.items.length > 0 && ` · cerca de ${estimateMinutes(selected.items)} min`}
          </p>
          <ExerciseListEditor
            byId={byId}
            exercises={exercises}
            items={selected.items}
            onChange={(items) => updateSelected({ items })}
          />
        </div>

        {days.length > 1 && (isLastDay || selected.items.length > 0 || selected.title) && (
          <button
            className="-ml-2 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-red-300/90 transition hover:bg-red-500/10"
            onClick={removeSelected}
            type="button"
          >
            <Trash2 size={15} />
            {isLastDay ? "Remover" : "Limpar"} o dia {weekLabels[selectedIndex]}
          </button>
        )}
      </section>

      {error && (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      )}

      <div className="glass-nav sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-10 rounded-2xl p-3">
        <p className="mb-2 text-center text-xs text-white/50">
          {filledDays} {filledDays === 1 ? "dia" : "dias"} com treino · {totalExercises} {totalExercises === 1 ? "exercicio" : "exercicios"}
          {hasSavedPlan && " · substitui o treino atual"}
        </p>
        <button
          className="btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
          disabled={saving}
          onClick={() => void save()}
          type="button"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
          {saving ? "Salvando treino" : "Salvar treino"}
        </button>
      </div>
    </section>
  );
}
