"use client";

import {
  Activity,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  Home,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Menu,
  Trash2,
  UserPlus,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { bodyStats, weeklyPlan } from "@/data/app-content";
import { exerciseMap, getTodayWorkout, summarizeGroups } from "@/lib/exercise-view";
import { generateWorkoutPlan, type GeneratorPreferences } from "@/lib/workout-generator";
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

type AuthMode = "login" | "register" | "recover";

type AuthForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  heightCm: string;
  weightKg: string;
};

const authStorageKey = "coreup.auth.token";

const tabs = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "plan", label: "Treino", icon: CalendarDays }
] as const;

type TabId = (typeof tabs)[number]["id"];

const defaultPreferences: GeneratorPreferences = {
  goal: "hipertrofia",
  level: "intermediario",
  planPreset: "ppl",
  daysPerWeek: 4,
  minutesPerSession: 50,
  availableEquipment: ["Academia"],
  favoriteExerciseIds: [1, 21, 101, 160]
};

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
  const [generatedPlan, setGeneratedPlan] = useState(() => generateWorkoutPlan(exercises, defaultPreferences));
  const [activeDayId, setActiveDayId] = useState(generatedPlan.days[0].id);

  const byId = useMemo(() => exerciseMap(exercises), [exercises]);
  const plan = generatedPlan.days.length ? generatedPlan.days : weeklyPlan;
  const todayWorkout = useMemo(() => getTodayWorkout(plan), [plan]);
  const selectedDay = plan.find((day) => day.id === activeDayId) ?? todayWorkout;
  const groupSummary = useMemo(() => summarizeGroups(exercises), [exercises]);

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

  function removeWorkoutDay(dayId: string) {
    const nextDays = generatedPlan.days.filter((day) => day.id !== dayId);
    setGeneratedPlan({ ...generatedPlan, days: nextDays });
    setActiveDayId(nextDays[0]?.id ?? weeklyPlan[0].id);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setAuthNotice("");

    if (authMode === "recover") {
      setAuthLoading(false);
      setAuthNotice("Se esse e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.");
      return;
    }

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

    window.localStorage.removeItem(authStorageKey);
    setAuthToken(null);
    setUser(null);
    setActiveTab("home");
  }

  if (checkingSession) {
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
          {activeTab === "home" && (
            <HomeView
              selectedWorkout={todayWorkout}
              byId={byId}
              groupSummary={groupSummary}
              generatedPlan={generatedPlan}
              onOpenPlan={() => setActiveTab("plan")}
            />
          )}
          {activeTab === "plan" && (
            <PlanView
              selectedDay={selectedDay}
              activeDayId={activeDayId}
              byId={byId}
              plan={plan}
              generatedPlan={generatedPlan}
              onSelectDay={setActiveDayId}
              onRemoveDay={removeWorkoutDay}
            />
          )}
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
  const isRecover = authMode === "recover";

  return (
    <div className="min-h-dvh bg-[#f5f4ef] px-4 py-6 text-stone-950">
      <main className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-[360px] flex-col justify-center">
        <section className="overflow-hidden rounded-[32px] bg-stone-950 p-5 text-white shadow-2xl shadow-stone-300/60">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">CoreUp</p>
              <h1 className="mt-2 text-3xl font-black">{isRecover ? "Recuperar senha" : isRegister ? "Criar conta" : "Entrar"}</h1>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
              {isRecover ? <KeyRound size={22} /> : isRegister ? <UserPlus size={22} /> : <UserRound size={22} />}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-1">
            <AuthModeButton active={authMode === "login"} label="Login" onClick={() => onModeChange("login")} />
            <AuthModeButton active={authMode === "register"} label="Cadastro" onClick={() => onModeChange("register")} />
            <AuthModeButton active={authMode === "recover"} label="Senha" onClick={() => onModeChange("recover")} />
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
            {!isRecover && (
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
            )}
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
              {isRecover ? "Enviar instrucoes" : isRegister ? "Criar e entrar" : "Entrar no app"}
            </button>
          </form>

          {!isRecover && (
            <p className="mt-5 text-xs font-semibold leading-relaxed text-white/50">
              A senha do cadastro precisa ter letra maiuscula, minuscula, numero, simbolo e pelo menos 8 caracteres.
            </p>
          )}
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
  selectedWorkout: WorkoutDay;
  byId: Map<number, Exercise>;
  groupSummary: Record<string, number>;
  generatedPlan: ReturnType<typeof generateWorkoutPlan>;
  onOpenPlan: () => void;
};

function HomeView({ selectedWorkout, byId, groupSummary, generatedPlan, onOpenPlan }: HomeViewProps) {
  const totalGroups = Object.keys(groupSummary).length;
  const weeklySets = Object.values(generatedPlan.coverage).reduce((total, amount) => total + amount, 0);

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
            <HeroMetric label="Foco" value={selectedWorkout.focus} />
            <HeroMetric label="Tempo" value={selectedWorkout.duration} />
            <HeroMetric label="Series" value={`${weeklySets}/sem`} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {bodyStats.map((stat) => (
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

      <TodayWorkout workout={selectedWorkout} byId={byId} notes={generatedPlan.notes} onOpenPlan={onOpenPlan} />

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


type PlanViewProps = {
  selectedDay: WorkoutDay;
  activeDayId: string;
  byId: Map<number, Exercise>;
  plan: WorkoutDay[];
  generatedPlan: ReturnType<typeof generateWorkoutPlan>;
  onSelectDay: (dayId: string) => void;
  onRemoveDay: (dayId: string) => void;
};

function PlanView({ selectedDay, activeDayId, byId, plan, generatedPlan, onSelectDay, onRemoveDay }: PlanViewProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-bold text-stone-500">Rotina semanal</p>
          <h2 className="text-3xl font-black">Treinos</h2>
        </div>
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
        <div className="mt-4">
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 text-sm font-black text-red-900"
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
          {generatedPlan.notes.map((note) => (
            <p key={note} className="text-sm font-semibold leading-relaxed text-stone-600">
              {note}
            </p>
          ))}
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
      <div className="grid grid-cols-2 gap-1">
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
