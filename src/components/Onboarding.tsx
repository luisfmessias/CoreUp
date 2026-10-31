"use client";

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  Heart,
  Home,
  Library,
  Search,
  ShieldCheck,
  Sparkles,
  Star
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { AuthUser } from "@/lib/api-client";
import { generatorOptions, type TrainingGoal } from "@/lib/workout-generator";
import { BrandMark } from "@/components/ui/BrandMark";

export type OnboardingDestination = "builder" | "plan" | "home";

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  visual: (active: boolean) => ReactNode;
};

const goalDescriptions: Record<TrainingGoal, string> = {
  hipertrofia: "Ganhar massa muscular",
  forca: "Levantar mais peso",
  emagrecimento: "Perder gordura",
  saude: "Condicionamento e bem-estar"
};

export function Onboarding({
  user,
  goal,
  hasPlan,
  onGoalChange,
  onFinish
}: {
  user: AuthUser;
  goal: TrainingGoal;
  hasPlan: boolean;
  onGoalChange: (goal: TrainingGoal) => void;
  onFinish: (destination: OnboardingDestination) => void;
}) {
  const slides = buildSlides(user);
  const total = slides.length + 1;
  const [current, setCurrent] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isLast = current === total - 1;

  const goTo = (index: number) => setCurrent(Math.min(Math.max(index, 0), total - 1));

  useEffect(() => {
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setCurrent((index) => Math.min(index + 1, total - 1));
      if (event.key === "ArrowLeft") setCurrent((index) => Math.max(index - 1, 0));
      if (event.key === "Escape") onFinish("home");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [total, onFinish]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStart.current = event.clientX;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (pointerStart.current === null) {
      return;
    }

    const distance = event.clientX - pointerStart.current;
    pointerStart.current = null;

    if (Math.abs(distance) > 50) {
      goTo(current + (distance < 0 ? 1 : -1));
    }
  }

  return (
    <div
      ref={dialogRef}
      aria-label="Introducao ao CoreUp"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-center bg-ink bg-[radial-gradient(42rem_22rem_at_50%_-8rem,rgba(124,198,160,0.12),transparent_70%)] focus:outline-none"
      role="dialog"
      tabIndex={-1}
    >
      <div className="flex h-dvh w-full max-w-[430px] flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {Array.from({ length: total }, (_, index) => (
              <span
                key={index}
                className={`h-1 rounded-full transition-colors duration-300 ${index <= current ? "bg-accent" : "bg-white/10"}`}
              />
            ))}
          </div>
          <button
            className={`h-9 rounded-full px-3 text-sm font-medium text-white/60 transition hover:text-white ${isLast ? "invisible" : ""}`}
            onClick={() => onFinish("home")}
            type="button"
          >
            Pular
          </button>
        </div>

        <div
          className="relative mt-4 flex-1 touch-pan-y overflow-hidden"
          onPointerCancel={() => (pointerStart.current = null)}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {slides.map((slide, index) => (
              <section
                key={slide.id}
                aria-hidden={index !== current}
                className="flex h-full w-full shrink-0 flex-col overflow-y-auto"
                inert={index !== current}
              >
                <div className="grid min-h-[260px] flex-1 place-items-center py-4">
                  <div key={String(index === current)} className="w-full">
                    {slide.visual(index === current)}
                  </div>
                </div>
                <div aria-live={index === current ? "polite" : undefined} className="pb-2">
                  <p className="text-xs font-medium text-accent">{slide.eyebrow}</p>
                  <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">{slide.title}</h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/65">{slide.body}</p>
                </div>
              </section>
            ))}

            <section
              aria-hidden={!isLast}
              className="flex h-full w-full shrink-0 flex-col overflow-y-auto"
              inert={!isLast}
            >
              <div className="pt-2">
                <p className="text-xs font-medium text-accent">Primeiro passo</p>
                <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">Qual e o seu objetivo principal?</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-white/65">
                  Vamos usar isso para montar o seu primeiro treino. Da para mudar quando quiser.
                </p>
              </div>
              <div aria-label="Objetivo principal" className="mt-6 grid grid-cols-2 gap-2" role="radiogroup">
                {generatorOptions.goals.map((option) => {
                  const active = goal === option.id;

                  return (
                    <button
                      key={option.id}
                      aria-checked={active}
                      className={`flex min-h-24 flex-col justify-between rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                        active ? "chip-active" : "border-white/[0.08] hover:border-white/20"
                      }`}
                      onClick={() => onGoalChange(option.id)}
                      role="radio"
                      type="button"
                    >
                      <span
                        className={`grid size-5 place-items-center rounded-full border ${
                          active ? "border-accent bg-accent text-on-accent" : "border-white/25"
                        }`}
                      >
                        {active && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span>
                        <span className="block text-[15px] font-semibold text-white">{option.label}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-white/55">{goalDescriptions[option.id]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="pt-4">
          {isLast ? (
            <div className="space-y-2">
              <button
                className="btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
                onClick={() => onFinish(hasPlan ? "plan" : "builder")}
                type="button"
              >
                {hasPlan ? "Ver meu treino" : "Montar meu treino"}
                <ArrowRight size={18} />
              </button>
              <button
                className="h-11 w-full rounded-xl text-sm font-medium text-white/65 transition hover:text-white"
                onClick={() => onFinish("home")}
                type="button"
              >
                Explorar o app primeiro
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button
                className={`h-12 rounded-xl border border-white/10 px-5 text-sm font-medium text-white/80 transition hover:bg-white/[0.05] ${
                  current === 0 ? "invisible" : ""
                }`}
                onClick={() => goTo(current - 1)}
                type="button"
              >
                Voltar
              </button>
              <button
                className="btn-primary flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold"
                onClick={() => goTo(current + 1)}
                type="button"
              >
                {current === 0 ? "Comecar" : "Proximo"}
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildSlides(user: AuthUser): Slide[] {
  const firstName = user.name.trim().split(/\s+/)[0];
  const canReview = user.accountType === "PROFESSIONAL" || user.accountType === "ADMIN";
  const requestStatus = user.professional?.status;

  const reviewsBody = canReview
    ? "Na aba Aval. voce da nota, comenta e recomenda ajustes nos treinos do app. Sua avaliacao aparece para todos os usuarios."
    : requestStatus === "PENDING"
      ? "Profissionais com CREF aprovado avaliam os treinos do app. Seu cadastro profissional esta em analise: assim que for aprovado, voce tambem podera avaliar."
      : requestStatus === "REJECTED"
        ? "Profissionais com CREF aprovado avaliam os treinos do app. Seu cadastro profissional foi rejeitado; o motivo esta na secao Conta, na aba Evol."
        : "Na aba Aval., profissionais de Educacao Fisica com CREF aprovado dao nota e comentam os treinos do app. Use isso para escolher com mais confianca.";

  return [
    {
      id: "welcome",
      eyebrow: "Bem-vindo",
      title: `Olá, ${firstName}! Este é o CoreUp`,
      body: "Seu treino da semana montado em poucos minutos, do jeito que você treina. Veja rapidinho como tudo funciona.",
      visual: () => <WelcomeVisual />
    },
    {
      id: "builder",
      eyebrow: "Aba Montar",
      title: "Monte seu treino em 4 passos",
      body: "Escolha objetivo, dias, tempo e equipamentos. O app monta a semana inteira e mostra cada exercício antes de voce salvar.",
      visual: () => <BuilderVisual />
    },
    {
      id: "plan",
      eyebrow: "Inicio e Treino",
      title: "Siga sua semana, dia a dia",
      body: "No Inicio aparece o treino de hoje. Na aba Treino ficam todos os dias, com series, repeticoes e pausa de cada exercicio.",
      visual: () => <PlanVisual />
    },
    {
      id: "library",
      eyebrow: "Aba Exercicios",
      title: "Encontre e favorite exercicios",
      body: "Busque entre mais de 200 exercicios e toque no coracao para favoritar. Os favoritos entram primeiro quando o app monta o seu treino.",
      visual: () => <LibraryVisual />
    },
    {
      id: "reviews",
      eyebrow: "Aba Aval.",
      title: canReview ? "Avalie os treinos do app" : "Treinos avaliados por profissionais",
      body: reviewsBody,
      visual: () => <ReviewVisual />
    },
    {
      id: "navigation",
      eyebrow: "Navegacao",
      title: "Tudo a um toque",
      body: "A barra de baixo leva a cada parte do app. O sino no topo mostra as suas notificacoes.",
      visual: (active) => <NavigationVisual active={active} isAdmin={user.accountType === "ADMIN"} />
    }
  ];
}

function Appear({ delay = 0, children, className = "" }: { delay?: number; children: ReactNode; className?: string }) {
  return (
    <div className={`animate-fade-up [animation-fill-mode:both] ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function MockCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-strong rounded-2xl p-4 ${className}`}>{children}</div>;
}

function WelcomeVisual() {
  const benefits = ["Treino montado para você", "Semana organizada dia a dia", "Avaliado por profissionais"];

  return (
    <div className="flex flex-col items-center gap-6">
      <Appear className="relative grid place-items-center">
        <span aria-hidden="true" className="absolute size-40 rounded-full bg-accent/15 blur-2xl" />
        <span className="relative grid size-24 place-items-center rounded-[28px] border border-white/10 bg-white/[0.04]">
          <BrandMark size={56} />
        </span>
      </Appear>
      <ul className="w-full max-w-[300px] space-y-2">
        {benefits.map((benefit, index) => (
          <Appear key={benefit} delay={150 + index * 120}>
            <li className="flex items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5 text-sm text-white/85">
              <span className="grid size-6 place-items-center rounded-full bg-accent/15 text-accent">
                <Check size={14} strokeWidth={2.5} />
              </span>
              {benefit}
            </li>
          </Appear>
        ))}
      </ul>
    </div>
  );
}

function BuilderVisual() {
  const choices = ["Hipertrofia", "4 dias", "1h"];
  const days = [
    ["Seg", "Peito, ombro e triceps"],
    ["Ter", "Costas e biceps"],
    ["Qua", "Pernas"],
    ["Qui", "Ombros e abdomen"]
  ];

  return (
    <div className="mx-auto w-full max-w-[320px] space-y-3">
      <div className="flex justify-center gap-2">
        {choices.map((choice, index) => (
          <Appear key={choice} delay={index * 140}>
            <span className="chip-active inline-flex rounded-full border px-3 py-1.5 text-sm font-medium">{choice}</span>
          </Appear>
        ))}
      </div>
      <Appear delay={480} className="flex justify-center text-white/30">
        <ArrowRight className="rotate-90" size={18} />
      </Appear>
      <Appear delay={620}>
        <MockCard>
          <p className="text-xs font-medium text-accent">Sua semana</p>
          <ul className="mt-2 space-y-2">
            {days.map(([label, focus]) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-xs text-accent">{label}</span>
                <span className="text-white/80">{focus}</span>
              </li>
            ))}
          </ul>
        </MockCard>
      </Appear>
    </div>
  );
}

function PlanVisual() {
  const rows = [
    ["Supino reto com barra", "4 × 8-12"],
    ["Desenvolvimento com halteres", "4 × 8-12"],
    ["Triceps na polia", "3 × 10-12"]
  ];

  return (
    <Appear className="mx-auto w-full max-w-[320px]">
      <MockCard>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-accent">Treino de hoje · Seg</p>
          <CalendarDays className="text-white/40" size={16} />
        </div>
        <p className="mt-2 text-lg font-semibold leading-tight">Peito, ombro e triceps</p>
        <p className="mt-0.5 text-xs text-white/50">1h · 5 exercicios</p>
        <ul className="mt-3 divide-y divide-white/[0.07] border-t border-white/[0.07]">
          {rows.map(([name, prescription], index) => (
            <Appear key={name} delay={200 + index * 140}>
              <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="truncate text-white/85">{name}</span>
                <span className="shrink-0 tabular-nums text-white/55">{prescription}</span>
              </li>
            </Appear>
          ))}
        </ul>
      </MockCard>
    </Appear>
  );
}

function LibraryVisual() {
  const rows = [
    ["Agachamento livre", "Quadriceps · Barra", true],
    ["Remada curvada", "Costas · Barra", false],
    ["Supino inclinado", "Peito · Halteres", true]
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[320px] space-y-3">
      <Appear>
        <div className="glass-field flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-white/40">
          <Search size={16} />
          Buscar exercicio
        </div>
      </Appear>
      <Appear delay={120} className="flex gap-2">
        <span className="rounded-full border border-white/[0.08] px-3 py-1 text-xs text-white/60">Todos</span>
        <span className="chip-active inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium">
          <Heart className="text-accent" fill="currentColor" size={12} />
          Favoritos
        </span>
        <span className="rounded-full border border-white/[0.08] px-3 py-1 text-xs text-white/60">Peito</span>
      </Appear>
      <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {rows.map(([name, meta, favorite], index) => (
          <Appear key={name} delay={240 + index * 120}>
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span>
                <span className="block text-sm font-medium">{name}</span>
                <span className="block text-xs text-white/45">{meta}</span>
              </span>
              <Heart
                className={favorite ? "text-accent" : "text-white/30"}
                fill={favorite ? "currentColor" : "none"}
                size={17}
              />
            </li>
          </Appear>
        ))}
      </ul>
    </div>
  );
}

function ReviewVisual() {
  return (
    <Appear className="mx-auto w-full max-w-[320px]">
      <MockCard>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Profissional de Ed. Fisica</span>
          <span className="inline-flex items-center gap-1 rounded-md border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            <BadgeCheck size={12} />
            CREF aprovado
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <Appear key={value} delay={150 + value * 90}>
              <Star className={value <= 4 ? "text-accent" : "text-white/20"} fill={value <= 4 ? "currentColor" : "none"} size={18} />
            </Appear>
          ))}
          <span className="ml-1 text-sm font-medium tabular-nums">4,0</span>
        </div>
        <Appear delay={700}>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            &ldquo;Boa divisao para hipertrofia, com os exercicios compostos no inicio de cada treino.&rdquo;
          </p>
        </Appear>
      </MockCard>
    </Appear>
  );
}

function NavigationVisual({ active, isAdmin }: { active: boolean; isAdmin: boolean }) {
  const tabs = [
    { label: "Inicio", icon: Home, caption: "Treino de hoje e resumo da semana" },
    { label: "Montar", icon: Sparkles, caption: "Crie ou refaca o seu treino" },
    { label: "Treino", icon: CalendarDays, caption: "Todos os dias da sua semana" },
    { label: "Exerc.", icon: Library, caption: "Biblioteca e favoritos" },
    { label: "Aval.", icon: BadgeCheck, caption: "Opiniao de profissionais" },
    { label: "Evol.", icon: BarChart3, caption: "Seu progresso e a sua conta" },
    ...(isAdmin ? [{ label: "Admin", icon: ShieldCheck, caption: "Aprovar cadastros profissionais" }] : [])
  ];
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    const interval = window.setInterval(() => setHighlight((index) => (index + 1) % tabs.length), 1400);
    return () => window.clearInterval(interval);
  }, [active, tabs.length]);

  const current = tabs[highlight];

  return (
    <div className="mx-auto w-full max-w-[340px] space-y-5">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-white/45">Notificacoes</span>
        <span className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-white/75">
          <Bell size={16} />
        </span>
      </div>
      <div
        className="glass-nav grid gap-0.5 rounded-full p-1.5"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            aria-label={`${tab.label}: ${tab.caption}`}
            className={`flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-full transition-colors duration-300 ${
              index === highlight ? "bg-white/[0.12] text-accent" : "text-white/50"
            }`}
            onClick={() => setHighlight(index)}
            type="button"
          >
            <tab.icon size={17} />
            <span className="max-w-full truncate text-[10px] leading-none">{tab.label}</span>
          </button>
        ))}
      </div>
      <p aria-live="polite" className="min-h-[3rem] text-center text-sm text-white/75">
        <span className="block font-semibold text-white">{current.label}</span>
        {current.caption}
      </p>
    </div>
  );
}
