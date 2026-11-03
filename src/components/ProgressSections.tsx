"use client";

import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  exercisesWithLoad,
  formatKg,
  formatLongDate,
  formatShortDate,
  lastDays,
  loadSeriesFor,
  logTitle,
  logVolume,
  monthCount,
  weekStreak,
  type ApiBodyMetric,
  type ApiWorkoutLog
} from "@/lib/history";
import type { Exercise } from "@/types/fitness";
import { ConfirmPanel } from "@/components/ui/ConfirmPanel";
import { LineChart } from "@/components/ui/LineChart";

export function TrainingSummary({ logs }: { logs: ApiWorkoutLog[] }) {
  const days = lastDays(logs);
  const trainedDays = days.filter((day) => day.trained).length;
  const streak = weekStreak(logs);
  const stats = [
    { label: "Treinos no mês", value: monthCount(logs) },
    { label: streak === 1 ? "Semana seguida" : "Semanas seguidas", value: streak },
    { label: "Treinos no total", value: logs.length }
  ];

  return (
    <section className="glass-strong rounded-2xl p-5">
      <p className="text-xs font-medium text-accent">Seus treinos</p>
      <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.07]">
        {stats.map((stat) => (
          <div key={stat.label} className="px-2 first:pl-0">
            <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            <p className="text-xs leading-tight text-white/50">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <p className="text-xs text-white/50">Últimos 28 dias</p>
        <p className="text-xs tabular-nums text-white/50">
          {trainedDays} {trainedDays === 1 ? "dia" : "dias"} com treino
        </p>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5" role="list" aria-label="Dias com treino nos últimos 28 dias">
        {days.map((day) => (
          <span
            key={day.date.toISOString()}
            aria-label={`${formatLongDate(day.date)}: ${day.trained ? "treinou" : "sem treino"}`}
            className={`h-6 rounded-[4px] ${day.trained ? "bg-accent" : "bg-white/[0.06]"}`}
            role="listitem"
            title={`${formatShortDate(day.date)}${day.trained ? " · treinou" : ""}`}
          />
        ))}
      </div>
      {!logs.length && (
        <p className="mt-4 text-sm text-white/55">
          Comece um treino na aba Treino ou no Início e marque as séries feitas. Ele aparece aqui.
        </p>
      )}
    </section>
  );
}

export function LoadProgress({ logs, byId }: { logs: ApiWorkoutLog[]; byId: Map<number, Exercise> }) {
  const options = exercisesWithLoad(logs);
  const [selected, setSelected] = useState<number | null>(null);
  const exerciseId = selected !== null && options.includes(selected) ? selected : options[0];

  if (exerciseId === undefined) {
    return (
      <section className="border-t border-white/[0.07] pt-5">
        <h3 className="text-sm font-medium text-white/80">Evolução de carga</h3>
        <p className="mt-2 text-sm text-white/50">Registre a carga das séries durante o treino para acompanhar sua evolução.</p>
      </section>
    );
  }

  const series = loadSeriesFor(logs, exerciseId);

  return (
    <section className="border-t border-white/[0.07] pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white/80">Evolução de carga</h3>
        <label className="relative">
          <span className="sr-only">Exercício</span>
          <select
            className="glass-field h-9 max-w-[190px] appearance-none truncate rounded-lg pl-3 pr-8 text-sm text-white outline-none [&>option]:bg-[#161a18]"
            onChange={(event) => setSelected(Number(event.target.value))}
            value={exerciseId}
          >
            {options.map((id) => (
              <option key={id} value={id}>
                {byId.get(id)?.nome}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-white/50" size={16} />
        </label>
      </div>
      <p className="mb-2 mt-1 text-xs text-white/45">Maior carga usada em cada treino.</p>
      <LineChart
        formatValue={formatKg}
        points={series.map((point) => ({ label: formatShortDate(point.date), value: point.value }))}
        title={`Carga de ${byId.get(exerciseId)?.nome}`}
      />
      {series.length < 2 && <p className="mt-2 text-xs text-white/45">Mais um treino com este exercício e a linha aparece.</p>}
    </section>
  );
}

export function BodySection({
  metrics,
  currentWeight,
  heightCm,
  onAdd
}: {
  metrics: ApiBodyMetric[];
  currentWeight: number | null | undefined;
  heightCm: number | null | undefined;
  onAdd: (payload: { weightKg: number; bodyFat?: number }) => Promise<string | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const series = metrics
    .filter((metric) => metric.weightKg)
    .map((metric) => ({ label: formatShortDate(metric.measuredAt), value: metric.weightKg! }))
    .reverse();
  const latestFat = metrics.find((metric) => metric.bodyFat !== null)?.bodyFat;
  const bmi = currentWeight && heightCm ? currentWeight / (heightCm / 100) ** 2 : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const weightKg = Number(weight.replace(",", "."));
    const fat = bodyFat.trim() ? Number(bodyFat.replace(",", ".")) : undefined;

    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
      setError("Informe um peso entre 20 e 400 kg.");
      return;
    }

    if (fat !== undefined && (!Number.isFinite(fat) || fat < 2 || fat > 70)) {
      setError("O percentual de gordura deve ficar entre 2 e 70.");
      return;
    }

    setSaving(true);
    const message = await onAdd({ weightKg, bodyFat: fat });
    setSaving(false);

    if (message) {
      setError(message);
      return;
    }

    setWeight("");
    setBodyFat("");
    setAdding(false);
  }

  return (
    <section className="border-t border-white/[0.07] pt-5">
      <h3 className="text-sm font-medium text-white/80">Corpo</h3>
      <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.07] rounded-xl border border-white/[0.07]">
        <BodyStat label="Peso" value={currentWeight ? formatKg(currentWeight) : "--"} />
        <BodyStat label="Altura" value={heightCm ? `${(heightCm / 100).toFixed(2).replace(".", ",")} m` : "--"} />
        <BodyStat label={latestFat ? "Gordura" : "IMC"} value={latestFat ? `${latestFat}%` : bmi ? bmi.toFixed(1).replace(".", ",") : "--"} />
      </div>

      {series.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-white/45">Peso ao longo do tempo</p>
          <LineChart formatValue={formatKg} points={series} title="Peso ao longo do tempo" />
        </div>
      )}

      {adding ? (
        <form className="mt-4 space-y-3 rounded-xl border border-white/[0.08] p-4" onSubmit={submit}>
          <p className="text-sm font-medium">Registrar medida de hoje</p>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Peso (kg)" value={weight} onChange={setWeight} placeholder="Ex.: 72,5" />
            <NumberInput label="Gordura (%)" value={bodyFat} onChange={setBodyFat} placeholder="Opcional" />
          </div>
          {error && (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              className="h-10 rounded-xl border border-white/10 text-sm font-medium text-white/80 transition hover:bg-white/[0.05]"
              onClick={() => {
                setAdding(false);
                setError("");
              }}
              type="button"
            >
              Cancelar
            </button>
            <button className="btn-primary flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold" disabled={saving} type="submit">
              {saving && <Loader2 className="animate-spin" size={16} />}
              Salvar
            </button>
          </div>
        </form>
      ) : (
        <button
          className="mt-3 h-10 w-full rounded-xl border border-white/10 text-sm font-medium text-white/85 transition hover:bg-white/[0.05]"
          onClick={() => setAdding(true)}
          type="button"
        >
          Registrar peso
        </button>
      )}
    </section>
  );
}

export function HistoryList({
  logs,
  byId,
  onDelete
}: {
  logs: ApiWorkoutLog[];
  byId: Map<number, Exercise>;
  onDelete: (logId: string) => Promise<boolean>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? logs : logs.slice(0, 5);

  if (!logs.length) {
    return null;
  }

  return (
    <section className="border-t border-white/[0.07] pt-5">
      <h3 className="text-sm font-medium text-white/80">Histórico</h3>
      <ul className="mt-2 divide-y divide-white/[0.07]">
        {visible.map((log) => {
          const open = openId === log.id;
          const volume = logVolume(log);
          const grouped = new Map<number, typeof log.sets>();
          log.sets.forEach((set) => grouped.set(set.exerciseId, [...(grouped.get(set.exerciseId) ?? []), set]));

          return (
            <li key={log.id} className="py-3">
              <button
                aria-expanded={open}
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => setOpenId(open ? null : log.id)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{logTitle(log)}</span>
                  <span className="block text-xs text-white/45">
                    {formatLongDate(log.performedAt)} · {log.durationMin ?? "--"} min · {log.sets.length} séries
                    {volume ? ` · ${formatKg(Math.round(volume))}` : ""}
                  </span>
                </span>
                <ChevronDown className={`mt-1 shrink-0 text-white/40 transition ${open ? "rotate-180" : ""}`} size={16} />
              </button>

              {open && (
                <div className="mt-3 space-y-2 pl-1">
                  {[...grouped.entries()].map(([exerciseId, sets]) => (
                    <p key={exerciseId} className="flex justify-between gap-3 text-sm">
                      <span className="truncate text-white/75">{byId.get(exerciseId)?.nome ?? "Exercício"}</span>
                      <span className="shrink-0 tabular-nums text-white/50">
                        {sets.map((set) => (set.loadKg ? `${set.loadKg}×${set.reps ?? "-"}` : set.reps ? `${set.reps}` : "ok")).join(" · ")}
                      </span>
                    </p>
                  ))}
                  {confirmId === log.id ? (
                    <ConfirmPanel
                      busy={deleting}
                      confirmLabel="Apagar"
                      description="Este treino sai do histórico e das estatísticas."
                      title="Apagar este registro?"
                      onCancel={() => setConfirmId(null)}
                      onConfirm={async () => {
                        setDeleting(true);
                        await onDelete(log.id);
                        setDeleting(false);
                        setConfirmId(null);
                      }}
                    />
                  ) : (
                    <button
                      className="-ml-2 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-red-300/90 transition hover:bg-red-500/10"
                      onClick={() => setConfirmId(log.id)}
                      type="button"
                    >
                      <Trash2 size={15} />
                      Apagar registro
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {logs.length > 5 && (
        <button
          className="mt-1 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-white/70 transition hover:bg-white/[0.04] hover:text-white"
          onClick={() => setShowAll((value) => !value)}
          type="button"
        >
          {showAll ? "Mostrar menos" : `Ver todos (${logs.length})`}
          <ChevronDown className={showAll ? "rotate-180" : ""} size={16} />
        </button>
      )}
    </section>
  );
}

function BodyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-white/50">{label}</p>
    </div>
  );
}

function NumberInput({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/55">{label}</span>
      <input
        className="glass-field h-10 w-full rounded-lg px-3 text-[15px] tabular-nums text-white outline-none placeholder:text-white/30"
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
