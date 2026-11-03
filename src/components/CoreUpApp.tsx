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
  Pencil,
  Play,
  Plus,
  Search,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Bell,
  Trash2,
  UserPlus,
  UserRound
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { apiFetch, type AccountType, type AppNotification, type AuthUser } from "@/lib/api-client";
import { brazilianStates } from "@/lib/professional";
import { exerciseMap, getTodayWorkout, summarizeGroups } from "@/lib/exercise-view";
import type { ApiBodyMetric, ApiWorkoutLog } from "@/lib/history";
import { normalizeText } from "@/lib/text";
import { useIncrementalList } from "@/lib/use-incremental-list";
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
import { CustomPlanBuilder } from "@/components/CustomPlanBuilder";
import { ExerciseSheet } from "@/components/ExerciseSheets";
import { NotificationsView } from "@/components/NotificationsView";
import { Onboarding, type OnboardingDestination } from "@/components/Onboarding";
import { ProfessionalRequestForm, ProfessionalStatusCard } from "@/components/ProfessionalStatus";
import { BodySection, HistoryList, LoadProgress, TrainingSummary } from "@/components/ProgressSections";
import { ProfessionalReviewsView } from "@/components/ProfessionalReviewsView";
import { WorkoutEditor, type EditorPayload } from "@/components/WorkoutEditor";
import { readActiveSession, WorkoutSession, type SessionPayload } from "@/components/WorkoutSession";
import { Badge } from "@/components/ui/Badge";
import { BrandMark } from "@/components/ui/BrandMark";
import { ConfirmPanel } from "@/components/ui/ConfirmPanel";
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
  { id: "home", label: "Início", icon: Home },
  { id: "builder", label: "Montar", icon: Sparkles },
  { id: "plan", label: "Treino", icon: CalendarDays },
  { id: "library", label: "Exerc.", icon: Library },
  { id: "reviews", label: "Aval.", icon: BadgeCheck },
  { id: "progress", label: "Evol.", icon: BarChart3 },
  { id: "admin", label: "Admin", icon: ShieldCheck }
] as const;

type NavTab = (typeof tabs)[number];
type TabId = NavTab["id"] | "notifications" | "session";

function tabsFor(user: AuthUser) {
  return tabs.filter((tab) => tab.id !== "admin" || user.accountType === "ADMIN");
}

