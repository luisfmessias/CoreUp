"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Home,
  Library,
  Loader2,
  LogOut,
  Mail,
  Menu,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Timer,
  Trash2,
  UserPlus,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { exerciseMap, getTodayWorkout, summarizeGroups } from "@/lib/exercise-view";
import { toPlanDays, toWorkoutDay, type ApiWorkout } from "@/lib/plan-mapping";
import {
  buildPlanNotes,
  generateWorkoutPlan,
  generatorOptions,
  getEquipmentList,
  summarizePlanCoverage,
  type GeneratedPlan,
  type GeneratorPreferences
} from "@/lib/workout-generator";
import type { Exercise, WorkoutDay } from "@/types/fitness";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";

type CoreUpAppProps = {
  exercises: Exercise[];
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
  heightCm?: number | null;
  weightKg?: number | null;
};

type AuthMode = "login" | "register";

type AuthForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  heightCm: string;
  weightKg: string;
};

const authStorageKey = "coreup.auth.token";

const defaultPreferences: GeneratorPreferences = {
  goal: "hipertrofia",
  level: "intermediario",
  planPreset: "ppl",
  daysPerWeek: 4,
  minutesPerSession: 50,
  availableEquipment: ["Academia"],
  favoriteExerciseIds: []
};

function apiFetch(token: string, path: string, init: RequestInit = {}) {
  return fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  });
}

const tabs = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "builder", label: "Montar", icon: Sparkles },
  { id: "plan", label: "Treino", icon: CalendarDays },
  { id: "library", label: "Exerc.", icon: Library },
  { id: "progress", label: "Evol.", icon: BarChart3 }
] as const;

type TabId = (typeof tabs)[number]["id"];

