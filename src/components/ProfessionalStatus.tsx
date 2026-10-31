"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { apiFetch, formatDateTime, type AuthUser, type ProfessionalInfo } from "@/lib/api-client";
import { brazilianStates, requestStatusLabels, requestStatusMessages } from "@/lib/professional";
import { Badge } from "@/components/ui/Badge";

export function ProfessionalStatusCard({
  professional,
  justSubmitted = false
}: {
  professional: ProfessionalInfo;
  justSubmitted?: boolean;
}) {
  const { status } = professional;
  const title =
    justSubmitted && status === "PENDING"
      ? "Solicitacao enviada"
      : status === "APPROVED"
        ? "Cadastro profissional aprovado"
        : status === "REJECTED"
          ? "Cadastro profissional rejeitado"
          : "Cadastro profissional em analise";

  return (
    <section
      aria-live="polite"
      className={`rounded-2xl border p-4 ${
        status === "REJECTED" ? "border-red-400/25 bg-red-500/[0.06]" : status === "APPROVED" ? "border-accent/35 bg-accent/[0.07]" : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge tone={status === "APPROVED" ? "green" : "muted"}>{requestStatusLabels[status]}</Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{requestStatusMessages[status]}</p>
      {status === "REJECTED" && (
        <p className="mt-3 rounded-xl border border-white/[0.08] px-3 py-2.5 text-sm text-white/80">
          <span className="block text-xs text-white/45">Motivo informado pelo administrador</span>
          {professional.rejectionReason || "Nenhum motivo foi informado."}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-white/45">CREF</dt>
        <dd className="tabular-nums text-white/75">
          {professional.crefNumber}/{professional.crefState}
        </dd>
        <dt className="text-white/45">Enviada em</dt>
        <dd className="text-white/75">{formatDateTime(professional.createdAt)}</dd>
        {professional.reviewedAt && (
          <>
            <dt className="text-white/45">Analisada em</dt>
            <dd className="text-white/75">{formatDateTime(professional.reviewedAt)}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

export function ProfessionalRequestForm({
  authToken,
  defaultName,
  onSubmitted,
  onCancel
}: {
  authToken: string;
  defaultName: string;
  onSubmitted: (user: AuthUser) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ fullName: defaultName, crefNumber: "", crefState: "", specialty: "", education: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.crefState) {
      setError("Selecione a UF do registro CREF.");
      return;
    }

    setSending(true);

    try {
      const response = await apiFetch(authToken, "/api/professional-requests", {
        method: "POST",
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { user?: AuthUser; error?: string; details?: Array<{ message: string }> };

      if (!response.ok || !data.user) {
        throw new Error(data.details?.[0]?.message ?? data.error ?? "Nao foi possivel enviar a solicitacao.");
      }

      onSubmitted(data.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nao foi possivel enviar a solicitacao.");
      setSending(false);
    }
  }

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/85">{label}</span>
      <input
        className="glass-field h-11 w-full rounded-xl px-3 text-[15px] text-white outline-none placeholder:text-white/35"
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        placeholder={placeholder}
        value={form[key]}
      />
    </label>
  );

  return (
    <form className="mt-4 space-y-3 rounded-xl border border-white/[0.08] p-4" onSubmit={handleSubmit}>
      <div>
        <p className="text-sm font-medium">Solicitar conta profissional</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/50">
          O administrador confere o registro no CREF antes de liberar as funcoes profissionais.
        </p>
      </div>
      {field("fullName", "Nome completo", "Como consta no registro CREF")}
      <div className="grid grid-cols-[1fr_96px] gap-3">
        {field("crefNumber", "Numero do CREF", "012345-G")}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-white/85">UF</span>
          <select
            className="glass-field h-11 w-full rounded-xl bg-transparent px-2 text-[15px] text-white outline-none [&>option]:bg-[#161a18]"
            onChange={(event) => setForm({ ...form, crefState: event.target.value })}
            value={form.crefState}
          >
            <option disabled value="">
              UF
            </option>
            {brazilianStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
      </div>
      {field("specialty", "Especialidade ou area de atuacao", "Ex.: Musculacao e hipertrofia")}
      {field("education", "Formacao academica", "Ex.: Bacharelado em Educacao Fisica")}

      {error && (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-100" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          className="h-11 rounded-xl border border-white/10 text-sm font-medium text-white/80 transition hover:bg-white/[0.05]"
          disabled={sending}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="btn-primary flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
          disabled={sending}
          type="submit"
        >
          {sending && <Loader2 className="animate-spin" size={16} />}
          Enviar solicitacao
        </button>
      </div>
    </form>
  );
}