const refreshIntervalMs = 30_000;
const favoritesFilter = "Favoritos";

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
  const [logs, setLogs] = useState<ApiWorkoutLog[]>([]);
  const [metrics, setMetrics] = useState<ApiBodyMetric[]>([]);
  const [sessionDayId, setSessionDayId] = useState<string | null>(null);
  const [exerciseSheetId, setExerciseSheetId] = useState<number | null>(null);
  const [builderMode, setBuilderMode] = useState<"auto" | "custom">("auto");
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
  const [returnTab, setReturnTab] = useState<TabId>("home");
  const [replayOnboarding, setReplayOnboarding] = useState(false);
  const onboardingDismissed = useRef(false);

  const byId = useMemo(() => exerciseMap(exercises), [exercises]);
  const savedPlan = useMemo<GeneratedPlan>(() => {
    const coverage = summarizePlanCoverage(savedDays, exercises);
    return { days: savedDays, coverage, notes: buildPlanNotes(preferences, coverage) };
  }, [savedDays, exercises, preferences]);
  const plan = savedPlan.days;
  const todayWorkout = useMemo(() => (plan.length ? getTodayWorkout(plan) : null), [plan]);
  const selectedDay = plan.find((day) => day.id === activeDayId) ?? todayWorkout;
  const groupSummary = useMemo(() => summarizeGroups(exercises), [exercises]);
  const groups = useMemo(() => ["Todos", favoritesFilter, ...Object.keys(groupSummary)], [groupSummary]);
  const equipment = useMemo(() => getEquipmentList(exercises), [exercises]);
  const favoriteExercises = useMemo(
    () => exercises.filter((exercise) => preferences.favoriteExerciseIds.includes(exercise.id)),
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
          throw new Error("Sessão expirada.");
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
        const nextPreferences = data.preferences
          ? {
              ...data.preferences,
              availableEquipment: data.preferences.availableEquipment.map((item) => (item === "Maquina" ? "Máquina" : item))
            }
          : defaultPreferences;
        setSavedDays(days);
        setActiveDayId(days[0]?.id ?? "");
        setPreferences(nextPreferences);
        setGeneratedPlan(generateWorkoutPlan(exercises, nextPreferences));
        void loadActivity(authToken!);
      })
      .catch(() => {
        if (!cancelled) {
          setPlanError("Não foi possível carregar seu treino. Tente recarregar a página.");
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

  const searchIndex = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, normalizeText(exercise.nome)])), [exercises]);
  const deferredQuery = useDeferredValue(query);

  const filteredExercises = useMemo(() => {
    const term = normalizeText(deferredQuery.trim());
    const showFavorites = selectedGroup === favoritesFilter;
    const favorites = new Set(preferences.favoriteExerciseIds);

    return exercises.filter(
      (exercise) =>
        (showFavorites ? favorites.has(exercise.id) : selectedGroup === "Todos" || exercise.grupoMuscular === selectedGroup) &&
        (!term || searchIndex.get(exercise.id)?.includes(term))
    );
  }, [exercises, deferredQuery, searchIndex, selectedGroup, preferences.favoriteExerciseIds]);

  function updatePreferences(nextPreferences: GeneratorPreferences) {
    preferencesDirty.current = true;
    setPreferences(nextPreferences);
    setGeneratedPlan(generateWorkoutPlan(exercises, nextPreferences));
  }

  async function persistPlan(planDays: WorkoutDay[]) {
    if (!authToken) {
      return "Sessão expirada. Entre novamente.";
    }

    setPlanSaving(true);
    setPlanError("");

    try {
      const response = await apiFetch(authToken, "/api/plan", {
        method: "PUT",
        body: JSON.stringify({ preferences, days: toPlanDays(planDays) })
      });
      const data = (await response.json()) as { workouts?: ApiWorkout[]; error?: string; details?: Array<{ message: string }> };

      if (!response.ok || !data.workouts) {
        throw new Error(data.details?.[0]?.message ?? data.error ?? "Não foi possível salvar o plano.");
      }

      const days = data.workouts.map(toWorkoutDay);
      preferencesDirty.current = false;
      setSavedDays(days);
      setActiveDayId(days[0]?.id ?? "");
      setActiveTab("plan");
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Não foi possível salvar o plano.";
    } finally {
      setPlanSaving(false);
    }
  }

  async function saveGeneratedPlan() {
    if (!generatedPlan.days.length) {
      return;
    }

    const message = await persistPlan(generatedPlan.days);

    if (message) {
      setPlanError(message);
    }
  }

  async function removeWorkoutDay(dayId: string) {
    if (!authToken) {
      return;
    }

    setPlanError("");
    const response = await apiFetch(authToken, `/api/workouts/${dayId}`, { method: "DELETE" }).catch(() => null);

    if (!response || (!response.ok && response.status !== 404)) {
      setPlanError("Não foi possível remover o treino.");
      return;
    }

    const nextDays = savedDays.filter((day) => day.id !== dayId);
    setSavedDays(nextDays);
    setActiveDayId(nextDays[0]?.id ?? "");
  }

  async function loadActivity(token: string) {
    const [historyResponse, metricsResponse] = await Promise.all([
      apiFetch(token, "/api/history").catch(() => null),
      apiFetch(token, "/api/body-metrics").catch(() => null)
    ]);

    if (historyResponse?.ok) {
      setLogs(((await historyResponse.json()) as { history: ApiWorkoutLog[] }).history);
    }

    if (metricsResponse?.ok) {
      setMetrics(((await metricsResponse.json()) as { metrics: ApiBodyMetric[] }).metrics);
    }
  }

  async function saveSession(payload: SessionPayload) {
    if (!authToken) {
      return null;
    }

    const response = await apiFetch(authToken, "/api/history", { method: "POST", body: JSON.stringify(payload) }).catch(() => null);

    if (!response?.ok) {
      return null;
    }

    const { log } = (await response.json()) as { log: ApiWorkoutLog };
    setLogs((current) => [log, ...current]);
    return log;
  }

  async function deleteLog(logId: string) {
    if (!authToken) {
      return false;
    }

    const response = await apiFetch(authToken, `/api/history/${logId}`, { method: "DELETE" }).catch(() => null);

    if (!response?.ok && response?.status !== 404) {
      setPlanError("Não foi possível apagar o registro.");
      return false;
    }

    setLogs((current) => current.filter((log) => log.id !== logId));
    return true;
  }

  async function addMetric(payload: { weightKg: number; bodyFat?: number }) {
    if (!authToken || !user) {
      return "Sessão expirada. Entre novamente.";
    }

    const response = await apiFetch(authToken, "/api/body-metrics", { method: "POST", body: JSON.stringify(payload) }).catch(() => null);

    if (!response?.ok) {
      return "Não foi possível salvar a medida.";
    }

    const { metric } = (await response.json()) as { metric: ApiBodyMetric };
    setMetrics((current) => [metric, ...current]);
    setUser({ ...user, weightKg: metric.weightKg ?? user.weightKg });
    return null;
  }

  async function saveDayEdit(dayId: string, exercisesPayload: EditorPayload) {
    if (!authToken) {
      return "Sessão expirada. Entre novamente.";
    }

    const response = await apiFetch(authToken, `/api/workouts/${dayId}`, {
      method: "PUT",
      body: JSON.stringify({ exercises: exercisesPayload })
    }).catch(() => null);
    const data = response ? ((await response.json().catch(() => ({}))) as { workout?: ApiWorkout; error?: string; details?: Array<{ message: string }> }) : {};

    if (!response?.ok || !data.workout) {
      return data.details?.[0]?.message ?? data.error ?? "Não foi possível salvar o dia.";
    }

    const updated = toWorkoutDay(data.workout);
    setSavedDays((current) => current.map((day) => (day.id === dayId ? updated : day)));
    return null;
  }

  async function updateProfile(payload: { name: string; heightCm: number | null }) {
    if (!authToken) {
      return "Sessão expirada. Entre novamente.";
    }

    const response = await apiFetch(authToken, "/api/me", { method: "PATCH", body: JSON.stringify(payload) }).catch(() => null);
    const data = response ? ((await response.json().catch(() => ({}))) as { user?: AuthUser; error?: string; details?: Array<{ message: string }> }) : {};

    if (!response?.ok || !data.user) {
      return data.details?.[0]?.message ?? data.error ?? "Não foi possível salvar o perfil.";
    }

    setUser(data.user);
    return null;
  }

  function startSession(dayId: string) {
    setSessionDayId(dayId);
    changeTab("session");
    window.scrollTo({ top: 0 });
  }

  async function clearPlan() {
    if (!authToken) {
      return false;
    }

    setPlanError("");
    const response = await apiFetch(authToken, "/api/plan", {
      method: "PUT",
      body: JSON.stringify({ preferences, days: [] })
    }).catch(() => null);

    if (!response?.ok) {
      setPlanError("Não foi possível limpar o treino.");
      return false;
    }

    setSavedDays([]);
    setActiveDayId("");
    return true;
  }

  async function deleteAccount(password: string) {
    if (!authToken) {
      return "Sessão expirada. Entre novamente.";
    }

    try {
      const response = await apiFetch(authToken, "/api/me", {
        method: "DELETE",
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string; details?: Array<{ message: string }> };
        return data.details?.[0]?.message ?? data.error ?? "Não foi possível excluir a conta.";
      }

      clearSession();
      return null;
    } catch {
      return "Não foi possível excluir a conta.";
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
        throw new Error("As senhas não conferem.");
      }

      if (authMode === "register" && !authForm.acceptPrivacy) {
        throw new Error("Aceite a Política de Privacidade para criar a conta.");
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
        throw new Error(detail ?? data.error ?? "Não foi possível entrar.");
      }

      window.localStorage.setItem(authStorageKey, data.token);
      setAuthToken(data.token);
      setUser(data.user);
      setJustRequested(authMode === "register" && data.user.professional?.status === "PENDING");
      setAuthForm(emptyAuthForm);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível entrar.");
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
    setReplayOnboarding(false);
    onboardingDismissed.current = false;
    setLogs([]);
    setMetrics([]);
    setSessionDayId(null);
    setExerciseSheetId(null);
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

  function finishOnboarding(destination: OnboardingDestination) {
    setReplayOnboarding(false);

    if (authToken && user && !user.onboardingCompleted) {
      onboardingDismissed.current = true;
      setUser({ ...user, onboardingCompleted: true });
      void apiFetch(authToken, "/api/me/onboarding", { method: "POST" }).catch(() => null);
    }

    if (destination !== "home") {
      changeTab(destination);
    }
  }

  function changeOnboardingGoal(goal: GeneratorPreferences["goal"]) {
    if (goal !== preferences.goal) {
      updatePreferences({ ...preferences, goal });
    }
  }

  function changeTab(tab: TabId) {
    setAdminRequestId(null);

    if (tab === "notifications" && activeTab === "notifications") {
      setActiveTab(returnTab);
      return;
    }

    if (tab === "notifications") {
      setReturnTab(activeTab);
    }

    if (tab === activeTab) {
      setTabResetKey((key) => key + 1);
    }

    setActiveTab(tab);
  }

  const storedSession = user ? readActiveSession(user.id) : null;
  const activeSessionDay = storedSession ? savedDays.find((day) => day.id === storedSession.dayId) ?? null : null;
  const sessionDay = savedDays.find((day) => day.id === sessionDayId) ?? null;

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
          {activeTab !== "session" && activeSessionDay && (
            <button
              className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-accent/35 bg-accent/[0.08] px-4 py-3 text-left transition hover:bg-accent/[0.12]"
              onClick={() => startSession(activeSessionDay.id)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block text-xs font-medium text-accent">Treino em andamento</span>
                <span className="block truncate text-sm font-medium">{activeSessionDay.focus}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
                Continuar
                <ChevronRight size={16} />
              </span>
            </button>
          )}
          {activeTab === "session" && sessionDay && (
            <WorkoutSession
              byId={byId}
              day={sessionDay}
              logs={logs}
              userId={user.id}
              onExit={() => {
                setSessionDayId(null);
                changeTab("home");
              }}
              onOpenExercise={setExerciseSheetId}
              onOpenProgress={() => {
                setSessionDayId(null);
                changeTab("progress");
              }}
              onSave={saveSession}
            />
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
              onStartSession={startSession}
            />
          )}
          {activeTab === "builder" && (
            <div className="space-y-6">
              <div aria-label="Como montar o treino" className="glass-inset grid grid-cols-2 gap-1 rounded-xl p-1" role="radiogroup">
                {(
                  [
                    ["auto", "Gerar automático"],
                    ["custom", "Do meu jeito"]
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    aria-checked={builderMode === mode}
                    className={`h-10 rounded-lg text-sm font-semibold transition ${
                      builderMode === mode ? "bg-white/90 text-[#06100b]" : "text-white/65 hover:text-white"
                    }`}
                    onClick={() => setBuilderMode(mode)}
                    role="radio"
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {builderMode === "auto" ? (
                <BuilderView
                  byId={byId}
                  equipment={equipment}
                  exercises={exercises}
                  favoriteExercises={favoriteExercises}
                  generatedPlan={generatedPlan}
                  hasSavedPlan={savedDays.length > 0}
                  preferences={preferences}
                  saving={planSaving}
                  onChange={updatePreferences}
                  onFavoriteToggle={toggleFavorite}
                  onSavePlan={saveGeneratedPlan}
                />
              ) : (
                <CustomPlanBuilder byId={byId} exercises={exercises} savedDays={savedDays} onSave={persistPlan} />
              )}
            </div>
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
              exercises={exercises}
              onClearPlan={clearPlan}
              onOpenExercise={setExerciseSheetId}
              onRemoveDay={removeWorkoutDay}
              onSaveDay={saveDayEdit}
              onStartSession={startSession}
            />
          )}
          {activeTab === "library" && (
            <LibraryView
              exercises={filteredExercises}
              groups={groups}
              selectedGroup={selectedGroup}
              query={query}
              listKey={`${selectedGroup}|${deferredQuery}`}
              favoriteExerciseIds={preferences.favoriteExerciseIds}
              onQueryChange={setQuery}
              onGroupChange={setSelectedGroup}
              onFavoriteToggle={toggleFavorite}
              onOpenExercise={setExerciseSheetId}
            />
          )}
          {activeTab === "reviews" && <ProfessionalReviewsView authToken={authToken} exercises={exercises} user={user} />}
          {activeTab === "progress" && (
            <ProgressView
              authToken={authToken}
              byId={byId}
              logs={logs}
              metrics={metrics}
              savedPlan={savedPlan}
              user={user}
              onAddMetric={addMetric}
              onDeleteAccount={deleteAccount}
              onDeleteLog={deleteLog}
              onUpdateProfile={updateProfile}
              onReplayOnboarding={() => setReplayOnboarding(true)}
              onUserChange={setUser}
            />
          )}
          {activeTab === "notifications" && (
            <NotificationsView
              notifications={notifications}
              unreadCount={unreadCount}
              onBack={() => changeTab(returnTab)}
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

        {exerciseSheetId !== null && byId.get(exerciseSheetId) && (
          <ExerciseSheet exercise={byId.get(exerciseSheetId)!} logs={logs} onClose={() => setExerciseSheetId(null)} />
        )}

        {(replayOnboarding || (!user.onboardingCompleted && !onboardingDismissed.current)) && (
          <Onboarding
            goal={preferences.goal}
            hasPlan={savedDays.length > 0}
            user={user}
            onFinish={finishOnboarding}
            onGoalChange={changeOnboardingGoal}
          />
        )}
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
              placeholder={isRegister ? "8+ com número e símbolo" : "Sua senha"}
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
                    Registro no CREF (Conselho Regional de Educação Física). Ele aparece nas suas avaliações de treino.
                  </p>
                </div>
                <div className="grid grid-cols-[1fr_96px] gap-3">
                  <AuthInput
                    label="Número do CREF"
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
                  label="Especialidade ou área de atuação"
                  onChange={(specialty) => onFormChange({ ...authForm, specialty })}
                  placeholder="Ex.: Musculação e hipertrofia"
                  value={authForm.specialty}
                />
                <AuthInput
                  label="Formação acadêmica"
                  onChange={(education) => onFormChange({ ...authForm, education })}
                  placeholder="Ex.: Bacharelado em Educação Física"
                  value={authForm.education}
                />
                <p className="text-xs leading-relaxed text-white/50">
                  Sua conta e criada na hora e você já pode usar o app. As funções profissionais, como avaliar
                  treinos, são liberadas depois que o administrador conferir o seu CREF.
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
                    Política de Privacidade
                  </a>{" "}
                  e autorizo o uso dos meus dados de saúde (altura, peso e medidas) para acompanhar minha evolução.
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
              {!isRegister ? "Entrar" : isProfessional ? "Criar conta e enviar solicitação" : "Criar e entrar"}
            </button>
          </form>

          {isRegister && (
            <p className="mt-5 text-xs leading-relaxed text-white/50">
              A senha precisa ter letra maiúscula, minúscula, número, símbolo e pelo menos 8 caracteres.
            </p>
          )}
        </section>

        <a className="mt-6 text-center text-xs font-medium text-white/45 transition hover:text-white/80" href="/privacidade">
          Política de Privacidade
        </a>
      </main>
    </div>
  );
}

const accountTypeOptions: Array<{ id: AccountType; label: string; description: string }> = [
  {
    id: "USER",
    label: "Usuário comum",
    description: "Organize seus treinos e acompanhe sua rotina."
  },
  {
    id: "PROFESSIONAL",
    label: "Profissional de Educação Física",
    description: "Formado e registrado no CREF. Usa o app e também avalia treinos."
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

function formatPrescription(item: { sets: number; reps: string }) {
  return item.reps.endsWith("min") ? item.reps : `${item.sets} × ${item.reps}`;
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
            <p className="text-xs text-white/45">Olá,</p>
            <h1 className="truncate text-lg font-semibold leading-tight">{firstName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            aria-current={notificationsOpen ? "page" : undefined}
            className={`relative ${notificationsOpen ? "text-accent" : ""}`}
            label={unreadCount ? `Notificações, ${unreadCount} não lidas` : "Notificações"}
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
  onStartSession: (dayId: string) => void;
};

function HomeView({ selectedWorkout, byId, groupSummary, savedPlan, onOpenPlan, onOpenBuilder, onStartSession }: HomeViewProps) {
  const totalGroups = Object.keys(groupSummary).length;
  const weeklySets = Object.values(savedPlan.coverage).reduce((total, amount) => total + amount, 0);
  const weeklyMinutes = savedPlan.days.reduce((total, day) => total + (Number.parseInt(day.duration, 10) || 0), 0);
  const planStats = [
    { label: "Treinos", value: savedPlan.days.length, helper: "por semana" },
    {
      label: "Exercícios",
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
          onStart={() => onStartSession(selectedWorkout.id)}
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
      <h3 className="mt-2 text-lg font-semibold">Você ainda não tem um plano</h3>
      <p className="mt-1 text-sm leading-relaxed text-white/55">
        Escolha objetivo, nível e dias na aba Montar para gerar a sua semana de treino.
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
  onStart: () => void;
};

function TodayWorkout({ workout, byId, notes, weeklySets, onOpenPlan, onStart }: TodayWorkoutProps) {
  return (
    <section className="glass-strong rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-accent">Treino de hoje · {workout.label}</p>
        <span className="text-xs text-white/45">{workout.intensity}</span>
      </div>
      <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{workout.focus}</h2>
      <p className="mt-1 text-sm tabular-nums text-white/55">
        {workout.duration} · {workout.exercises.length} exercícios · {weeklySets} séries na semana
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
                {formatPrescription(item)}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-xs leading-relaxed text-white/45">{notes[0]}</p>

      <button
        className="btn-primary mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
        onClick={onStart}
        type="button"
      >
        <Play size={16} fill="currentColor" />
        Começar treino
      </button>
      <button
        className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-white/70 transition hover:bg-white/[0.04] hover:text-white"
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
  byId: Map<number, Exercise>;
  hasSavedPlan: boolean;
  saving: boolean;
  onChange: (preferences: GeneratorPreferences) => void;
  onFavoriteToggle: (exerciseId: number) => void;
  onSavePlan: () => void;
};

const builderSteps = [
  { title: "Seu objetivo", description: "O que você quer alcançar e há quanto tempo treina." },
  { title: "Sua rotina", description: "Quantos dias e quanto tempo você tem para treinar." },
  { title: "Equipamentos e favoritos", description: "Opcional: ajuste ao que você tem disponível." },
  { title: "Revise e salve", description: "Confira a semana montada antes de salvar." }
];

const goalDescriptions: Record<GeneratorPreferences["goal"], string> = {
  hipertrofia: "Ganhar massa muscular",
  forca: "Levantar mais peso",
  emagrecimento: "Perder gordura, com cardio no treino",
  saude: "Condicionamento e bem-estar"
};

const levelDescriptions: Record<GeneratorPreferences["level"], string> = {
  iniciante: "Treina há menos de 6 meses",
  intermediario: "Treina de 6 meses a 2 anos",
  avancado: "Treina há mais de 2 anos"
};

const presetDescriptions: Record<GeneratorPreferences["planPreset"], string> = {
  livre: "O app escolhe a melhor divisão para os seus dias",
  "full-body": "Todos os grupos em cada treino, alternando A, B e C",
  abc: "A: peito e tríceps · B: costas e bíceps · C: pernas e ombros",
  abcd: "A: peito e tríceps · B: costas e bíceps · C: pernas · D: ombros",
  abcde: "Um grupo por dia: peito, costas, pernas, ombros e braços",
  ppl: "Empurrar, puxar e pernas em dias separados",
  "superiores-inferiores": "Alterna parte de cima e parte de baixo do corpo",
  peito: "Mais volume para o peitoral",
  costas: "Mais volume para as costas",
  pernas: "Mais volume para as pernas",
  gluteos: "Mais volume para glúteos e posteriores",
  bracos: "Mais volume para bíceps e tríceps",
  funcional: "Exercícios funcionais e cardio para condicionamento"
};

const presetOrder: GeneratorPreferences["planPreset"][] = [
  "livre",
  "full-body",
  "abc",
  "abcd",
  "ppl",
  "superiores-inferiores",
  "abcde",
  "peito",
  "costas",
  "pernas",
  "gluteos",
  "bracos",
  "funcional"
];

const visiblePresetCount = 6;
const visibleFavoriteCount = 6;
const dayPresets = [2, 3, 4, 5, 6];
const minutePresets = [30, 45, 60, 90];

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function BuilderView({
  exercises,
  equipment,
  favoriteExercises,
  preferences,
  generatedPlan,
  byId,
  hasSavedPlan,
  saving,
  onChange,
  onFavoriteToggle,
  onSavePlan
}: BuilderViewProps) {
  const [step, setStep] = useState(0);
  const isLastStep = step === builderSteps.length - 1;
  const suggestedFavorites = exercises
    .filter((exercise) => ["Peito", "Costas", "Quadríceps", "Glúteos", "Abdômen"].includes(exercise.grupoMuscular))
    .slice(0, 6);
  const [showAllPresets, setShowAllPresets] = useState(
    () => presetOrder.indexOf(preferences.planPreset) >= visiblePresetCount
  );
  const visiblePresets = showAllPresets ? presetOrder : presetOrder.slice(0, visiblePresetCount);
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const favoriteList = favoriteExercises.length
    ? showAllFavorites
      ? favoriteExercises
      : favoriteExercises.slice(0, visibleFavoriteCount)
    : suggestedFavorites;
  const goalLabel = generatorOptions.goals.find((goal) => goal.id === preferences.goal)?.label ?? "";

  const update = (patch: Partial<GeneratorPreferences>) => onChange({ ...preferences, ...patch });

  const toggleEquipment = (item: string) => {
    const nextEquipment = preferences.availableEquipment.includes(item)
      ? preferences.availableEquipment.filter((equipmentItem) => equipmentItem !== item)
      : [...preferences.availableEquipment, item];

    update({ availableEquipment: nextEquipment.length ? nextEquipment : ["Peso corporal"] });
  };

  function goTo(nextStep: number) {
    setStep(nextStep);
    window.scrollTo({ top: 0 });
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-white/45">
          Passo {step + 1} de {builderSteps.length}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">{builderSteps[step].title}</h2>
        <p className="mt-1 text-sm text-white/55">{builderSteps[step].description}</p>
        <div className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {builderSteps.map((item, index) => (
            <span
              key={item.title}
              className={`h-1 rounded-full transition ${index <= step ? "bg-accent" : "bg-white/10"}`}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <>
          <BuilderSection title="Qual é o seu objetivo?">
            <div className="grid grid-cols-2 gap-2">
              {generatorOptions.goals.map((goal) => (
                <OptionCard
                  key={goal.id}
                  active={preferences.goal === goal.id}
                  description={goalDescriptions[goal.id]}
                  label={goal.label}
                  onClick={() => update({ goal: goal.id })}
                />
              ))}
            </div>
          </BuilderSection>
          <BuilderSection title="Qual é o seu nível?">
            <div className="space-y-2">
              {generatorOptions.levels.map((level) => (
                <OptionCard
                  key={level.id}
                  active={preferences.level === level.id}
                  description={levelDescriptions[level.id]}
                  label={level.label}
                  onClick={() => update({ level: level.id })}
                />
              ))}
            </div>
          </BuilderSection>
        </>
      )}

      {step === 1 && (
        <>
          <BuilderSection title="Quantos dias por semana?">
            <div className="grid grid-cols-5 gap-2">
              {dayPresets.map((days) => (
                <ChipButton
                  key={days}
                  active={preferences.daysPerWeek === days}
                  label={`${days}`}
                  onClick={() => update({ daysPerWeek: days })}
                />
              ))}
            </div>
            <CustomNumberField
              key={`dias-${dayPresets.includes(preferences.daysPerWeek)}`}
              label="Outro número de dias"
              max={7}
              min={1}
              presets={dayPresets}
              unit="dias"
              value={preferences.daysPerWeek}
              onChange={(daysPerWeek) => update({ daysPerWeek })}
            />
          </BuilderSection>
          <BuilderSection title="Quanto tempo por treino?">
            <div className="grid grid-cols-4 gap-2">
              {minutePresets.map((minutes) => (
                <ChipButton
                  key={minutes}
                  active={preferences.minutesPerSession === minutes}
                  label={formatDuration(minutes)}
                  onClick={() => update({ minutesPerSession: minutes })}
                />
              ))}
            </div>
            <CustomNumberField
              key={`minutos-${minutePresets.includes(preferences.minutesPerSession)}`}
              hint="Ex.: 75 para 1h15. Mais tempo, mais exercícios por dia."
              label="Outro tempo"
              max={180}
              min={15}
              presets={minutePresets}
              unit="minutos"
              value={preferences.minutesPerSession}
              onChange={(minutesPerSession) => update({ minutesPerSession })}
            />
          </BuilderSection>
          <BuilderSection title="Como dividir os treinos?">
            {preferences.daysPerWeek === 1 && (
              <p className="-mt-1 mb-3 rounded-xl border border-white/[0.08] px-3 py-2.5 text-xs leading-relaxed text-white/60">
                Com 1 dia por semana o treino é sempre de corpo inteiro, para não deixar nenhum grupo de fora.
              </p>
            )}
            <div className="space-y-2">
              {visiblePresets.map((presetId) => (
                <OptionCard
                  key={presetId}
                  active={preferences.planPreset === presetId}
                  description={presetDescriptions[presetId]}
                  label={
                    presetId === "livre"
                      ? "Automática (recomendado)"
                      : generatorOptions.presets.find((preset) => preset.id === presetId)?.label ?? presetId
                  }
                  onClick={() => update({ planPreset: presetId })}
                />
              ))}
            </div>
            {!showAllPresets && (
              <button
                className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-white/70 transition hover:bg-white/[0.04] hover:text-white"
                onClick={() => setShowAllPresets(true)}
                type="button"
              >
                Ver mais divisões ({presetOrder.length - visiblePresetCount})
                <ChevronDown size={16} />
              </button>
            )}
          </BuilderSection>
        </>
      )}

      {step === 2 && (
        <>
          <BuilderSection title="Onde você treina?">
            <div className="flex flex-wrap gap-2">
              {[...generatorOptions.equipment, ...equipment.filter((item) => !generatorOptions.equipment.includes(item))].map(
                (item) => (
                  <button
                    key={item}
                    aria-pressed={preferences.availableEquipment.includes(item)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      preferences.availableEquipment.includes(item)
                        ? "chip-active"
                        : "border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white"
                    }`}
                    onClick={() => toggleEquipment(item)}
                    type="button"
                  >
                    {item}
                  </button>
                )
              )}
            </div>
            <p className="mt-2 text-xs text-white/45">O treino só usa exercícios com o que você marcar.</p>
          </BuilderSection>
          <BuilderSection title="Exercícios favoritos">
            <p className="-mt-1 mb-2 text-xs leading-relaxed text-white/45">
              Os marcados entram primeiro no seu treino. Você pode favoritar outros na aba Exercícios.
            </p>
            <div className="divide-y divide-white/[0.06]">
              {favoriteList.map((exercise) => (
                <FavoriteRow
                  key={exercise.id}
                  exercise={exercise}
                  active={preferences.favoriteExerciseIds.includes(exercise.id)}
                  onToggle={() => onFavoriteToggle(exercise.id)}
                />
              ))}
            </div>
            {favoriteExercises.length > visibleFavoriteCount && (
              <button
                className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-white/70 transition hover:bg-white/[0.04] hover:text-white"
                onClick={() => setShowAllFavorites((visible) => !visible)}
                type="button"
              >
                {showAllFavorites ? "Mostrar menos" : `Ver todos os favoritos (${favoriteExercises.length})`}
                <ChevronDown size={16} className={showAllFavorites ? "rotate-180" : ""} />
              </button>
            )}
          </BuilderSection>
        </>
      )}

      {step === 3 && (
        <>
          <section className="glass-strong rounded-2xl p-5">
            <p className="text-xs font-medium text-accent">Seu treino</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              {generatedPlan.days.length} {generatedPlan.days.length === 1 ? "treino" : "treinos"} por semana
            </h3>
            <p className="mt-1 text-sm text-white/55">
              {goalLabel} · {levelDescriptions[preferences.level].toLowerCase()} · {formatDuration(preferences.minutesPerSession)} por
              treino
            </p>
            {hasSavedPlan && (
              <p className="mt-3 text-xs leading-relaxed text-white/50">
                Ao salvar, este treino substitui o que está na aba Treino.
              </p>
            )}
          </section>

          <div className="space-y-3">
            {generatedPlan.days.map((day) => (
              <article key={day.id} className="glass rounded-2xl p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="text-[15px] font-semibold">
                    <span className="mr-2 text-accent">{day.label}</span>
                    {day.focus}
                  </h4>
                  <span className="shrink-0 text-xs text-white/45">{day.duration}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {day.exercises.map((item) => (
                    <li key={item.exerciseId} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-white/80">{byId.get(item.exerciseId)?.nome}</span>
                      <span className="shrink-0 tabular-nums text-white/45">
                        {formatPrescription(item)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <section className="border-t border-white/[0.07] pt-5">
            <h3 className="text-sm font-medium text-white/80">Grupos trabalhados na semana</h3>
            <p className="mb-4 text-xs text-white/45">Total de séries por grupo muscular.</p>
            <GroupBars groupSummary={generatedPlan.coverage} />
            <ul className="mt-5 space-y-2 border-l border-white/10 pl-3">
              {generatedPlan.notes.map((note) => (
                <li key={note} className="text-xs leading-relaxed text-white/55">
                  {note}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div className="glass-nav sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-10 rounded-2xl p-3">
        <p className="mb-2 text-center text-xs text-white/50">
          {generatedPlan.days.length} {generatedPlan.days.length === 1 ? "dia" : "dias"} · {formatDuration(preferences.minutesPerSession)} · {goalLabel}
        </p>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button
            className="h-11 rounded-xl border border-white/10 px-4 text-sm font-medium text-white/80 transition hover:bg-white/[0.05] disabled:opacity-40"
            disabled={step === 0 || saving}
            onClick={() => goTo(step - 1)}
            type="button"
          >
            Voltar
          </button>
          {isLastStep ? (
            <button
              className="btn-primary flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold"
              disabled={saving || !generatedPlan.days.length}
              onClick={onSavePlan}
              type="button"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {saving ? "Salvando treino" : "Salvar treino"}
            </button>
          ) : (
            <button
              className="btn-primary flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] font-semibold"
              onClick={() => goTo(step + 1)}
              type="button"
            >
              {step === builderSteps.length - 2 ? "Ver meu treino" : "Próximo"}
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function BuilderSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-medium text-white/85">{title}</h3>
      {children}
    </section>
  );
}

function OptionCard({
  active,
  label,
  description,
  onClick
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99] ${
        active ? "chip-active" : "border-white/[0.08] hover:border-white/20"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${active ? "border-accent" : "border-white/30"}`}
      >
        {active && <span className="size-2 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight text-white">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-white/50">{description}</span>
      </span>
    </button>
  );
}

function CustomNumberField({
  label,
  hint,
  min,
  max,
  unit,
  presets,
  value,
  onChange
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  unit: string;
  presets: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(presets.includes(value) ? "" : String(value));
  const parsed = Number(text);
  const invalid = text !== "" && (!Number.isInteger(parsed) || parsed < min || parsed > max);
  const custom = text !== "" && !invalid;

  return (
    <label className="mt-3 block">
      <span className="mb-1.5 block text-xs text-white/55">{label}</span>
      <span
        className={`glass-field flex h-11 items-center gap-2 rounded-xl px-3 ${custom ? "border-accent/50" : ""} ${
          invalid ? "border-red-400/50" : ""
        }`}
      >
        <input
          className="w-full min-w-0 bg-transparent text-[15px] tabular-nums text-white outline-none placeholder:text-white/35"
          inputMode="numeric"
          max={max}
          min={min}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 3);
            setText(next);
            const number = Number(next);

            if (next !== "" && number >= min && number <= max) {
              onChange(number);
            }
          }}
          placeholder={`De ${min} a ${max}`}
          type="text"
          value={text}
        />
        <span className="shrink-0 text-sm text-white/45">{unit}</span>
      </span>
      {invalid ? (
        <span className="mt-1.5 block text-xs text-red-300" role="alert">
          Digite um valor de {min} a {max}.
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-white/45">{hint}</span>
      )}
    </label>
  );
}

function ChipButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={`h-11 rounded-xl border text-sm font-medium tabular-nums transition active:scale-[0.98] ${
        active ? "chip-active" : "border-white/[0.08] text-white/65 hover:border-white/20 hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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
  onRemoveDay: (dayId: string) => Promise<void>;
  onClearPlan: () => Promise<boolean>;
  exercises: Exercise[];
  onOpenExercise: (exerciseId: number) => void;
  onSaveDay: (dayId: string, payload: EditorPayload) => Promise<string | null>;
  onStartSession: (dayId: string) => void;
};

function PlanView({
  selectedDay,
  activeDayId,
  byId,
  plan,
  savedPlan,
  onSelectDay,
  onOpenBuilder,
  onRemoveDay,
  onClearPlan,
  exercises,
  onOpenExercise,
  onSaveDay,
  onStartSession
}: PlanViewProps) {
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  async function handleClear() {
    setClearing(true);
    const cleared = await onClearPlan();

    if (!cleared) {
      setClearing(false);
    }
  }

  async function handleRemoveDay(dayId: string) {
    setRemoving(true);
    await onRemoveDay(dayId);
    setRemoving(false);
    setConfirmRemoveId(null);
  }

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
        <div className="flex items-center gap-1">
          <IconButton label="Ajustar treino" className="text-accent" onClick={onOpenBuilder}>
            <Plus size={20} />
          </IconButton>
          <button
            aria-label="Limpar treino"
            className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium text-red-300/90 transition hover:bg-red-500/10"
            onClick={() => setConfirmingClear(true)}
            title="Limpar treino"
            type="button"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {confirmingClear && (
        <ConfirmPanel
          busy={clearing}
          confirmLabel="Apagar treino"
          description="Todos os dias da sua semana serão removidos. Seu histórico e suas preferências do gerador continuam salvos, e você pode montar um novo treino quando quiser."
          title={"Limpar treino"}
          onCancel={() => setConfirmingClear(false)}
          onConfirm={() => void handleClear()}
        />
      )}

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(plan.length, 4)}, minmax(0, 1fr))` }}>
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

      {editingDayId === selectedDay.id ? (
        <WorkoutEditor
          byId={byId}
          day={selectedDay}
          exercises={exercises}
          onCancel={() => setEditingDayId(null)}
          onSave={async (payload) => {
            const message = await onSaveDay(selectedDay.id, payload);

            if (!message) {
              setEditingDayId(null);
            }

            return message;
          }}
        />
      ) : (
        <section className="glass-strong rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold leading-tight tracking-tight">{selectedDay.focus}</h3>
              <p className="mt-1 text-sm text-white/55">
                {selectedDay.duration} · {selectedDay.exercises.length} exercícios
              </p>
            </div>
            <Badge tone={selectedDay.intensity === "Forte" ? "green" : "muted"}>{selectedDay.intensity}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className="btn-primary col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
              onClick={() => onStartSession(selectedDay.id)}
              type="button"
            >
              <Play size={16} fill="currentColor" />
              Começar treino
            </button>
            <button
              className="flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 px-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.05]"
              onClick={() => setEditingDayId(selectedDay.id)}
              type="button"
            >
              <Pencil size={16} />
              Editar dia
            </button>
            <button
              className="flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-red-300/90 transition hover:bg-red-500/10"
              aria-label="Remover dia"
              onClick={() => setConfirmRemoveId(selectedDay.id)}
              title="Remover dia"
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {confirmRemoveId === selectedDay.id && (
            <div className="mt-4">
              <ConfirmPanel
                busy={removing}
                confirmLabel="Remover dia"
                description="Esse dia sai da sua semana. Os outros dias do treino continuam iguais."
                title={"Remover dia de treino"}
                onCancel={() => setConfirmRemoveId(null)}
                onConfirm={() => void handleRemoveDay(selectedDay.id)}
              />
            </div>
          )}

          <div className="mt-5 divide-y divide-white/[0.07] border-t border-white/[0.07]">
            {selectedDay.exercises.map((item, index) => {
              const exercise = byId.get(item.exerciseId);

              return (
                <article key={`${selectedDay.id}-${item.exerciseId}`} className="py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="w-5 shrink-0 text-sm tabular-nums text-white/35">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <button
                        className="block max-w-full truncate text-left text-[15px] font-medium underline-offset-4 hover:underline"
                        onClick={() => onOpenExercise(item.exerciseId)}
                        type="button"
                      >
                        {exercise?.nome}
                      </button>
                      <p className="text-xs text-white/45">
                        {exercise?.equipamento} · {exercise?.grupoMuscular}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 pl-8">
                    <MiniStat label="Séries" value={String(item.sets)} />
                    <MiniStat label="Reps" value={item.reps} />
                    <MiniStat label="Pausa" value={item.rest} />
                  </div>
                  {item.note && <p className="mt-2 pl-8 text-xs text-accent">{item.note}</p>}
                </article>
              );
            })}
          </div>
        </section>
      )}

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
  listKey,
  favoriteExerciseIds,
  onQueryChange,
  onGroupChange,
  onFavoriteToggle,
  onOpenExercise
}: {
  exercises: Exercise[];
  groups: string[];
  selectedGroup: string;
  query: string;
  listKey: string;
  favoriteExerciseIds: number[];
  onQueryChange: (query: string) => void;
  onGroupChange: (group: string) => void;
  onFavoriteToggle: (exerciseId: number) => void;
  onOpenExercise: (exerciseId: number) => void;
}) {
  const favorites = useMemo(() => new Set(favoriteExerciseIds), [favoriteExerciseIds]);
  const { visible, hasMore, loadMore, sentinelRef, total } = useIncrementalList(exercises, listKey);

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-white/45">Biblioteca</p>
        <h2 className="text-2xl font-semibold tracking-tight">Exercícios</h2>
      </div>

      <label className="glass-field flex items-center gap-3 rounded-xl px-4 py-3">
        <Search size={18} className="text-white/40" />
        <input
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-white/40"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar exercício"
          value={query}
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {groups.map((group) => (
          <button
            key={group}
            aria-pressed={group === selectedGroup}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              group === selectedGroup ? "chip-active" : "border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white"
            }`}
            onClick={() => onGroupChange(group)}
            type="button"
          >
            {group === favoritesFilter && <Heart size={14} fill="currentColor" className="text-accent" />}
            {group}
            {group === favoritesFilter && <span className="tabular-nums text-white/50">{favoriteExerciseIds.length}</span>}
          </button>
        ))}
      </div>

      {total > 0 && (
        <p aria-live="polite" className="-mb-2 text-xs text-white/45">
          {total} {total === 1 ? "exercício" : "exercícios"}
        </p>
      )}

      {selectedGroup !== favoritesFilter && total === 0 && (
        <p className="rounded-2xl border border-white/[0.07] p-5 text-center text-sm text-white/55">Nenhum exercício encontrado.</p>
      )}

      {selectedGroup === favoritesFilter && total === 0 && (
        <p className="rounded-2xl border border-white/[0.07] p-5 text-center text-sm leading-relaxed text-white/55">
          {favoriteExerciseIds.length
            ? "Nenhum favorito com esse nome."
            : "Você ainda não favoritou nenhum exercício. Toque no coração ao lado de um exercício para salva-lo aqui."}
        </p>
      )}

      <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {visible.map((exercise) => (
          <article key={exercise.id} className="flex items-center gap-3 py-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => onOpenExercise(exercise.id)} type="button">
              <span className="block truncate text-[15px] font-medium">{exercise.nome}</span>
              <span className="block text-xs text-white/45">
                {exercise.grupoMuscular} · {exercise.equipamento}
              </span>
            </button>
            <button
              aria-label={`Favoritar ${exercise.nome}`}
              className={`grid size-10 shrink-0 place-items-center rounded-full transition hover:bg-white/[0.06] ${
                favorites.has(exercise.id) ? "text-accent" : "text-white/35 hover:text-white/70"
              }`}
              onClick={() => onFavoriteToggle(exercise.id)}
              type="button"
            >
              <Heart size={17} fill={favorites.has(exercise.id) ? "currentColor" : "none"} />
            </button>
          </article>
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center">
          <button
            className="h-10 rounded-xl px-4 text-sm font-medium text-white/65 transition hover:bg-white/[0.04] hover:text-white"
            onClick={loadMore}
            type="button"
          >
            Carregar mais
          </button>
        </div>
      )}
    </section>
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
  byId,
  logs,
  metrics,
  savedPlan,
  user,
  onAddMetric,
  onDeleteAccount,
  onDeleteLog,
  onReplayOnboarding,
  onUpdateProfile,
  onUserChange
}: {
  authToken: string;
  byId: Map<number, Exercise>;
  logs: ApiWorkoutLog[];
  metrics: ApiBodyMetric[];
  savedPlan: GeneratedPlan;
  user: AuthUser;
  onAddMetric: (payload: { weightKg: number; bodyFat?: number }) => Promise<string | null>;
  onDeleteAccount: (password: string) => Promise<string | null>;
  onDeleteLog: (logId: string) => Promise<boolean>;
  onReplayOnboarding: () => void;
  onUpdateProfile: (payload: { name: string; heightCm: number | null }) => Promise<string | null>;
  onUserChange: (user: AuthUser) => void;
}) {
  const weeklySets = Object.values(savedPlan.coverage).reduce((total, amount) => total + amount, 0);
  const setsPerDay = savedPlan.days.map((day) => ({
    id: day.id,
    label: day.label,
    sets: day.exercises.reduce((total, exercise) => total + exercise.sets, 0)
  }));
  const maxDaySets = Math.max(1, ...setsPerDay.map((day) => day.sets));

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-white/45">Evolução</p>
        <h2 className="text-2xl font-semibold tracking-tight">Progresso</h2>
      </div>

      <TrainingSummary logs={logs} />
      <LoadProgress byId={byId} logs={logs} />
      <BodySection currentWeight={user.weightKg} heightCm={user.heightCm} metrics={metrics} onAdd={onAddMetric} />
      <HistoryList byId={byId} logs={logs} onDelete={onDeleteLog} />

      <section className="border-t border-white/[0.07] pt-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-white/80">Seu plano</h3>
          <span className="text-xs tabular-nums text-white/45">{weeklySets} séries por semana</span>
        </div>
        {savedPlan.days.length ? (
          <>
            <p className="mt-3 text-xs text-white/45">Séries por dia</p>
            <div className="mt-2 flex items-end gap-2">
              {setsPerDay.map((day) => (
                <div key={day.id} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-2.5 items-end rounded-full bg-white/[0.06]">
                    <div className="bar-fill w-full rounded-full" style={{ height: `${(day.sets / maxDaySets) * 100}%` }} />
                  </div>
                  <span className="mt-1 text-xs font-medium tabular-nums">{day.sets}</span>
                  <span className="text-[11px] text-white/45">{day.label}</span>
                </div>
              ))}
            </div>
            <p className="mb-3 mt-5 text-xs text-white/45">Mapa muscular</p>
            <GroupBars groupSummary={savedPlan.coverage} />
          </>
        ) : (
          <p className="mt-2 text-sm text-white/55">Monte um treino para ver a distribuição da semana.</p>
        )}
      </section>

      <AccountSection
        authToken={authToken}
        user={user}
        onDeleteAccount={onDeleteAccount}
        onReplayOnboarding={onReplayOnboarding}
        onUpdateProfile={onUpdateProfile}
        onUserChange={onUserChange}
      />
    </section>
  );
}

function ProfileEditor({
  user,
  onCancel,
  onSave
}: {
  user: AuthUser;
  onCancel: () => void;
  onSave: (payload: { name: string; heightCm: number | null }) => Promise<string | null>;
}) {
  const [name, setName] = useState(user.name);
  const [height, setHeight] = useState(user.heightCm ? String(user.heightCm) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const heightCm = height.trim() ? Number(height.replace(",", ".")) : null;

    if (name.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }

    if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250)) {
      setError("Informe a altura em centímetros, entre 100 e 250.");
      return;
    }

    setSaving(true);
    const message = await onSave({ name: name.trim(), heightCm });
    setSaving(false);

    if (message) {
      setError(message);
      return;
    }

    onCancel();
  }

  return (
    <form className="mt-3 space-y-3 rounded-xl border border-white/[0.08] p-4" onSubmit={submit}>
      <label className="block">
        <span className="mb-1 block text-xs text-white/55">Nome</span>
        <input
          className="glass-field h-10 w-full rounded-lg px-3 text-[15px] text-white outline-none"
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-white/55">Altura (cm)</span>
        <input
          className="glass-field h-10 w-full rounded-lg px-3 text-[15px] tabular-nums text-white outline-none placeholder:text-white/30"
          inputMode="numeric"
          onChange={(event) => setHeight(event.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
          placeholder="Ex.: 175"
          value={height}
        />
      </label>
      <p className="text-xs text-white/45">O peso e atualizado em Corpo, ao registrar uma medida.</p>
      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="h-10 rounded-xl border border-white/10 text-sm font-medium text-white/80 transition hover:bg-white/[0.05]"
          disabled={saving}
          onClick={onCancel}
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
              <dt className="text-white/45">Formação</dt>
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
              ? "Enviar nova solicitação com outro CREF"
              : "Sou profissional de Educação Física"}
          </button>
        ))}
    </div>
  );
}

function AccountSection({
  authToken,
  user,
  onDeleteAccount,
  onReplayOnboarding,
  onUpdateProfile,
  onUserChange
}: {
  authToken: string;
  user: AuthUser;
  onDeleteAccount: (password: string) => Promise<string | null>;
  onReplayOnboarding: () => void;
  onUpdateProfile: (payload: { name: string; heightCm: number | null }) => Promise<string | null>;
  onUserChange: (user: AuthUser) => void;
}) {
  const email = user.email;
  const [editingProfile, setEditingProfile] = useState(false);
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
      <p className="mt-1 truncate text-sm text-white/55">
        {user.name} · {email}
      </p>
      {editingProfile ? (
        <ProfileEditor user={user} onCancel={() => setEditingProfile(false)} onSave={onUpdateProfile} />
      ) : (
        <button
          className="mt-2 block text-sm text-white/70 underline underline-offset-4 transition hover:text-white"
          onClick={() => setEditingProfile(true)}
          type="button"
        >
          Editar perfil
        </button>
      )}
      <ProfessionalSection authToken={authToken} user={user} onUserChange={onUserChange} />
      <a
        className="mt-4 block text-sm text-white/70 underline underline-offset-4 transition hover:text-white"
        href="/privacidade"
        target="_blank"
      >
        Política de Privacidade
      </a>
      <button
        className="mt-3 block text-sm text-white/70 underline underline-offset-4 transition hover:text-white"
        onClick={onReplayOnboarding}
        type="button"
      >
        Ver introdução do app
      </button>

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
            Isso apaga definitivamente sua conta, seus planos, seu histórico e suas medidas. Não tem volta.
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
              {/* Fonte no span: o "button { font: inherit }" global anula classes de fonte no botão. */}
              <span className="max-w-full truncate text-[11px] leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
