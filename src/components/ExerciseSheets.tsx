"use client";

import { ExternalLink, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { bestLoadFor, formatKg, formatShortDate, type ApiWorkoutLog } from "@/lib/history";
import type { Exercise } from "@/types/fitness";

const safetyTips = [
  "Aqueca antes, com 1 ou 2 series leves do mesmo exercicio.",
  "Priorize a tecnica: so aumente a carga quando conseguir fazer todas as repeticoes com controle.",
  "Mantenha a coluna neutra e evite movimentos bruscos ou com impulso.",
  "Dor aguda ou nas articulacoes e sinal para parar. Na duvida, peca orientacao a um profissional."
];

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div aria-label={title} aria-modal="true" className="fixed inset-0 z-40 flex items-end justify-center" role="dialog">
      <button aria-label="Fechar" className="absolute inset-0 bg-black/60" onClick={onClose} tabIndex={-1} type="button" />
      <div className="relative flex max-h-[85dvh] w-full max-w-[430px] flex-col rounded-t-3xl border-t border-white/10 bg-[#121614] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          <button
            ref={closeRef}
            aria-label="Fechar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5">{children}</div>
      </div>
    </div>
  );
}

export function ExerciseSheet({
  exercise,
  logs,
  onClose
}: {
  exercise: Exercise;
  logs: ApiWorkoutLog[];
  onClose: () => void;
}) {
  const sessions = logs
    .map((log) => ({ date: log.performedAt, sets: log.sets.filter((set) => set.exerciseId === exercise.id && set.done) }))
    .filter((session) => session.sets.length)
    .slice(0, 3);
  const best = bestLoadFor(logs, exercise.id);
  const videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.nome} execucao correta`)}`;

  return (
    <BottomSheet title={exercise.nome} onClose={onClose}>
      <p className="text-sm text-white/55">
        {exercise.grupoMuscular} · {exercise.equipamento} · {exercise.nivel}
      </p>

      <a
        className="btn-primary mt-4 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
        href={videoUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        Ver como fazer
        <ExternalLink size={16} />
      </a>
      <p className="mt-1.5 text-center text-xs text-white/40">Abre videos deste exercicio no YouTube.</p>

      <section className="mt-5 border-t border-white/[0.07] pt-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-white/85">Seu historico</h3>
          {best > 0 && <span className="text-xs text-white/50">Melhor carga: {formatKg(best)}</span>}
        </div>
        {sessions.length ? (
          <ul className="mt-2 space-y-1.5">
            {sessions.map((session) => (
              <li key={session.date} className="flex justify-between gap-3 text-sm">
                <span className="text-white/50">{formatShortDate(session.date)}</span>
                <span className="text-right tabular-nums text-white/80">
                  {session.sets.map((set) => `${set.loadKg ? formatKg(set.loadKg) : "-"} × ${set.reps ?? "-"}`).join("  ·  ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-white/50">Voce ainda nao registrou este exercicio.</p>
        )}
      </section>

      <section className="mt-5 border-t border-white/[0.07] pb-2 pt-4">
        <h3 className="text-sm font-medium text-white/85">Cuidados gerais</h3>
        <ul className="mt-2 space-y-2 border-l border-white/10 pl-3">
          {safetyTips.map((tip) => (
            <li key={tip} className="text-xs leading-relaxed text-white/60">
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </BottomSheet>
  );
}

export function ExercisePicker({
  exercises,
  initialGroup,
  excludeIds,
  title,
  onPick,
  onClose
}: {
  exercises: Exercise[];
  initialGroup: string;
  excludeIds: number[];
  title: string;
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const groups = useMemo(() => ["Todos", ...Array.from(new Set(exercises.map((exercise) => exercise.grupoMuscular)))], [exercises]);
  const [group, setGroup] = useState(initialGroup);
  const [query, setQuery] = useState("");
  const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const results = exercises
    .filter((exercise) => !excludeIds.includes(exercise.id))
    .filter((exercise) => group === "Todos" || exercise.grupoMuscular === group)
    .filter((exercise) => normalize(exercise.nome).includes(normalize(query)));

  return (
    <BottomSheet title={title} onClose={onClose}>
      <label className="glass-field flex items-center gap-2 rounded-xl px-3 py-2.5">
        <Search size={16} className="text-white/40" />
        <input
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar exercicio"
          value={query}
        />
      </label>
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {groups.map((item) => (
          <button
            key={item}
            aria-pressed={item === group}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm transition ${
              item === group ? "chip-active" : "border-white/[0.08] text-white/60 hover:text-white"
            }`}
            onClick={() => setGroup(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <ul className="mt-2 divide-y divide-white/[0.07] pb-2">
        {results.map((exercise) => (
          <li key={exercise.id}>
            <button
              className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:opacity-80"
              onClick={() => onPick(exercise)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium">{exercise.nome}</span>
                <span className="block text-xs text-white/45">
                  {exercise.grupoMuscular} · {exercise.equipamento}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-accent">Escolher</span>
            </button>
          </li>
        ))}
        {!results.length && <li className="py-6 text-center text-sm text-white/50">Nenhum exercicio encontrado.</li>}
      </ul>
    </BottomSheet>
  );
}
