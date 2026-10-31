"use client";

import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Lightbulb, Loader2, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { reviewableWorkouts, type ReviewableWorkout } from "@/data/reviewable-workouts";
import { apiFetch, canReviewWorkouts, type AuthUser } from "@/lib/api-client";
import { ProfessionalStatusCard } from "@/components/ProfessionalStatus";
import { generateWorkoutPlan, generatorOptions, type TrainingGoal, type TrainingLevel } from "@/lib/workout-generator";
import type { Exercise, WorkoutDay } from "@/types/fitness";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";

type ApiReview = {
  id: string;
  workoutKey: string;
  rating: number;
  comment: string;
  strengths: string[];
  limitations: string[];
  recommendations: string[];
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
  professional: {
    name: string;
    specialty: string;
    crefNumber: string;
    crefState: string;
    role: "PROFESSIONAL" | "ADMIN";
  };
};

type CatalogWorkout = ReviewableWorkout & {
  days: WorkoutDay[];
  exerciseCount: number;
  reviews: ApiReview[];
  average: number | null;
};

type RatingFilter = "todas" | "4" | "5";

const goalLabels = Object.fromEntries(generatorOptions.goals.map((goal) => [goal.id, goal.label])) as Record<
  TrainingGoal,
  string
>;
const levelLabels = Object.fromEntries(generatorOptions.levels.map((level) => [level.id, level.label])) as Record<
  TrainingLevel,
  string
>;

const ratingOptions: Array<{ id: RatingFilter; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "4", label: "4+ estrelas" },
  { id: "5", label: "5 estrelas" }
];