export function CoreUpApp({ exercises }: CoreUpAppProps) {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState<AuthForm>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    heightCm: "",
    weightKg: ""
  });
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [preferences, setPreferences] = useState<GeneratorPreferences>(defaultPreferences);
  // Rascunho da aba Montar: muda ao vivo conforme as preferencias e so vai
  // para o banco quando o aluno confirma em "Usar esse plano".
  const [generatedPlan, setGeneratedPlan] = useState(() => generateWorkoutPlan(exercises, defaultPreferences));
  const [savedDays, setSavedDays] = useState<WorkoutDay[]>([]);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState("");
  const preferencesDirty = useRef(false);
  const [activeDayId, setActiveDayId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("Todos");

  const byId = useMemo(() => exerciseMap(exercises), [exercises]);
  const savedPlan = useMemo<GeneratedPlan>(() => {
    const coverage = summarizePlanCoverage(savedDays, exercises);
    return { days: savedDays, coverage, notes: buildPlanNotes(preferences, coverage) };
  }, [savedDays, exercises, preferences]);
  const plan = savedPlan.days;
  const todayWorkout = useMemo(() => (plan.length ? getTodayWorkout(plan) : null), [plan]);
  const selectedDay = plan.find((day) => day.id === activeDayId) ?? todayWorkout;
  const groupSummary = useMemo(() => summarizeGroups(exercises), [exercises]);
  const groups = useMemo(() => ["Todos", ...Object.keys(groupSummary)], [groupSummary]);
  const equipment = useMemo(() => getEquipmentList(exercises), [exercises]);
  const favoriteExercises = useMemo(
    () => exercises.filter((exercise) => preferences.favoriteExerciseIds.includes(exercise.id)).slice(0, 8),
    [exercises, preferences.favoriteExerciseIds]
  );

  useEffect(() => {
    const token = window.localStorage.getItem(authStorageKey);

    if (!token) {
      setCheckingSession(false);
      return;
    }

    fetch("/api/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Sessao expirada.");
        }

        const data = (await response.json()) as { user: AuthUser };
        setAuthToken(token);
        setUser(data.user);
      })
      .catch(() => {
        window.localStorage.removeItem(authStorageKey);
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    let cancelled = false;
    setPlanLoaded(false);
    setPlanError("");

    apiFetch(authToken, "/api/plan")
      .then(async (response) => {
        if (response.status === 401) {
          clearSession();
          return;
        }

        if (!response.ok) {
          throw new Error();
        }

        const data = (await response.json()) as { workouts: ApiWorkout[]; preferences: GeneratorPreferences | null };

        if (cancelled) {
          return;
        }

        const days = data.workouts.map(toWorkoutDay);
        const nextPreferences = data.preferences ?? defaultPreferences;
        setSavedDays(days);
        setActiveDayId(days[0]?.id ?? "");
        setPreferences(nextPreferences);
        setGeneratedPlan(generateWorkoutPlan(exercises, nextPreferences));
      })
      .catch(() => {
        if (!cancelled) {
          setPlanError("Nao foi possivel carregar seu treino. Tente recarregar a pagina.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPlanLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, exercises]);

  // Salva as preferencias do gerador com atraso, para nao disparar uma
  // requisicao a cada clique nos botoes de ajuste.
  useEffect(() => {
    if (!authToken || !preferencesDirty.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      preferencesDirty.current = false;
      apiFetch(authToken, "/api/preferences", {
        method: "PUT",
        body: JSON.stringify(preferences)
      }).catch(() => undefined);
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [authToken, preferences]);

  const filteredExercises = useMemo(() => {
    const term = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    return exercises
      .filter((exercise) => selectedGroup === "Todos" || exercise.grupoMuscular === selectedGroup)
      .filter((exercise) =>
        exercise.nome
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 18);
  }, [exercises, query, selectedGroup]);

  function updatePreferences(nextPreferences: GeneratorPreferences) {
    preferencesDirty.current = true;
    setPreferences(nextPreferences);
    setGeneratedPlan(generateWorkoutPlan(exercises, nextPreferences));
  }

  async function saveGeneratedPlan() {
    if (!authToken || !generatedPlan.days.length) {
      return;
    }

    setPlanSaving(true);
    setPlanError("");

    try {
      const response = await apiFetch(authToken, "/api/plan", {
        method: "PUT",
        body: JSON.stringify({ preferences, days: toPlanDays(generatedPlan.days) })
      });
      const data = (await response.json()) as { workouts?: ApiWorkout[]; error?: string };

      if (!response.ok || !data.workouts) {
        throw new Error(data.error ?? "Nao foi possivel salvar o plano.");
      }

      const days = data.workouts.map(toWorkoutDay);
      preferencesDirty.current = false;
      setSavedDays(days);
      setActiveDayId(days[0]?.id ?? "");
      setActiveTab("plan");
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Nao foi possivel salvar o plano.");
    } finally {
      setPlanSaving(false);
    }
  }

  async function removeWorkoutDay(dayId: string) {
    if (!authToken) {
      return;
    }

    setPlanError("");
    const response = await apiFetch(authToken, `/api/workouts/${dayId}`, { method: "DELETE" }).catch(() => null);

    // 404 significa que o treino ja nao existe no banco: basta tirar da tela.
    if (!response || (!response.ok && response.status !== 404)) {
      setPlanError("Nao foi possivel remover o treino.");
      return;
    }

    const nextDays = savedDays.filter((day) => day.id !== dayId);
    setSavedDays(nextDays);
    setActiveDayId(nextDays[0]?.id ?? "");
  }

  function toggleFavorite(exerciseId: number) {
    const nextFavoriteIds = preferences.favoriteExerciseIds.includes(exerciseId)
      ? preferences.favoriteExerciseIds.filter((id) => id !== exerciseId)
      : [...preferences.favoriteExerciseIds, exerciseId];

    updatePreferences({ ...preferences, favoriteExerciseIds: nextFavoriteIds });
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setAuthNotice("");

    const body =
      authMode === "login"
        ? {
            email: authForm.email,
            password: authForm.password
          }
        : {
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
            heightCm: parseOptionalNumber(authForm.heightCm),
            weightKg: parseOptionalNumber(authForm.weightKg)
          };

    try {
      if (authMode === "register" && authForm.password !== authForm.confirmPassword) {
        throw new Error("As senhas nao conferem.");
      }

      const response = await fetch(`/api/auth/${authMode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const data = (await response.json()) as { token?: string; user?: AuthUser; error?: string; details?: Array<{ message: string }> };

      if (!response.ok || !data.token || !data.user) {
        const detail = data.details?.[0]?.message;
        throw new Error(detail ?? data.error ?? "Nao foi possivel entrar.");
      }

      window.localStorage.setItem(authStorageKey, data.token);
      setAuthToken(data.token);
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "", confirmPassword: "", heightCm: "", weightKg: "" });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Nao foi possivel entrar.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    const token = authToken;

    if (token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }).catch(() => undefined);
    }

    clearSession();
  }

  // Zera tudo que pertence ao usuario, para o proximo login no mesmo
  // navegador nao herdar o plano ou as preferencias do anterior.
  function clearSession() {
    window.localStorage.removeItem(authStorageKey);
    preferencesDirty.current = false;
    setAuthToken(null);
    setUser(null);
    setActiveTab("home");
    setSavedDays([]);
    setActiveDayId("");
    setPlanError("");
    setPlanLoaded(false);
    setPreferences(defaultPreferences);
    setGeneratedPlan(generateWorkoutPlan(exercises, defaultPreferences));
  }

  if (checkingSession || (authToken && user && !planLoaded)) {
    return <LoadingScreen />;
  }

  if (!user || !authToken) {
    return (
      <AuthView
        authError={authError}
        authNotice={authNotice}
        authForm={authForm}
        authLoading={authLoading}
        authMode={authMode}
        showPassword={showPassword}
        onFormChange={setAuthForm}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError("");
          setAuthNotice("");
        }}
        onPasswordVisibilityChange={() => setShowPassword((visible) => !visible)}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[#f5f4ef] text-stone-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#f8f7f2] shadow-2xl shadow-stone-300/50 md:my-6 md:min-h-[900px] md:overflow-hidden md:rounded-[32px]">
        <AppHeader user={user} onLogout={handleLogout} />

        <main className="flex-1 overflow-hidden px-4 pb-24">
          {planError && (
            <p className="mb-4 rounded-2xl bg-red-100 px-4 py-3 text-sm font-bold text-red-900">{planError}</p>
          )}
          {activeTab === "home" && (
            <HomeView
              selectedWorkout={todayWorkout}
              byId={byId}
              groupSummary={groupSummary}
              savedPlan={savedPlan}
              onOpenPlan={() => setActiveTab("plan")}
              onOpenBuilder={() => setActiveTab("builder")}
            />
          )}
          {activeTab === "builder" && (
            <BuilderView
              exercises={exercises}
              equipment={equipment}
              favoriteExercises={favoriteExercises}
              preferences={preferences}
              generatedPlan={generatedPlan}
              saving={planSaving}
              onChange={updatePreferences}
              onFavoriteToggle={toggleFavorite}
              onOpenPlan={() => setActiveTab("plan")}
              onSavePlan={saveGeneratedPlan}
            />
          )}
          {activeTab === "plan" && (
            <PlanView
              selectedDay={selectedDay}
              activeDayId={activeDayId}
              byId={byId}
              plan={plan}
              savedPlan={savedPlan}
              onSelectDay={setActiveDayId}
              onOpenBuilder={() => setActiveTab("builder")}
              onRemoveDay={removeWorkoutDay}
            />
          )}
          {activeTab === "library" && (
            <LibraryView
              exercises={filteredExercises}
              groups={groups}
              selectedGroup={selectedGroup}
              query={query}
              favoriteExerciseIds={preferences.favoriteExerciseIds}
              onQueryChange={setQuery}
              onGroupChange={setSelectedGroup}
              onFavoriteToggle={toggleFavorite}
            />
          )}
          {activeTab === "progress" && <ProgressView savedPlan={savedPlan} user={user} />}
        </main>

        <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f5f4ef] text-stone-950">
      <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 text-sm font-black shadow-sm">
        <Loader2 size={19} className="animate-spin" />
        Abrindo CoreUp
      </div>
    </div>
  );
}

type AuthViewProps = {
  authError: string;
  authForm: AuthForm;
  authLoading: boolean;
  authMode: AuthMode;
  authNotice: string;
  showPassword: boolean;
  onFormChange: (form: AuthForm) => void;
  onModeChange: (mode: AuthMode) => void;
  onPasswordVisibilityChange: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function AuthView({
  authError,
  authForm,
  authLoading,
  authMode,
  authNotice,
  showPassword,
  onFormChange,
  onModeChange,
  onPasswordVisibilityChange,
  onSubmit
}: AuthViewProps) {
  const isRegister = authMode === "register";

  return (
    <div className="min-h-dvh bg-[#f5f4ef] px-4 py-6 text-stone-950">
      <main className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-[360px] flex-col justify-center">
        <section className="overflow-hidden rounded-[32px] bg-stone-950 p-5 text-white shadow-2xl shadow-stone-300/60">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">CoreUp</p>
              <h1 className="mt-2 text-3xl font-black">{isRegister ? "Criar conta" : "Entrar"}</h1>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
              {isRegister ? <UserPlus size={22} /> : <UserRound size={22} />}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/10 p-1">
            <AuthModeButton active={authMode === "login"} label="Login" onClick={() => onModeChange("login")} />
            <AuthModeButton active={authMode === "register"} label="Cadastro" onClick={() => onModeChange("register")} />
          </div>

          <form className="space-y-3" onSubmit={onSubmit}>
            {isRegister && (
              <AuthInput
                label="Nome"
                onChange={(name) => onFormChange({ ...authForm, name })}
                placeholder="Seu nome"
                value={authForm.name}
              />
            )}
            <AuthInput
              icon={<Mail size={18} />}
              label="E-mail"
              onChange={(email) => onFormChange({ ...authForm, email })}
              placeholder="voce@email.com"
              type="email"
              value={authForm.email}
            />
            <AuthInput
              label="Senha"
              onChange={(password) => onFormChange({ ...authForm, password })}
              placeholder={isRegister ? "8+ com numero e simbolo" : "Sua senha"}
              type={showPassword ? "text" : "password"}
              trailing={
                <button
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
                  onClick={onPasswordVisibilityChange}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
              value={authForm.password}
            />
            {isRegister && (
              <AuthInput
                label="Confirmar senha"
                onChange={(confirmPassword) => onFormChange({ ...authForm, confirmPassword })}
                placeholder="Repita sua senha"
                type={showPassword ? "text" : "password"}
                trailing={
                  <button
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
                    onClick={onPasswordVisibilityChange}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                value={authForm.confirmPassword}
              />
            )}
            {isRegister && (
              <div className="grid grid-cols-2 gap-3">
                <AuthInput
                  label="Altura"
                  onChange={(heightCm) => onFormChange({ ...authForm, heightCm })}
                  placeholder="cm"
                  type="number"
                  value={authForm.heightCm}
                />
                <AuthInput
                  label="Peso"
                  onChange={(weightKg) => onFormChange({ ...authForm, weightKg })}
                  placeholder="kg"
                  type="number"
                  value={authForm.weightKg}
                />
              </div>
            )}

            {authError && <p className="rounded-2xl bg-red-100 px-4 py-3 text-sm font-bold text-red-900">{authError}</p>}
            {authNotice && <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-950">{authNotice}</p>}

            <button
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 text-base font-black text-stone-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={authLoading}
              type="submit"
            >
              {authLoading && <Loader2 size={18} className="animate-spin" />}
              {isRegister ? "Criar e entrar" : "Entrar no app"}
            </button>
          </form>

          <p className="mt-5 text-xs font-semibold leading-relaxed text-white/50">
            A senha do cadastro precisa ter letra maiuscula, minuscula, numero, simbolo e pelo menos 8 caracteres.
          </p>
        </section>
      </main>
    </div>
  );
}

function AuthModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`h-10 rounded-xl text-sm font-black transition ${active ? "bg-white text-stone-950" : "text-white/55"}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function AuthInput({
  icon,
  label,
  onChange,
  placeholder,
  trailing,
  type = "text",
  value
}: {
  icon?: ReactNode;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  trailing?: ReactNode;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-white/45">{label}</span>
      <span className="flex h-13 items-center gap-3 rounded-2xl bg-white px-4 text-stone-950">
        {icon}
        <input
          className="min-w-0 flex-1 bg-transparent text-base font-bold outline-none placeholder:text-stone-400"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {trailing}
      </span>
    </label>
  );
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function AppHeader({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <header className="px-4 pb-3 pt-5">
      <div className="flex items-center justify-between">
        <IconButton label="Menu">
          <Menu size={20} />
        </IconButton>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">CoreUp</p>
          <h1 className="max-w-52 truncate text-lg font-black">{user.name}</h1>
        </div>
        <IconButton label="Sair" onClick={onLogout}>
          <LogOut size={20} />
        </IconButton>
      </div>
    </header>
  );
}

type HomeViewProps = {
  selectedWorkout: WorkoutDay | null;
  byId: Map<number, Exercise>;
  groupSummary: Record<string, number>;
  savedPlan: GeneratedPlan;
  onOpenPlan: () => void;
  onOpenBuilder: () => void;
};

function HomeView({ selectedWorkout, byId, groupSummary, savedPlan, onOpenPlan, onOpenBuilder }: HomeViewProps) {
  const totalGroups = Object.keys(groupSummary).length;
  const weeklySets = Object.values(savedPlan.coverage).reduce((total, amount) => total + amount, 0);
  const weeklyMinutes = savedPlan.days.reduce((total, day) => total + (Number.parseInt(day.duration, 10) || 0), 0);
  const planStats = [
    { label: "Treinos", value: String(savedPlan.days.length), helper: "por semana", icon: CalendarDays },
    {
      label: "Exercicios",
      value: String(savedPlan.days.reduce((total, day) => total + day.exercises.length, 0)),
      helper: "na semana",
      icon: Dumbbell
    },
    { label: "Tempo", value: String(weeklyMinutes), helper: "min/semana", icon: Timer },
    { label: "Grupos", value: String(Object.keys(savedPlan.coverage).length), helper: "trabalhados", icon: BarChart3 }
  ];

  return (
    <section className="space-y-4">
      <section className="relative overflow-hidden rounded-[28px] bg-stone-950 px-5 py-6 text-white">
        <div className="absolute right-[-56px] top-[-34px] size-44 rounded-full bg-emerald-400/20" />
        <div className="absolute bottom-[-58px] left-[-50px] size-36 rounded-full bg-sky-400/15" />
        <div className="relative space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge tone="green">Hoje</Badge>
              <h2 className="mt-4 max-w-[250px] text-4xl font-black leading-[0.95]">Treine com clareza.</h2>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <Activity size={24} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HeroMetric label="Foco" value={selectedWorkout?.focus ?? "--"} />
            <HeroMetric label="Tempo" value={selectedWorkout?.duration ?? "--"} />
            <HeroMetric label="Series" value={`${weeklySets}/sem`} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {planStats.map((stat) => (
          <article key={stat.label} className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-2xl bg-stone-100 text-stone-800">
                <stat.icon size={19} />
              </span>
              <span className="text-xs font-semibold text-stone-500">{stat.helper}</span>
            </div>
            <p className="mt-4 text-2xl font-black">{stat.value}</p>
            <p className="text-sm font-semibold text-stone-500">{stat.label}</p>
          </article>
        ))}
      </section>

      {selectedWorkout ? (
        <TodayWorkout workout={selectedWorkout} byId={byId} notes={savedPlan.notes} onOpenPlan={onOpenPlan} />
      ) : (
        <EmptyPlan onOpenBuilder={onOpenBuilder} />
      )}

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-stone-500">Biblioteca</p>
            <h3 className="text-xl font-black">{totalGroups} grupos musculares</h3>
          </div>
          <span className="grid size-11 place-items-center rounded-full bg-emerald-100 text-emerald-900">
            <Dumbbell size={20} />
          </span>
        </div>
        <GroupBars groupSummary={groupSummary} />
      </section>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-[11px] font-bold uppercase text-white/55">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-black">{value}</p>
    </div>
  );
}

function EmptyPlan({ onOpenBuilder }: { onOpenBuilder: () => void }) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-stone-500">Seu treino</p>
      <h3 className="text-xl font-black">Voce ainda nao tem um plano</h3>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-stone-500">
        Escolha objetivo, nivel e dias na aba Montar para gerar a sua semana de treino.
      </p>
      <button
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 text-sm font-black text-white"
        onClick={onOpenBuilder}
        type="button"
      >
        <Sparkles size={18} />
        Montar meu treino
      </button>
    </section>
  );
}

type TodayWorkoutProps = {
  workout: WorkoutDay;
  byId: Map<number, Exercise>;
  notes: string[];
  onOpenPlan: () => void;
};

function TodayWorkout({ workout, byId, notes, onOpenPlan }: TodayWorkoutProps) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-stone-500">Treino do dia</p>
          <h3 className="text-xl font-black">{workout.focus}</h3>
        </div>
        <button
          aria-label="Abrir treino"
          className="grid size-11 place-items-center rounded-full bg-stone-950 text-white"
          onClick={onOpenPlan}
          type="button"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {workout.exercises.slice(0, 3).map((item) => {
          const exercise = byId.get(item.exerciseId);

          return (
            <div key={item.exerciseId} className="flex items-center justify-between rounded-2xl bg-stone-50 p-3">
              <div>
                <p className="text-sm font-black">{exercise?.nome}</p>
                <p className="text-xs font-semibold text-stone-500">{exercise?.grupoMuscular}</p>
              </div>
              <p className="text-sm font-black text-stone-700">
                {item.sets} x {item.reps}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs font-semibold leading-relaxed text-stone-500">{notes[0]}</p>
    </section>
  );
}

type BuilderViewProps = {
  exercises: Exercise[];
  equipment: string[];
  favoriteExercises: Exercise[];
  preferences: GeneratorPreferences;
  generatedPlan: GeneratedPlan;
  saving: boolean;
  onChange: (preferences: GeneratorPreferences) => void;
  onFavoriteToggle: (exerciseId: number) => void;
  onOpenPlan: () => void;
  onSavePlan: () => void;
};

function BuilderView({
  exercises,
  equipment,
  favoriteExercises,
  preferences,
  generatedPlan,
  saving,
  onChange,
  onFavoriteToggle,
  onOpenPlan,
  onSavePlan
}: BuilderViewProps) {
  const suggestedFavorites = exercises
    .filter((exercise) => ["Peito", "Costas", "Quadríceps", "Glúteos", "Abdômen"].includes(exercise.grupoMuscular))
    .slice(0, 10);

  const update = (patch: Partial<GeneratorPreferences>) => onChange({ ...preferences, ...patch });

  const toggleEquipment = (item: string) => {
    const nextEquipment = preferences.availableEquipment.includes(item)
      ? preferences.availableEquipment.filter((equipmentItem) => equipmentItem !== item)
      : [...preferences.availableEquipment, item];

    update({ availableEquipment: nextEquipment.length ? nextEquipment : ["Peso corporal"] });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-stone-500">Gerador inteligente</p>
          <h2 className="text-3xl font-black">Montar treino</h2>
        </div>
        <IconButton label="Abrir plano" className="bg-stone-950 text-white hover:bg-stone-800" onClick={onOpenPlan}>
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <section className="rounded-[28px] bg-stone-950 p-4 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone="green">{generatedPlan.days.length} dias</Badge>
            <h3 className="mt-3 text-2xl font-black">Plano pronto para ajustar</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/65">
              O aluno escolhe o que prefere, e o app completa a semana para nao deixar grupos importantes de fora.
            </p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10">
            <Sparkles size={22} />
          </span>
        </div>
        <button
          className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 text-base font-black text-stone-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving || !generatedPlan.days.length}
          onClick={onSavePlan}
          type="button"
        >
          {saving ? <Loader2 size={19} className="animate-spin" /> : <Check size={19} />}
          {saving ? "Salvando plano" : "Usar esse plano"}
        </button>
        <p className="mt-2 text-center text-xs font-semibold text-white/50">
          Substitui o plano atual da aba Treino.
        </p>
      </section>

      <ControlBlock title="Catalogo">
        <div className="grid grid-cols-2 gap-2">
          {generatorOptions.presets.map((preset) => (
            <ChoiceButton
              key={preset.id}
              active={preferences.planPreset === preset.id}
              label={preset.label}
              onClick={() => update({ planPreset: preset.id })}
            />
          ))}
        </div>
      </ControlBlock>

      <ControlBlock title="Objetivo">
        <SegmentedGrid>
          {generatorOptions.goals.map((goal) => (
            <ChoiceButton
              key={goal.id}
              active={preferences.goal === goal.id}
              label={goal.label}
              onClick={() => update({ goal: goal.id })}
            />
          ))}
        </SegmentedGrid>
      </ControlBlock>

      <section className="grid grid-cols-2 gap-3">
        <ControlBlock title="Nivel">
          <div className="space-y-2">
            {generatorOptions.levels.map((level) => (
              <ChoiceButton
                key={level.id}
                active={preferences.level === level.id}
                label={level.label}
                onClick={() => update({ level: level.id })}
              />
            ))}
          </div>
        </ControlBlock>

        <ControlBlock title="Semana">
          <Stepper
            label="dias"
            max={5}
            min={2}
            value={preferences.daysPerWeek}
            onChange={(value) => update({ daysPerWeek: value })}
          />
          <div className="mt-3">
            <Stepper
              label="min"
              max={70}
              min={35}
              step={5}
              value={preferences.minutesPerSession}
              onChange={(value) => update({ minutesPerSession: value })}
            />
          </div>
        </ControlBlock>
      </section>

      <ControlBlock title="Equipamentos">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[...generatorOptions.equipment, ...equipment.filter((item) => !generatorOptions.equipment.includes(item))].map(
            (item) => (
              <button
                key={item}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${
                  preferences.availableEquipment.includes(item)
                    ? "border-stone-950 bg-stone-950 text-white"
                    : "border-stone-200 bg-stone-50 text-stone-600"
                }`}
                onClick={() => toggleEquipment(item)}
                type="button"
              >
                {item}
              </button>
            )
          )}
        </div>
      </ControlBlock>

      <ControlBlock title="Favoritos do aluno">
        <div className="space-y-2">
          {(favoriteExercises.length ? favoriteExercises : suggestedFavorites.slice(0, 5)).map((exercise) => (
            <FavoriteRow
              key={exercise.id}
              exercise={exercise}
              active={preferences.favoriteExerciseIds.includes(exercise.id)}
              onToggle={() => onFavoriteToggle(exercise.id)}
            />
          ))}
        </div>
      </ControlBlock>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-stone-500">Cobertura semanal</p>
            <h3 className="text-xl font-black">{Object.keys(generatedPlan.coverage).length} grupos no plano</h3>
          </div>
          <IconButton label="Recalcular" onClick={() => onChange({ ...preferences })}>
            <RotateCcw size={18} />
          </IconButton>
        </div>
        <GroupBars groupSummary={generatedPlan.coverage} />
        <div className="mt-4 space-y-2">
          {generatedPlan.notes.map((note) => (
            <p key={note} className="rounded-2xl bg-stone-50 p-3 text-xs font-semibold leading-relaxed text-stone-600">
              {note}
            </p>
          ))}
        </div>
      </section>
    </section>
  );
}

type PlanViewProps = {
  selectedDay: WorkoutDay | null;
  activeDayId: string;
  byId: Map<number, Exercise>;
  plan: WorkoutDay[];
  savedPlan: GeneratedPlan;
  onSelectDay: (dayId: string) => void;
  onOpenBuilder: () => void;
  onRemoveDay: (dayId: string) => void;
};

function PlanView({ selectedDay, activeDayId, byId, plan, savedPlan, onSelectDay, onOpenBuilder, onRemoveDay }: PlanViewProps) {
  if (!selectedDay) {
    return (
      <section className="space-y-4">
        <div>
          <p className="text-sm font-bold text-stone-500">Rotina semanal</p>
          <h2 className="text-3xl font-black">Treinos</h2>
        </div>
        <EmptyPlan onOpenBuilder={onOpenBuilder} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-bold text-stone-500">Rotina semanal</p>
          <h2 className="text-3xl font-black">Treinos</h2>
        </div>
        <IconButton label="Ajustar treino" className="bg-stone-950 text-white hover:bg-stone-800" onClick={onOpenBuilder}>
          <Plus size={20} />
        </IconButton>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {plan.map((day) => (
          <button
            key={day.id}
            className={`rounded-2xl px-2 py-3 text-sm font-black transition ${
              day.id === activeDayId ? "bg-stone-950 text-white" : "bg-white text-stone-500"
            }`}
            onClick={() => onSelectDay(day.id)}
            type="button"
          >
            {day.label}
          </button>
        ))}
      </div>

      <section className="rounded-[28px] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge tone={selectedDay.intensity === "Forte" ? "dark" : "blue"}>{selectedDay.intensity}</Badge>
            <h3 className="mt-3 text-2xl font-black">{selectedDay.focus}</h3>
            <p className="mt-1 text-sm font-semibold text-stone-500">{selectedDay.duration}</p>
          </div>
          <span className="grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-900">
            <Flame size={22} />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-3 text-sm font-black text-white"
            onClick={onOpenBuilder}
            type="button"
          >
            <Plus size={17} />
            Criar novo
          </button>
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 text-sm font-black text-red-900"
            onClick={() => onRemoveDay(selectedDay.id)}
            type="button"
          >
            <Trash2 size={17} />
            Descriar
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {selectedDay.exercises.map((item, index) => {
            const exercise = byId.get(item.exerciseId);

            return (
              <article key={`${selectedDay.id}-${item.exerciseId}`} className="rounded-3xl border border-stone-100 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-stone-950 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-base font-black">{exercise?.nome}</h4>
                    <p className="text-xs font-semibold text-stone-500">
                      {exercise?.equipamento} · {exercise?.grupoMuscular}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="Series" value={String(item.sets)} />
                  <MiniStat label="Reps" value={item.reps} />
                  <MiniStat label="Pausa" value={item.rest} />
                </div>
                {item.note && <p className="mt-2 text-xs font-bold text-emerald-700">{item.note}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-black">Por que esse treino fecha</h3>
        <div className="mt-3 space-y-2">
          {savedPlan.notes.map((note) => (
            <p key={note} className="text-sm font-semibold leading-relaxed text-stone-600">
              {note}
            </p>
          ))}
        </div>
      </section>
    </section>
  );
}

function LibraryView({
  exercises,
  groups,
  selectedGroup,
  query,
  favoriteExerciseIds,
  onQueryChange,
  onGroupChange,
  onFavoriteToggle
}: {
  exercises: Exercise[];
  groups: string[];
  selectedGroup: string;
  query: string;
  favoriteExerciseIds: number[];
  onQueryChange: (query: string) => void;
  onGroupChange: (group: string) => void;
  onFavoriteToggle: (exerciseId: number) => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-bold text-stone-500">Biblioteca</p>
        <h2 className="text-3xl font-black">Exercicios</h2>
      </div>

      <label className="flex items-center gap-3 rounded-3xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <Search size={20} className="text-stone-400" />
        <input
          className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-stone-400"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar exercicio"
          value={query}
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {groups.map((group) => (
          <button
            key={group}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              group === selectedGroup ? "bg-stone-950 text-white" : "bg-white text-stone-600"
            }`}
            onClick={() => onGroupChange(group)}
            type="button"
          >
            {group}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {exercises.map((exercise) => (
          <article key={exercise.id} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-stone-100 text-stone-700">
              <Dumbbell size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-black">{exercise.nome}</h3>
              <p className="text-xs font-semibold text-stone-500">
                {exercise.grupoMuscular} · {exercise.equipamento}
              </p>
            </div>
            <button
              aria-label={`Favoritar ${exercise.nome}`}
              className={`grid size-10 shrink-0 place-items-center rounded-full border transition ${
                favoriteExerciseIds.includes(exercise.id)
                  ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                  : "border-stone-200 bg-stone-50 text-stone-400"
              }`}
              onClick={() => onFavoriteToggle(exercise.id)}
              type="button"
            >
              <Heart size={17} fill={favoriteExerciseIds.includes(exercise.id) ? "currentColor" : "none"} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ControlBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-black text-stone-700">{title}</h3>
      {children}
    </section>
  );
}

function SegmentedGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function ChoiceButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-black transition ${
        active ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-stone-50 text-stone-600"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function Stepper({
  label,
  min,
  max,
  step = 1,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const change = (direction: number) => {
    onChange(Math.min(max, Math.max(min, value + direction * step)));
  };

  return (
    <div className="rounded-2xl bg-stone-50 p-3">
      <p className="text-xs font-bold uppercase text-stone-400">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          aria-label={`Reduzir ${label}`}
          className="grid size-9 place-items-center rounded-full bg-white text-lg font-black text-stone-700"
          onClick={() => change(-1)}
          type="button"
        >
          -
        </button>
        <p className="text-xl font-black">{value}</p>
        <button
          aria-label={`Aumentar ${label}`}
          className="grid size-9 place-items-center rounded-full bg-stone-950 text-lg font-black text-white"
          onClick={() => change(1)}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}

function FavoriteRow({
  exercise,
  active,
  onToggle
}: {
  exercise: Exercise;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-2xl bg-stone-50 p-3 text-left transition hover:bg-stone-100"
      onClick={onToggle}
      type="button"
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${
          active ? "bg-emerald-100 text-emerald-900" : "bg-white text-stone-400"
        }`}
      >
        <Check size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">{exercise.nome}</span>
        <span className="block text-xs font-semibold text-stone-500">
          {exercise.grupoMuscular} · {exercise.equipamento}
        </span>
      </span>
    </button>
  );
}

function ProgressView({ savedPlan, user }: { savedPlan: GeneratedPlan; user: AuthUser }) {
  const weeklySets = Object.values(savedPlan.coverage).reduce((total, amount) => total + amount, 0);
  const weight = user.weightKg ? `${user.weightKg} kg` : "-- kg";
  const height = user.heightCm ? `${(user.heightCm / 100).toFixed(2).replace(".", ",")} m` : "-- m";
  const setsPerDay = savedPlan.days.map((day) => ({
    id: day.id,
    label: day.label,
    sets: day.exercises.reduce((total, exercise) => total + exercise.sets, 0)
  }));
  const maxDaySets = Math.max(1, ...setsPerDay.map((day) => day.sets));

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-bold text-stone-500">Evolucao</p>
          <h2 className="text-3xl font-black">Progresso</h2>
        </div>
      </div>

      <section className="rounded-[28px] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-stone-500">Resumo fisico</p>
            <h3 className="text-2xl font-black">
              {weight} · {height}
            </h3>
          </div>
          <Badge tone="green">{weeklySets} series</Badge>
        </div>
        <p className="mt-5 text-xs font-bold uppercase text-stone-400">Series por dia do plano</p>
        {savedPlan.days.length ? (
          <div className="mt-2 flex items-end gap-2">
            {setsPerDay.map((day) => (
              <div key={day.id} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end rounded-full bg-stone-100 p-1">
                  <div className="w-full rounded-full bg-stone-950" style={{ height: `${(day.sets / maxDaySets) * 100}%` }} />
                </div>
                <span className="text-xs font-black">{day.sets}</span>
                <span className="text-[11px] font-bold text-stone-500">{day.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-stone-500">Monte um treino para ver a distribuicao da semana.</p>
        )}
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-black">Mapa muscular do treino</h3>
        <div className="mt-4">
          <GroupBars groupSummary={savedPlan.coverage} />
        </div>
      </section>
    </section>
  );
}

function GroupBars({ groupSummary }: { groupSummary: Record<string, number> }) {
  const entries = Object.entries(groupSummary).slice(0, 7);
  const max = Math.max(1, ...Object.values(groupSummary));

  return (
    <div className="space-y-3">
      {entries.length === 0 && <p className="text-sm font-semibold text-stone-500">Monte um treino para ver a cobertura.</p>}
      {entries.map(([group, amount]) => (
          <div key={group}>
            <div className="mb-1 flex justify-between text-xs font-bold text-stone-500">
              <span>{group}</span>
              <span>{amount}</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-stone-950" style={{ width: `${(amount / max) * 100}%` }} />
            </div>
          </div>
        ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 px-2 py-3">
      <p className="text-[11px] font-bold uppercase text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function BottomNavigation({ activeTab, onChange }: { activeTab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[430px] border-t border-stone-200 bg-white/90 px-3 pb-4 pt-2 backdrop-blur md:bottom-6 md:rounded-b-[32px]">
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition ${
              activeTab === tab.id ? "bg-stone-950 text-white" : "text-stone-500"
            }`}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            <tab.icon size={19} />
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
