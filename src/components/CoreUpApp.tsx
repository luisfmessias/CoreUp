"use client";

import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Heart,
  Home,
  Library,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Bell,
  Trash2,
  UserPlus,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { apiFetch, type AccountType, type AppNotification, type AuthUser } from "@/lib/api-client";
import { brazilianStates } from "@/lib/professional";
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
import { AdminRequestsView } from "@/components/AdminRequestsView";
import { NotificationsView } from "@/components/NotificationsView";
import { ProfessionalRequestForm, ProfessionalStatusCard } from "@/components/ProfessionalStatus";
import { ProfessionalReviewsView } from "@/components/ProfessionalReviewsView";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";

type CoreUpAppProps = {
  exercises: Exercise[];
};

type AuthMode = "login" | "register";

type AuthForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  heightCm: string;
  weightKg: string;
  acceptPrivacy: boolean;
  accountType: AccountType;
  crefNumber: string;
  crefState: string;
  specialty: string;
  education: string;
};

const emptyAuthForm: AuthForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  heightCm: "",
  weightKg: "",
  acceptPrivacy: false,
  accountType: "USER",
  crefNumber: "",
  crefState: "",
  specialty: "",
  education: ""
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

const tabs = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "builder", label: "Montar", icon: Sparkles },
  { id: "plan", label: "Treino", icon: CalendarDays },
  { id: "library", label: "Exerc.", icon: Library },
  { id: "reviews", label: "Aval.", icon: BadgeCheck },
  { id: "progress", label: "Evol.", icon: BarChart3 },
  { id: "admin", label: "Admin", icon: ShieldCheck }
] as const;

type NavTab = (typeof tabs)[number];
type TabId = NavTab["id"] | "notifications";

function tabsFor(user: AuthUser) {
  return tabs.filter((tab) => tab.id !== "admin" || user.accountType === "ADMIN");
}

const refreshIntervalMs = 30_000;