function formatAverage(value: number) {
  return value.toFixed(1).replace(".", ",");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function ProfessionalReviewsView({
  exercises,
  authToken,
  user
}: {
  exercises: Exercise[];
  authToken: string;
  user: AuthUser;
}) {
  const isProfessional = canReviewWorkouts(user);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [goalFilter, setGoalFilter] = useState<TrainingGoal | "todos">("todos");
  const [levelFilter, setLevelFilter] = useState<TrainingLevel | "todos">("todos");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("todas");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch(authToken, "/api/reviews")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error();
        }

        const data = (await response.json()) as { reviews: ApiReview[] };

        if (!cancelled) {
          setReviews(data.reviews);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Nao foi possivel carregar as avaliacoes. Tente novamente.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const generated = useMemo(
    () =>
      reviewableWorkouts.map((workout) => {
        const plan = generateWorkoutPlan(exercises, {
          goal: workout.goal,
          level: workout.level,
          planPreset: workout.preset,
          daysPerWeek: workout.daysPerWeek,
          minutesPerSession: workout.minutesPerSession,
          availableEquipment: ["Academia"],
          favoriteExerciseIds: []
        });

        return {
          ...workout,
          days: plan.days,
          exerciseCount: plan.days.reduce((total, day) => total + day.exercises.length, 0)
        };
      }),
    [exercises]
  );

  const catalog = useMemo<CatalogWorkout[]>(
    () =>
      generated.map((workout) => {
        const workoutReviews = reviews.filter((review) => review.workoutKey === workout.key);
        const average = workoutReviews.length
          ? workoutReviews.reduce((total, review) => total + review.rating, 0) / workoutReviews.length
          : null;

        return { ...workout, reviews: workoutReviews, average };
      }),
    [generated, reviews]
  );

  const visible = catalog.filter((workout) => isProfessional || workout.reviews.length > 0);
  const filtered = visible.filter(
    (workout) =>
      (goalFilter === "todos" || workout.goal === goalFilter) &&
      (levelFilter === "todos" || workout.level === levelFilter) &&
      (ratingFilter === "todas" || (workout.average !== null && workout.average >= Number(ratingFilter)))
  );
  const hasFilters = goalFilter !== "todos" || levelFilter !== "todos" || ratingFilter !== "todas";
  const selected = catalog.find((workout) => workout.key === selectedKey) ?? null;
  const myReviewCount = reviews.filter((review) => review.isMine).length;

  function openWorkout(key: string | null) {
    setSelectedKey(key);
    window.scrollTo({ top: 0 });
  }

  function clearFilters() {
    setGoalFilter("todos");
    setLevelFilter("todos");
    setRatingFilter("todas");
  }

  function handleSaved(review: ApiReview) {
    setReviews((current) => [review, ...current.filter((item) => item.id !== review.id)]);
  }

  function handleDeleted(workoutKey: string) {
    setReviews((current) => current.filter((item) => !(item.isMine && item.workoutKey === workoutKey)));
  }

  if (selected) {
    return (
      <WorkoutReviewDetail
        authToken={authToken}
        isProfessional={isProfessional}
        workout={selected}
        onBack={() => openWorkout(null)}
        onDeleted={handleDeleted}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-white/45">Treinos avaliados</p>
        <h2 className="text-2xl font-semibold tracking-tight">Avaliacao Profissional</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/55">
          {isProfessional
            ? "Avalie os treinos do app com a sua experiencia profissional. Sua avaliacao aparece para todos os usuarios."
            : "Veja o que profissionais de educacao fisica acham dos treinos do app antes de escolher o seu."}
        </p>
        {isProfessional && (
          <p className="mt-2 text-xs text-accent">
            Voce avaliou {myReviewCount} de {reviewableWorkouts.length} treinos.
          </p>
        )}
      </div>

      {!isProfessional && user.professional && user.professional.status !== "APPROVED" && (
        <ProfessionalStatusCard professional={user.professional} />
      )}

      <div className="space-y-3">
        <FilterRow label="Objetivo">
          <FilterChip active={goalFilter === "todos"} label="Todos" onClick={() => setGoalFilter("todos")} />
          {generatorOptions.goals.map((goal) => (
            <FilterChip
              key={goal.id}
              active={goalFilter === goal.id}
              label={goal.label}
              onClick={() => setGoalFilter(goal.id)}
            />
          ))}
        </FilterRow>
        <FilterRow label="Nivel">
          <FilterChip active={levelFilter === "todos"} label="Todos" onClick={() => setLevelFilter("todos")} />
          {generatorOptions.levels.map((level) => (
            <FilterChip
              key={level.id}
              active={levelFilter === level.id}
              label={level.label}
              onClick={() => setLevelFilter(level.id)}
            />
          ))}
        </FilterRow>
        <FilterRow label="Nota media">
          {ratingOptions.map((option) => (
            <FilterChip
              key={option.id}
              active={ratingFilter === option.id}
              label={option.label}
              onClick={() => setRatingFilter(option.id)}
            />
          ))}
        </FilterRow>
      </div>

      <div className="flex items-baseline justify-between border-t border-white/[0.07] pt-4">
        <p className="text-sm text-white/55">
          {loading ? "Carregando avaliacoes" : `${filtered.length} ${filtered.length === 1 ? "treino" : "treinos"}`}
        </p>
        {hasFilters && (
          <button className="text-sm text-white/70 underline underline-offset-4 hover:text-white" onClick={clearFilters} type="button">
            Limpar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-white/55">
          <Loader2 className="animate-spin text-accent" size={16} />
          Carregando avaliacoes
        </div>
      ) : loadError ? (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
          {loadError}
        </p>
      ) : filtered.length ? (
        <ul className="space-y-3">
          {filtered.map((workout) => (
            <li key={workout.key}>
              <WorkoutCard isProfessional={isProfessional} workout={workout} onOpen={() => openWorkout(workout.key)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] p-5 text-center">
          {visible.length ? (
            <>
              <p className="text-sm font-medium">Nenhum treino com esses filtros</p>
              <p className="mt-1 text-sm text-white/55">Tente outro objetivo, nivel ou nota.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Nenhum treino avaliado ainda</p>
              <p className="mt-1 text-sm text-white/55">
                Quando profissionais de educacao fisica avaliarem os treinos do app, as avaliacoes aparecem aqui.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-white/45">{label}</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{children}</div>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active ? "chip-active" : "border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function WorkoutCard({
  workout,
  isProfessional,
  onOpen
}: {
  workout: CatalogWorkout;
  isProfessional: boolean;
  onOpen: () => void;
}) {
  const latest = workout.reviews[0];
  const mine = workout.reviews.some((review) => review.isMine);

  return (
    <button
      className="glass w-full rounded-2xl p-4 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug">{workout.name}</h3>
          <p className="mt-0.5 text-xs text-white/50">
            {goalLabels[workout.goal]} · {levelLabels[workout.level]} · {workout.exerciseCount} exercicios
          </p>
        </div>
        <ChevronRight size={18} className="mt-0.5 shrink-0 text-white/35" />
      </div>

      {workout.average !== null && latest ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <Stars rating={Math.round(workout.average)} />
            <span className="text-sm font-medium tabular-nums">{formatAverage(workout.average)}</span>
            <span className="text-xs text-white/45">
              {workout.reviews.length} {workout.reviews.length === 1 ? "avaliacao" : "avaliacoes"}
            </span>
            {mine && <span className="ml-auto text-xs text-accent">Voce avaliou</span>}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/65">{latest.comment}</p>
          <ProfessionalLine professional={latest.professional} />
        </>
      ) : (
        <p className="mt-3 text-sm text-white/50">
          Ainda sem avaliacao.{isProfessional && <span className="text-accent"> Seja o primeiro a avaliar.</span>}
        </p>
      )}
    </button>
  );
}

function ProfessionalLine({ professional }: { professional: ApiReview["professional"] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/[0.07] pt-3">
      <span className="text-sm font-medium">{professional.name}</span>
      <span className="text-xs text-white/45">{professional.specialty}</span>
      <RoleBadge role={professional.role} />
    </div>
  );
}

function RoleBadge({ role }: { role: ApiReview["professional"]["role"] }) {
  return <Badge tone={role === "PROFESSIONAL" ? "green" : "muted"}>{role === "PROFESSIONAL" ? "CREF aprovado" : "Administrador"}</Badge>;
}

function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  return (
    <span aria-label={`Nota ${rating} de 5`} className="flex items-center gap-0.5" role="img">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          className={value <= rating ? "text-accent" : "text-white/20"}
          fill={value <= rating ? "currentColor" : "none"}
          size={size}
        />
      ))}
    </span>
  );
}

function WorkoutReviewDetail({
  workout,
  authToken,
  isProfessional,
  onBack,
  onSaved,
  onDeleted
}: {
  workout: CatalogWorkout;
  authToken: string;
  isProfessional: boolean;
  onBack: () => void;
  onSaved: (review: ApiReview) => void;
  onDeleted: (workoutKey: string) => void;
}) {
  const myReview = workout.reviews.find((review) => review.isMine) ?? null;
  const [editing, setEditing] = useState(false);

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <IconButton label="Voltar para a lista" onClick={onBack}>
          <ChevronLeft size={20} />
        </IconButton>
        <p className="text-sm text-white/55">Avaliacao Profissional</p>
      </div>

      <section className="glass-strong rounded-2xl p-5">
        <p className="text-xs font-medium text-accent">
          {goalLabels[workout.goal]} · {levelLabels[workout.level]}
        </p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{workout.name}</h2>
        <p className="mt-1 text-sm tabular-nums text-white/55">
          {workout.daysPerWeek} dias por semana · {workout.minutesPerSession} min · {workout.exerciseCount} exercicios
        </p>

        {workout.average !== null ? (
          <div className="mt-4 flex items-center gap-2">
            <Stars rating={Math.round(workout.average)} size={18} />
            <span className="text-base font-semibold tabular-nums">{formatAverage(workout.average)}</span>
            <span className="text-sm text-white/45">
              media de {workout.reviews.length} {workout.reviews.length === 1 ? "avaliacao" : "avaliacoes"}
            </span>
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/50">Este treino ainda nao foi avaliado.</p>
        )}

        {isProfessional && !editing && (
          <button
            className="btn-primary mt-5 flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold"
            onClick={() => setEditing(true)}
            type="button"
          >
            {myReview ? "Editar minha avaliacao" : "Avaliar este treino"}
          </button>
        )}
      </section>

      {isProfessional && editing && (
        <ReviewForm
          authToken={authToken}
          initial={myReview}
          workoutKey={workout.key}
          onCancel={() => setEditing(false)}
          onDeleted={() => {
            onDeleted(workout.key);
            setEditing(false);
          }}
          onSaved={(review) => {
            onSaved(review);
            setEditing(false);
          }}
        />
      )}

      {workout.reviews.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-white/80">
            {workout.reviews.length === 1 ? "Avaliacao" : `${workout.reviews.length} avaliacoes`}
          </h3>
          {workout.reviews.map((review) => (
            <ReviewArticle key={review.id} review={review} />
          ))}
        </section>
      )}

      <section className="border-t border-white/[0.07] pt-5">
        <h3 className="text-sm font-medium text-white/80">Treino avaliado</h3>
        <ul className="mt-3 divide-y divide-white/[0.07]">
          {workout.days.map((day) => (
            <li key={day.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="w-9 shrink-0 text-xs text-white/45">{day.label}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{day.focus}</span>
              <span className="shrink-0 text-xs tabular-nums text-white/45">{day.exercises.length} exercicios</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function ReviewArticle({ review }: { review: ApiReview }) {
  const { professional } = review;

  return (
    <article className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{professional.name}</span>
        <RoleBadge role={professional.role} />
        {review.isMine && <span className="text-xs text-accent">Sua avaliacao</span>}
      </div>
      <p className="mt-0.5 text-xs text-white/50">
        {professional.specialty}
        {professional.crefNumber && ` · CREF ${professional.crefNumber}/${professional.crefState}`}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Stars rating={review.rating} />
        <span className="text-sm font-medium tabular-nums">{review.rating},0</span>
        <span className="text-xs text-white/35">{formatDate(review.updatedAt)}</span>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-white/80">{review.comment}</p>

      <DetailList
        icon={<CircleCheck aria-hidden="true" className="text-accent" size={16} />}
        items={review.strengths}
        title="Pontos positivos"
      />
      <DetailList
        icon={<CircleAlert aria-hidden="true" className="text-white/45" size={16} />}
        items={review.limitations}
        title="Possiveis limitacoes"
      />
      <DetailList
        icon={<Lightbulb aria-hidden="true" className="text-white/45" size={16} />}
        items={review.recommendations}
        title="Recomendacoes"
      />
    </article>
  );
}

function DetailList({ icon, items, title }: { icon: ReactNode; items: string[]; title: string }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-white/[0.07] pt-3">
      <h4 className="text-xs font-medium text-white/60">{title}</h4>
      <ul className="mt-2 space-y-2">
        {items.map((text) => (
          <li key={text} className="flex gap-2.5 text-sm leading-relaxed text-white/70">
            <span className="mt-0.5 shrink-0">{icon}</span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function toLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function ReviewForm({
  authToken,
  workoutKey,
  initial,
  onCancel,
  onSaved,
  onDeleted
}: {
  authToken: string;
  workoutKey: string;
  initial: ApiReview | null;
  onCancel: () => void;
  onSaved: (review: ApiReview) => void;
  onDeleted: () => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [strengths, setStrengths] = useState(initial?.strengths.join("\n") ?? "");
  const [limitations, setLimitations] = useState(initial?.limitations.join("\n") ?? "");
  const [recommendations, setRecommendations] = useState(initial?.recommendations.join("\n") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!rating) {
      setError("Escolha uma nota de 1 a 5 estrelas.");
      return;
    }

    setSaving(true);

    try {
      const response = await apiFetch(authToken, `/api/reviews/${workoutKey}`, {
        method: "PUT",
        body: JSON.stringify({
          rating,
          comment,
          strengths: toLines(strengths),
          limitations: toLines(limitations),
          recommendations: toLines(recommendations)
        })
      });
      const data = (await response.json()) as { review?: ApiReview; error?: string; details?: Array<{ message: string }> };

      if (!response.ok || !data.review) {
        throw new Error(data.details?.[0]?.message ?? data.error ?? "Nao foi possivel salvar a avaliacao.");
      }

      onSaved(data.review);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel salvar a avaliacao.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError("");
    setSaving(true);

    try {
      const response = await apiFetch(authToken, `/api/reviews/${workoutKey}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error();
      }

      onDeleted();
    } catch {
      setError("Nao foi possivel remover a avaliacao.");
      setSaving(false);
    }
  }

  return (
    <form className="glass rounded-2xl p-5" onSubmit={handleSubmit}>
      <h3 className="text-base font-semibold">{initial ? "Editar minha avaliacao" : "Sua avaliacao"}</h3>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-white/85">Nota</legend>
        <div aria-label="Nota" className="mt-2 flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              aria-checked={rating === value}
              aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
              className="grid size-10 place-items-center rounded-lg transition hover:bg-white/[0.06]"
              onClick={() => setRating(value)}
              role="radio"
              type="button"
            >
              <Star
                aria-hidden="true"
                className={value <= rating ? "text-accent" : "text-white/25"}
                fill={value <= rating ? "currentColor" : "none"}
                size={24}
              />
            </button>
          ))}
        </div>
      </fieldset>

      <ReviewTextarea
        hint="Explique sua opiniao geral sobre o treino."
        label="Comentario"
        rows={4}
        value={comment}
        onChange={setComment}
      />
      <ReviewTextarea hint="Um item por linha." label="Pontos positivos" value={strengths} onChange={setStrengths} />
      <ReviewTextarea hint="Um item por linha." label="Possiveis limitacoes" value={limitations} onChange={setLimitations} />
      <ReviewTextarea
        hint="Um item por linha."
        label="Recomendacoes"
        value={recommendations}
        onChange={setRecommendations}
      />

      {error && (
        <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          className="h-11 rounded-xl border border-white/10 text-sm font-medium text-white/80 transition hover:bg-white/[0.05]"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="btn-primary flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
          disabled={saving}
          type="submit"
        >
          {saving && <Loader2 className="animate-spin" size={16} />}
          Salvar avaliacao
        </button>
      </div>

      {initial && (
        <button
          className="mt-3 -ml-2 flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-red-300/90 transition hover:bg-red-500/10"
          disabled={saving}
          onClick={handleDelete}
          type="button"
        >
          <Trash2 size={16} />
          Remover minha avaliacao
        </button>
      )}
    </form>
  );
}

function ReviewTextarea({
  label,
  hint,
  value,
  onChange,
  rows = 3
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="mt-4 block">
      <span className="block text-sm font-medium text-white/85">{label}</span>
      <span className="block text-xs text-white/45">{hint}</span>
      <textarea
        className="glass-field mt-2 block w-full resize-y rounded-xl px-3 py-2.5 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/35"
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
    </label>
  );
}
