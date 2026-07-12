"use client";

import { Eye, EyeOff, KeyRound, Loader2, LogOut, Mail, Menu, UserPlus, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";

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

export function CoreUpApp() {
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

        <main className="flex-1 px-4 pb-8">
          <section className="grid place-items-center rounded-3xl bg-white px-5 py-12 text-center shadow-sm">
            <p className="text-sm font-bold text-stone-500">
              Sessao ativa. As telas de treino entram nos proximos passos.
            </p>
          </section>
        </main>
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