export function CoreUpApp({ exercises }: CoreUpAppProps) {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [preferences, setPreferences] = useState<GeneratorPreferences>(defaultPreferences);
  const [generatedPlan, setGeneratedPlan] = useState(() => generateWorkoutPlan(exercises, defaultPreferences));
  const [savedDays, setSavedDays] = useState<WorkoutDay[]>([]);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState("");
  const preferencesDirty = useRef(false);
  const [activeDayId, setActiveDayId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("Todos");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminRequestId, setAdminRequestId] = useState<string | null>(null);
  const [justRequested, setJustRequested] = useState(false);
  const [tabResetKey, setTabResetKey] = useState(0);

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

  useEffect(() => {
    if (!authToken) {
      return;
    }

    let cancelled = false;

    async function refreshAccount() {
      const [meResponse, notificationsResponse] = await Promise.all([
        apiFetch(authToken!, "/api/me"),
        apiFetch(authToken!, "/api/notifications")
      ]).catch(() => [null, null]);

      if (cancelled || !meResponse || !notificationsResponse) {
        return;
      }

      if (meResponse.status === 401) {
        clearSession();
        return;
      }

      if (meResponse.ok) {
        setUser(((await meResponse.json()) as { user: AuthUser }).user);
      }

      if (notificationsResponse.ok) {
        const data = (await notificationsResponse.json()) as { notifications: AppNotification[]; unreadCount: number };
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    }

    void refreshAccount();
    const interval = window.setInterval(refreshAccount, refreshIntervalMs);
    const onFocus = () => void refreshAccount();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

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

    if (!response || (!response.ok && response.status !== 404)) {
      setPlanError("Nao foi possivel remover o treino.");
      return;
    }

    const nextDays = savedDays.filter((day) => day.id !== dayId);
    setSavedDays(nextDays);
    setActiveDayId(nextDays[0]?.id ?? "");
  }

  async function deleteAccount(password: string) {
    if (!authToken) {
      return "Sessao expirada. Entre novamente.";
    }

    try {
      const response = await apiFetch(authToken, "/api/me", {
        method: "DELETE",
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string; details?: Array<{ message: string }> };
        return data.details?.[0]?.message ?? data.error ?? "Nao foi possivel excluir a conta.";
      }

      clearSession();
      return null;
    } catch {
      return "Nao foi possivel excluir a conta.";
    }
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

    const isProfessional = authForm.accountType === "PROFESSIONAL";
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
            weightKg: parseOptionalNumber(authForm.weightKg),
            acceptPrivacy: authForm.acceptPrivacy,
            accountType: authForm.accountType,
            professional: isProfessional
              ? {
                  crefNumber: authForm.crefNumber,
                  crefState: authForm.crefState,
                  specialty: authForm.specialty,
                  education: authForm.education
                }
              : undefined
          };

    try {
      if (authMode === "register" && authForm.password !== authForm.confirmPassword) {
        throw new Error("As senhas nao conferem.");
      }

      if (authMode === "register" && !authForm.acceptPrivacy) {
        throw new Error("Aceite a Politica de Privacidade para criar a conta.");
      }

      if (authMode === "register" && isProfessional && !authForm.crefState) {
        throw new Error("Selecione a UF do registro CREF.");
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
      setJustRequested(authMode === "register" && data.user.professional?.status === "PENDING");
      setAuthForm(emptyAuthForm);
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
    setNotifications([]);
    setUnreadCount(0);
    setAdminRequestId(null);
    setJustRequested(false);
  }

  async function reloadNotifications() {
    if (!authToken) {
      return;
    }

    const response = await apiFetch(authToken, "/api/notifications").catch(() => null);

    if (response?.ok) {
      const data = (await response.json()) as { notifications: AppNotification[]; unreadCount: number };
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
  }

  async function markNotificationsRead(ids?: string[]) {
    if (!authToken) {
      return;
    }

    await apiFetch(authToken, "/api/notifications", { method: "PATCH", body: JSON.stringify({ ids }) }).catch(() => null);
    await reloadNotifications();
  }

  function openNotification(notification: AppNotification) {
    if (!notification.readAt) {
      void markNotificationsRead([notification.id]);
    }

    if (user?.accountType === "ADMIN" && notification.type === "PROFESSIONAL_REQUEST_CREATED" && notification.requestId) {
      setAdminRequestId(notification.requestId);
      setActiveTab("admin");
      return;
    }

    setActiveTab("progress");
  }

  function changeTab(tab: TabId) {
    setAdminRequestId(null);

    if (tab === activeTab) {
      setTabResetKey((key) => key + 1);
    }

    setActiveTab(tab);
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
    <div className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        <AppHeader
          notificationsOpen={activeTab === "notifications"}
          unreadCount={unreadCount}
          user={user}
          onLogout={handleLogout}
          onOpenNotifications={() => changeTab("notifications")}
        />

        <main key={`${activeTab}-${tabResetKey}`} className="flex-1 animate-fade-up px-4 pb-32">
          {planError && (
            <div className="mb-4">
              <Alert tone="error">{planError}</Alert>
            </div>
          )}
          {activeTab === "home" && user.professional && user.professional.status !== "APPROVED" && (
            <div className="mb-5">
              <ProfessionalStatusCard justSubmitted={justRequested} professional={user.professional} />
            </div>
          )}
          {activeTab === "home" && (
            <HomeView
              selectedWorkout={todayWorkout}
              byId={byId}
              groupSummary={groupSummary}
              savedPlan={savedPlan}
              onOpenPlan={() => changeTab("plan")}
              onOpenBuilder={() => changeTab("builder")}
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
              onOpenPlan={() => changeTab("plan")}
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
              onOpenBuilder={() => changeTab("builder")}
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
          {activeTab === "reviews" && <ProfessionalReviewsView authToken={authToken} exercises={exercises} user={user} />}
          {activeTab === "progress" && (
            <ProgressView
              authToken={authToken}
              savedPlan={savedPlan}
              user={user}
              onDeleteAccount={deleteAccount}
              onUserChange={setUser}
            />
          )}
          {activeTab === "notifications" && (
            <NotificationsView
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={() => void markNotificationsRead()}
              onOpen={openNotification}
            />
          )}
          {activeTab === "admin" && user.accountType === "ADMIN" && (
            <AdminRequestsView
              authToken={authToken}
              initialRequestId={adminRequestId}
              onChanged={() => void reloadNotifications()}
            />
          )}
        </main>

        <BottomNavigation activeTab={activeTab} tabs={tabsFor(user)} onChange={changeTab} />
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="glass flex items-center gap-3 rounded-full px-5 py-3 text-sm font-medium text-white/80">
        <Loader2 size={18} className="animate-spin text-accent" />
        Abrindo CoreUp
      </div>
    </div>
  );
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 64 64" width={size}>
      <path d="M42 22.5a13 13 0 1 0 0 19" fill="none" stroke="var(--color-accent)" strokeLinecap="round" strokeWidth="7" />
      <circle cx="44" cy="32" fill="var(--color-accent)" r="3.5" />
    </svg>
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
  const isProfessional = authForm.accountType === "PROFESSIONAL";
  const passwordToggle = (
    <button
      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
      className="grid size-9 shrink-0 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
      onClick={onPasswordVisibilityChange}
      title={showPassword ? "Ocultar senha" : "Mostrar senha"}
      type="button"
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );

  return (
    <div className="px-4 py-8">
      <main className="relative mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-[380px] flex-col justify-center">

        <section className="glass-strong rounded-2xl p-6">
          <div className="mb-7 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">CoreUp</p>
              <h1 className="mt-1 text-3xl font-semibold uppercase tracking-tight">{isRegister ? "Criar conta" : "Entrar"}</h1>
            </div>
            <span className="grid size-11 place-items-center rounded-full border border-white/10 text-accent">
              {isRegister ? <UserPlus size={22} /> : <UserRound size={22} />}
            </span>
          </div>

          <div className="glass-inset mb-5 grid grid-cols-2 gap-1 rounded-xl p-1">
            <AuthModeButton active={!isRegister} label="Entrar" onClick={() => onModeChange("login")} />
            <AuthModeButton active={isRegister} label="Cadastrar" onClick={() => onModeChange("register")} />
          </div>

          {isRegister && (
            <AccountTypePicker
              value={authForm.accountType}
              onChange={(accountType) => onFormChange({ ...authForm, accountType })}
            />
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            {isRegister && (
              <AuthInput
                autoComplete="name"
                icon={<UserRound size={18} />}
                label={isProfessional ? "Nome completo" : "Nome"}
                onChange={(name) => onFormChange({ ...authForm, name })}
                placeholder={isProfessional ? "Como consta no registro CREF" : "Seu nome"}
                value={authForm.name}
              />
            )}
            <AuthInput
              autoComplete="email"
              icon={<Mail size={18} />}
              label="E-mail"
              onChange={(email) => onFormChange({ ...authForm, email })}
              placeholder="voce@email.com"
              type="email"
              value={authForm.email}
            />
            <AuthInput
              autoComplete={isRegister ? "new-password" : "current-password"}
              icon={<LockKeyhole size={18} />}
              label="Senha"
              onChange={(password) => onFormChange({ ...authForm, password })}
              placeholder={isRegister ? "8+ com numero e simbolo" : "Sua senha"}
              trailing={passwordToggle}
              type={showPassword ? "text" : "password"}
              value={authForm.password}
            />
            {isRegister && (
              <AuthInput
                autoComplete="new-password"
                icon={<LockKeyhole size={18} />}
                label="Confirmar senha"
                onChange={(confirmPassword) => onFormChange({ ...authForm, confirmPassword })}
                placeholder="Repita sua senha"
                trailing={passwordToggle}
                type={showPassword ? "text" : "password"}
                value={authForm.confirmPassword}
              />
            )}
            {isRegister && isProfessional && (
              <fieldset className="min-w-0 space-y-4 border-t border-white/10 pt-4">
                <legend className="sr-only">Registro profissional</legend>
                <div>
                  <p className="text-sm font-medium text-white/85">Registro profissional</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">
                    Registro no CREF (Conselho Regional de Educacao Fisica). Ele aparece nas suas avaliacoes de treino.
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_96px] gap-3">
                  <AuthInput
                    label="Numero do CREF"
                    onChange={(crefNumber) => onFormChange({ ...authForm, crefNumber })}
                    placeholder="012345-G"
                    value={authForm.crefNumber}
                  />
                  <AuthSelect
                    label="UF"
                    onChange={(crefState) => onFormChange({ ...authForm, crefState })}
                    options={brazilianStates}
                    placeholder="UF"
                    value={authForm.crefState}
                  />
                </div>
                <AuthInput
                  label="Especialidade ou area de atuacao"
                  onChange={(specialty) => onFormChange({ ...authForm, specialty })}
                  placeholder="Ex.: Musculacao e hipertrofia"
                  value={authForm.specialty}
                />
                <AuthInput
                  label="Formacao academica"
                  onChange={(education) => onFormChange({ ...authForm, education })}
                  placeholder="Ex.: Bacharelado em Educacao Fisica"
                  value={authForm.education}
                />
                <p className="text-xs leading-relaxed text-white/50">
                  Sua conta e criada na hora e voce ja pode usar o app. As funcoes profissionais, como avaliar
                  treinos, sao liberadas depois que o administrador conferir o seu CREF.
                </p>
              </fieldset>
            )}
            {isRegister && (
              <div className="grid grid-cols-2 gap-3">
                <AuthInput
                  inputMode="decimal"
                  label="Altura"
                  onChange={(heightCm) => onFormChange({ ...authForm, heightCm })}
                  placeholder="cm"
                  type="number"
                  value={authForm.heightCm}
                />
                <AuthInput
                  inputMode="decimal"
                  label="Peso"
                  onChange={(weightKg) => onFormChange({ ...authForm, weightKg })}
                  placeholder="kg"
                  type="number"
                  value={authForm.weightKg}
                />
              </div>
            )}
            {isRegister && (
              <label className="glass-inset flex cursor-pointer items-start gap-3 rounded-xl p-3 text-xs leading-relaxed text-white/70">
                <input
                  checked={authForm.acceptPrivacy}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
                  onChange={(event) => onFormChange({ ...authForm, acceptPrivacy: event.target.checked })}
                  type="checkbox"
                />
                <span>
                  Li e aceito a{" "}
                  <a className="font-medium text-accent underline underline-offset-2" href="/privacidade" target="_blank">
                    Politica de Privacidade
                  </a>{" "}
                  e autorizo o uso dos meus dados de saude (altura, peso e medidas) para acompanhar minha evolucao.
                </span>
              </label>
            )}

            {authError && <Alert tone="error">{authError}</Alert>}
            {authNotice && <Alert tone="success">{authNotice}</Alert>}

            <button
              className="btn-primary mt-2 flex h-13 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold"
              disabled={authLoading}
              type="submit"
            >
              {authLoading && <Loader2 size={18} className="animate-spin" />}
              {!isRegister ? "Entrar" : isProfessional ? "Criar conta e enviar solicitacao" : "Criar e entrar"}
            </button>
          </form>

          {isRegister && (
            <p className="mt-5 text-xs leading-relaxed text-white/50">
              A senha precisa ter letra maiuscula, minuscula, numero, simbolo e pelo menos 8 caracteres.
            </p>
          )}
        </section>

        <a className="mt-6 text-center text-xs font-medium text-white/45 transition hover:text-white/80" href="/privacidade">
          Politica de Privacidade
        </a>
      </main>
    </div>
  );
}

const accountTypeOptions: Array<{ id: AccountType; label: string; description: string }> = [
  {
    id: "USER",
    label: "Usuario comum",
    description: "Organize seus treinos e acompanhe sua rotina."
  },
  {
    id: "PROFESSIONAL",
    label: "Profissional de Educacao Fisica",
    description: "Formado e registrado no CREF. Usa o app e tambem avalia treinos."
  }
];

function AccountTypePicker({ value, onChange }: { value: AccountType; onChange: (value: AccountType) => void }) {
  return (
    <div className="mb-5">
      <p className="mb-1.5 px-1 text-sm font-medium text-white/85">Tipo de conta</p>
      <div aria-label="Tipo de conta" className="space-y-2" role="radiogroup">
        {accountTypeOptions.map((option) => {
          const active = value === option.id;

          return (
            <button
              key={option.id}
              aria-checked={active}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                active ? "chip-active" : "border-white/[0.08] hover:border-white/20"
              }`}
              onClick={() => onChange(option.id)}
              role="radio"
              type="button"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
                  active ? "border-accent" : "border-white/30"
                }`}
              >
                {active && <span className="size-2 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight text-white">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AuthSelect({
  label,
  onChange,
  options,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-sm font-medium text-white/85">{label}</span>
      <span className="glass-field flex h-13 items-center rounded-xl px-3 text-white">
        <select
          className="w-full bg-transparent text-[15px] outline-none [&>option]:bg-[#161a18]"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          <option disabled value="">
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function AuthModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={`h-10 rounded-xl text-sm font-semibold transition ${
        active ? "bg-white/90 text-[#06100b] shadow-sm" : "text-white/65 hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function AuthInput({
  autoComplete,
  icon,
  inputMode,
  label,
  onChange,
  placeholder,
  trailing,
  type = "text",
  value
}: {
  autoComplete?: string;
  icon?: ReactNode;
  inputMode?: "decimal" | "email" | "text";
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  trailing?: ReactNode;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-sm font-medium text-white/85">{label}</span>
      <span className="glass-field flex h-13 items-center gap-3 rounded-xl pl-4 pr-2 text-white">
        {icon && <span className="text-white/55">{icon}</span>}
        <input
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] outline-none placeholder:text-white/35"
          inputMode={inputMode}
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

function Alert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      className={`rounded-xl border px-4 py-3 text-sm font-medium ${
        tone === "error" ? "border-red-400/25 bg-red-500/15 text-red-100" : "border-accent/25 bg-accent/15 text-white"
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function AppHeader({
  user,
  unreadCount,
  notificationsOpen,
  onLogout,
  onOpenNotifications
}: {
  user: AuthUser;
  unreadCount: number;
  notificationsOpen: boolean;
  onLogout: () => void;
  onOpenNotifications: () => void;
}) {
  const firstName = user.name.trim().split(/\s+/)[0];

  return (
    <header className="px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size={30} />
          <div className="min-w-0">
            <p className="text-xs text-white/45">Ola,</p>
            <h1 className="truncate text-lg font-semibold leading-tight">{firstName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            aria-current={notificationsOpen ? "page" : undefined}
            className={`relative ${notificationsOpen ? "text-accent" : ""}`}
            label={unreadCount ? `Notificacoes, ${unreadCount} nao lidas` : "Notificacoes"}
            onClick={onOpenNotifications}
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-on-accent">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </IconButton>
          <IconButton label="Sair" onClick={onLogout}>
            <LogOut size={19} />
          </IconButton>
        </div>
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
    { label: "Treinos", value: savedPlan.days.length, helper: "por semana" },
    {
      label: "Exercicios",
      value: savedPlan.days.reduce((total, day) => total + day.exercises.length, 0),
      helper: "na semana"
    },
    { label: "Minutos", value: weeklyMinutes, helper: "por semana" },
    { label: "Grupos", value: Object.keys(savedPlan.coverage).length, helper: "trabalhados" }
  ];

  return (
    <section className="space-y-6">
      {selectedWorkout ? (
        <TodayWorkout
          workout={selectedWorkout}
          byId={byId}
          notes={savedPlan.notes}
          weeklySets={weeklySets}
          onOpenPlan={onOpenPlan}
        />
      ) : (
        <EmptyPlan onOpenBuilder={onOpenBuilder} />
      )}

      <section
        aria-label="Resumo da semana"
        className="grid grid-cols-4 divide-x divide-white/[0.07] rounded-2xl border border-white/[0.07]"
      >
        {planStats.map((stat) => (
          <div key={stat.label} className="px-3 py-3.5">
            <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
            <p className="mt-0.5 text-xs text-white/60">{stat.label}</p>
            <p className="text-[11px] text-white/35">{stat.helper}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-white/80">Biblioteca</h3>
          <span className="text-xs text-white/45">{totalGroups} grupos musculares</span>
        </div>
        <GroupBars groupSummary={groupSummary} />
      </section>
    </section>
  );
}

function EmptyPlan({ onOpenBuilder }: { onOpenBuilder: () => void }) {
  return (
    <section className="glass-strong rounded-2xl p-5">
      <p className="text-xs font-medium text-accent">Seu treino</p>
      <h3 className="mt-2 text-lg font-semibold">Voce ainda nao tem um plano</h3>
      <p className="mt-1 text-sm leading-relaxed text-white/55">
        Escolha objetivo, nivel e dias na aba Montar para gerar a sua semana de treino.
      </p>
      <button
        className="btn-primary mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
        onClick={onOpenBuilder}
        type="button"
      >
        Montar meu treino
      </button>
    </section>
  );
}

type TodayWorkoutProps = {
  workout: WorkoutDay;
  byId: Map<number, Exercise>;
  notes: string[];
  weeklySets: number;
  onOpenPlan: () => void;
};

function TodayWorkout({ workout, byId, notes, weeklySets, onOpenPlan }: TodayWorkoutProps) {
  return (
    <section className="glass-strong rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-accent">Treino de hoje · {workout.label}</p>
        <span className="text-xs text-white/45">{workout.intensity}</span>
      </div>
      <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{workout.focus}</h2>
      <p className="mt-1 text-sm tabular-nums text-white/55">
        {workout.duration} · {workout.exercises.length} exercicios · {weeklySets} series na semana
      </p>

      <ul className="mt-4 divide-y divide-white/[0.07] border-t border-white/[0.07]">
        {workout.exercises.slice(0, 3).map((item) => {
          const exercise = byId.get(item.exerciseId);

          return (
            <li key={item.exerciseId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{exercise?.nome}</p>
                <p className="text-xs text-white/45">{exercise?.grupoMuscular}</p>
              </div>
              <p className="shrink-0 text-sm tabular-nums text-white/70">
                {item.sets} × {item.reps}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-xs leading-relaxed text-white/45">{notes[0]}</p>

      <button
        className="mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 text-sm font-medium text-white/85 transition hover:bg-white/[0.05]"
        onClick={onOpenPlan}
        type="button"
      >
        Ver treino completo
        <ChevronRight size={16} />
      </button>
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
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-white/45">Gerador inteligente</p>
          <h2 className="text-2xl font-semibold tracking-tight">Montar treino</h2>
        </div>
        <IconButton label="Abrir plano" className="text-accent" onClick={onOpenPlan}>
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <section className="glass-strong rounded-2xl p-5">
        <p className="text-xs font-medium text-accent">Previa do plano</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">
          {generatedPlan.days.length} dias · {Object.keys(generatedPlan.coverage).length} grupos musculares
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-white/55">
          O aluno escolhe o que prefere, e o app completa a semana para nao deixar grupos importantes de fora.
        </p>
        <button
          className="btn-primary mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold"
          disabled={saving || !generatedPlan.days.length}
          onClick={onSavePlan}
          type="button"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? "Salvando plano" : "Usar esse plano"}
        </button>
        <p className="mt-2 text-center text-xs text-white/45">
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
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  preferences.availableEquipment.includes(item)
                    ? "chip-active"
                    : "border-white/10 bg-white/[0.04] text-white/65"
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
        <div className="-my-1 divide-y divide-white/[0.06]">
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

      <section className="border-t border-white/[0.07] pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white/80">Cobertura semanal</h3>
            <p className="text-xs text-white/45">{Object.keys(generatedPlan.coverage).length} grupos no plano</p>
          </div>
          <IconButton label="Recalcular" onClick={() => onChange({ ...preferences })}>
            <RotateCcw size={18} />
          </IconButton>
        </div>
        <GroupBars groupSummary={generatedPlan.coverage} />
        <ul className="mt-5 space-y-2 border-l border-white/10 pl-3">
          {generatedPlan.notes.map((note) => (
            <li key={note} className="text-xs leading-relaxed text-white/55">
              {note}
            </li>
          ))}
        </ul>
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
      <section className="space-y-5">
        <div>
          <p className="text-sm text-white/45">Rotina semanal</p>
          <h2 className="text-2xl font-semibold tracking-tight">Treinos</h2>
        </div>
        <EmptyPlan onOpenBuilder={onOpenBuilder} />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-white/45">Rotina semanal</p>
          <h2 className="text-2xl font-semibold tracking-tight">Treinos</h2>
        </div>
        <IconButton label="Ajustar treino" className="text-accent" onClick={onOpenBuilder}>
          <Plus size={20} />
        </IconButton>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {plan.map((day) => (
          <button
            key={day.id}
            className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
              day.id === activeDayId ? "chip-active" : "border-white/[0.08] text-white/55 hover:border-white/20 hover:text-white"
            }`}
            onClick={() => onSelectDay(day.id)}
            type="button"
          >
            {day.label}
          </button>
        ))}
      </div>

      <section className="glass-strong rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold leading-tight tracking-tight">{selectedDay.focus}</h3>
            <p className="mt-1 text-sm text-white/55">
              {selectedDay.duration} · {selectedDay.exercises.length} exercicios
            </p>
          </div>
          <Badge tone={selectedDay.intensity === "Forte" ? "green" : "muted"}>{selectedDay.intensity}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.05]"
            onClick={onOpenBuilder}
            type="button"
          >
            <Plus size={16} />
            Criar novo
          </button>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-red-300/90 transition hover:bg-red-500/10"
            onClick={() => onRemoveDay(selectedDay.id)}
            type="button"
          >
            <Trash2 size={16} />
            Remover dia
          </button>
        </div>

        <div className="mt-5 divide-y divide-white/[0.07] border-t border-white/[0.07]">
          {selectedDay.exercises.map((item, index) => {
            const exercise = byId.get(item.exerciseId);

            return (
              <article key={`${selectedDay.id}-${item.exerciseId}`} className="py-4">
                <div className="flex items-baseline gap-3">
                  <span className="w-5 shrink-0 text-sm tabular-nums text-white/35">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-[15px] font-medium">{exercise?.nome}</h4>
                    <p className="text-xs text-white/45">
                      {exercise?.equipamento} · {exercise?.grupoMuscular}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 pl-8">
                  <MiniStat label="Series" value={String(item.sets)} />
                  <MiniStat label="Reps" value={item.reps} />
                  <MiniStat label="Pausa" value={item.rest} />
                </div>
                {item.note && <p className="mt-2 pl-8 text-xs text-accent">{item.note}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-1">
        <h3 className="text-sm font-medium text-white/80">Por que esse treino fecha</h3>
        <ul className="mt-3 space-y-2 border-l border-white/10 pl-3">
          {savedPlan.notes.map((note) => (
            <li key={note} className="text-sm leading-relaxed text-white/55">
              {note}
            </li>
          ))}
        </ul>
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
    <section className="space-y-5">
      <div>
        <p className="text-sm text-white/45">Biblioteca</p>
        <h2 className="text-2xl font-semibold tracking-tight">Exercicios</h2>
      </div>

      <label className="glass-field flex items-center gap-3 rounded-xl px-4 py-3">
        <Search size={18} className="text-white/40" />
        <input
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar exercicio"
          value={query}
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {groups.map((group) => (
          <button
            key={group}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              group === selectedGroup ? "chip-active" : "border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white"
            }`}
            onClick={() => onGroupChange(group)}
            type="button"
          >
            {group}
          </button>
        ))}
      </div>

      <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {exercises.map((exercise) => (
          <article key={exercise.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-medium">{exercise.nome}</h3>
              <p className="text-xs text-white/45">
                {exercise.grupoMuscular} · {exercise.equipamento}
              </p>
            </div>
            <button
              aria-label={`Favoritar ${exercise.nome}`}
              className={`grid size-10 shrink-0 place-items-center rounded-full transition hover:bg-white/[0.06] ${
                favoriteExerciseIds.includes(exercise.id) ? "text-accent" : "text-white/35 hover:text-white/70"
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
    <section className="border-t border-white/[0.07] pt-5">
      <h3 className="mb-3 text-sm font-medium text-white/80">{title}</h3>
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
      className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition active:scale-[0.98] ${
        active ? "chip-active" : "border-white/[0.08] text-white/65 hover:border-white/20 hover:text-white"
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
    <div className="rounded-xl border border-white/[0.08] p-3">
      <p className="text-xs text-white/45">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          aria-label={`Reduzir ${label}`}
          className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-base text-white/75 transition hover:bg-white/10"
          onClick={() => change(-1)}
          type="button"
        >
          -
        </button>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <button
          aria-label={`Aumentar ${label}`}
          className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-base text-white/75 transition hover:bg-white/10"
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
      className="flex w-full items-center gap-3 py-3 text-left transition hover:opacity-90"
      onClick={onToggle}
      type="button"
    >
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-md border ${
          active ? "border-accent bg-accent text-on-accent" : "border-white/20 text-transparent"
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{exercise.nome}</span>
        <span className="block text-xs text-white/45">
          {exercise.grupoMuscular} · {exercise.equipamento}
        </span>
      </span>
    </button>
  );
}

function ProgressView({
  authToken,
  savedPlan,
  user,
  onDeleteAccount,
  onUserChange
}: {
  authToken: string;
  savedPlan: GeneratedPlan;
  user: AuthUser;
  onDeleteAccount: (password: string) => Promise<string | null>;
  onUserChange: (user: AuthUser) => void;
}) {
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
    <section className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-white/45">Evolucao</p>
          <h2 className="text-2xl font-semibold tracking-tight">Progresso</h2>
        </div>
      </div>

      <section className="glass-strong rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-accent">Resumo fisico</p>
            <h3 className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
              {weight} · {height}
            </h3>
          </div>
          <p className="pt-0.5 text-right text-sm tabular-nums text-white/55">
            <span className="block text-base font-semibold text-white">{weeklySets}</span>
            series/semana
          </p>
        </div>
        <p className="mt-6 text-xs text-white/45">Series por dia do plano</p>
        {savedPlan.days.length ? (
          <div className="mt-2 flex items-end gap-2">
            {setsPerDay.map((day) => (
              <div key={day.id} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-28 w-2.5 items-end rounded-full bg-white/[0.06]">
                  <div className="bar-fill w-full rounded-full" style={{ height: `${(day.sets / maxDaySets) * 100}%` }} />
                </div>
                <span className="mt-1 text-xs font-medium tabular-nums">{day.sets}</span>
                <span className="text-[11px] text-white/45">{day.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-white/55">Monte um treino para ver a distribuicao da semana.</p>
        )}
      </section>

      <section className="border-t border-white/[0.07] pt-5">
        <h3 className="text-sm font-medium text-white/80">Mapa muscular do treino</h3>
        <div className="mt-4">
          <GroupBars groupSummary={savedPlan.coverage} />
        </div>
      </section>

      <AccountSection authToken={authToken} user={user} onDeleteAccount={onDeleteAccount} onUserChange={onUserChange} />
    </section>
  );
}

function ProfessionalSection({
  authToken,
  user,
  onUserChange
}: {
  authToken: string;
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
}) {
  const [requesting, setRequesting] = useState(false);
  const professional = user.professional;
  const canRequest = user.accountType === "USER" && professional?.status !== "PENDING";

  return (
    <div className="mt-4 space-y-3">
      {user.accountType === "ADMIN" && (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2.5 text-sm">
          <ShieldCheck className="text-accent" size={16} />
          Administrador do app
        </div>
      )}

      {professional && (
        <>
          <ProfessionalStatusCard professional={professional} />
          {professional.status === "APPROVED" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-1 text-sm">
              <dt className="text-white/45">Especialidade</dt>
              <dd>{professional.specialty}</dd>
              <dt className="text-white/45">Formacao</dt>
              <dd>{professional.education}</dd>
            </dl>
          )}
        </>
      )}

      {canRequest &&
        (requesting ? (
          <ProfessionalRequestForm
            authToken={authToken}
            defaultName={user.name}
            onCancel={() => setRequesting(false)}
            onSubmitted={(updated) => {
              onUserChange(updated);
              setRequesting(false);
            }}
          />
        ) : (
          <button
            className="text-sm text-white/70 underline underline-offset-4 transition hover:text-white"
            onClick={() => setRequesting(true)}
            type="button"
          >
            {professional?.status === "REJECTED"
              ? "Enviar nova solicitacao com outro CREF"
              : "Sou profissional de Educacao Fisica"}
          </button>
        ))}
    </div>
  );
}

function AccountSection({
  authToken,
  user,
  onDeleteAccount,
  onUserChange
}: {
  authToken: string;
  user: AuthUser;
  onDeleteAccount: (password: string) => Promise<string | null>;
  onUserChange: (user: AuthUser) => void;
}) {
  const email = user.email;
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleting(true);
    setError("");
    const message = await onDeleteAccount(password);

    if (message) {
      setError(message);
      setDeleting(false);
    }
  }

  return (
    <section className="border-t border-white/[0.07] pt-5">
      <h3 className="text-sm font-medium text-white/80">Conta</h3>
      <p className="mt-1 truncate text-sm text-white/55">{email}</p>
      <ProfessionalSection authToken={authToken} user={user} onUserChange={onUserChange} />
      <a
        className="mt-4 block text-sm text-white/70 underline underline-offset-4 transition hover:text-white"
        href="/privacidade"
        target="_blank"
      >
        Politica de Privacidade
      </a>

      {!confirming ? (
        <button
          className="mt-4 -ml-2 flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-red-300/90 transition hover:bg-red-500/10"
          onClick={() => setConfirming(true)}
          type="button"
        >
          <Trash2 size={16} />
          Excluir minha conta
        </button>
      ) : (
        <form className="mt-4 space-y-3 rounded-xl border border-red-400/20 bg-red-500/[0.06] p-4" onSubmit={handleDelete}>
          <p className="text-sm font-medium leading-relaxed text-red-100">
            Isso apaga definitivamente sua conta, seus planos, seu historico e suas medidas. Nao tem volta.
          </p>
          <input
            autoComplete="current-password"
            className="h-11 w-full rounded-xl border border-red-400/25 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-red-300/60"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Confirme com sua senha"
            type="password"
            value={password}
          />
          {error && <p className="text-sm font-medium text-red-200">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button
              className="h-11 rounded-xl border border-white/10 text-sm font-medium text-white/80 transition hover:bg-white/[0.05]"
              disabled={deleting}
              onClick={() => {
                setConfirming(false);
                setPassword("");
                setError("");
              }}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500/85 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
              disabled={deleting || !password}
              type="submit"
            >
              {deleting && <Loader2 size={16} className="animate-spin" />}
              Excluir
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function GroupBars({ groupSummary }: { groupSummary: Record<string, number> }) {
  const entries = Object.entries(groupSummary).slice(0, 7);
  const max = Math.max(1, ...Object.values(groupSummary));

  return (
    <div className="space-y-3">
      {entries.length === 0 && <p className="text-sm text-white/55">Monte um treino para ver a cobertura.</p>}
      {entries.map(([group, amount]) => (
          <div key={group}>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-white/70">{group}</span>
              <span className="tabular-nums text-white/45">{amount}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06]">
              <div className="bar-fill h-full rounded-full" style={{ width: `${(amount / max) * 100}%` }} />
            </div>
          </div>
        ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-white/40">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function BottomNavigation({
  activeTab,
  tabs: visibleTabs,
  onChange
}: {
  activeTab: TabId;
  tabs: NavTab[];
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[430px] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        className="glass-nav grid gap-0.5 rounded-full p-1.5"
        style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
      >
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              aria-current={active ? "page" : undefined}
              className={`flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-full font-medium transition ${
                active
                  ? "bg-white/[0.12] text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : "text-white/55 hover:text-white/85"
              }`}
              onClick={() => onChange(tab.id)}
              type="button"
            >
              <tab.icon size={19} strokeWidth={active ? 2.2 : 1.8} />
              {/* Fonte no span: o "button { font: inherit }" global anula classes de fonte no botao. */}
              <span className="max-w-full truncate text-[11px] leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
