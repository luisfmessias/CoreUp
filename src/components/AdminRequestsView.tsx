"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiFetch, formatDateTime } from "@/lib/api-client";
import { requestStatusLabels, type RequestStatus } from "@/lib/professional";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";

type AdminRequest = {
  id: string;
  fullName: string;
  email: string | null;
  accountDeleted: boolean;
  crefNumber: string;
  crefState: string;
  specialty: string;
  education: string;
  status: RequestStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type Filter = RequestStatus | "ALL";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "PENDING", label: "Pendentes" },
  { id: "APPROVED", label: "Aprovadas" },
  { id: "REJECTED", label: "Rejeitadas" },
  { id: "ALL", label: "Todas" }
];

export function AdminRequestsView({
  authToken,
  initialRequestId,
  onChanged
}: {
  authToken: string;
  initialRequestId: string | null;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [counts, setCounts] = useState<Record<RequestStatus, number>>({ PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = filter === "ALL" ? "" : `?status=${filter}`;
      const response = await apiFetch(authToken, `/api/admin/professional-requests${query}`);

      if (!response.ok) {
        throw new Error();
      }

      const data = (await response.json()) as { requests: AdminRequest[]; counts: Record<RequestStatus, number> };
      setRequests(data.requests);
      setCounts(data.counts);
    } catch {
      setError("Nao foi possivel carregar as solicitacoes.");
    } finally {
      setLoading(false);
    }
  }, [authToken, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!initialRequestId) {
      return;
    }

    apiFetch(authToken, `/api/admin/professional-requests/${initialRequestId}`)
      .then(async (response) => (response.ok ? ((await response.json()) as { request: AdminRequest }).request : null))
      .then((request) => {
        if (request) {
          setSelected(request);
          window.scrollTo({ top: 0 });
        }
      })
      .catch(() => undefined);
  }, [authToken, initialRequestId]);

  function handleDecided(request: AdminRequest) {
    setSelected(request);
    void load();
    onChanged();
  }

  if (selected) {
    return (
      <RequestDetail
        authToken={authToken}
        request={selected}
        onBack={() => {
          setSelected(null);
          window.scrollTo({ top: 0 });
        }}
        onDecided={handleDecided}
      />
    );
  }

  const total = counts.PENDING + counts.APPROVED + counts.REJECTED;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-white/45">Administracao</p>
        <h2 className="text-2xl font-semibold tracking-tight">Cadastros profissionais</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/55">
          Confira cada registro no site do CONFEF ou do CREF do estado antes de aprovar.
        </p>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {filters.map((option) => {
          const count = option.id === "ALL" ? total : counts[option.id];

          return (
            <button
              key={option.id}
              aria-pressed={filter === option.id}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                filter === option.id ? "chip-active" : "border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white"
              }`}
              onClick={() => setFilter(option.id)}
              type="button"
            >
              {option.label} <span className="tabular-nums text-white/50">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-white/55">
          <Loader2 className="animate-spin text-accent" size={16} />
          Carregando solicitacoes
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : requests.length ? (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id}>
              <button
                className="glass w-full rounded-2xl p-4 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
                onClick={() => {
                  setSelected(request);
                  window.scrollTo({ top: 0 });
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold">{request.fullName}</h3>
                    <p className="truncate text-xs text-white/50">{request.email ?? "Conta excluida"}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-3 text-sm tabular-nums text-white/80">
                  CREF {request.crefNumber}/{request.crefState}
                </p>
                <p className="mt-0.5 truncate text-xs text-white/50">
                  {request.specialty} · {request.education}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3 text-xs text-white/45">
                  Enviada em {formatDateTime(request.createdAt)}
                  <ChevronRight size={16} className="text-white/35" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-white/[0.07] p-5 text-center text-sm text-white/55">
          {filter === "PENDING" ? "Nenhuma solicitacao aguardando analise." : "Nenhuma solicitacao neste filtro."}
        </p>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={status === "APPROVED" ? "green" : status === "PENDING" ? "dark" : "muted"}>{requestStatusLabels[status]}</Badge>;
}

function RequestDetail({
  authToken,
  request,
  onBack,
  onDecided
}: {
  authToken: string;
  request: AdminRequest;
  onBack: () => void;
  onDecided: (request: AdminRequest) => void;
}) {
  const [crefChecked, setCrefChecked] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function decide(action: "approve" | "reject") {
    setSending(true);
    setError("");

    try {
      const response = await apiFetch(authToken, `/api/admin/professional-requests/${request.id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "approve" ? { crefChecked } : { reason: reason.trim() || undefined })
      });
      const data = (await response.json()) as { request?: AdminRequest; error?: string; details?: Array<{ message: string }> };

      if (!response.ok || !data.request) {
        throw new Error(data.details?.[0]?.message ?? data.error ?? "Nao foi possivel registrar a decisao.");
      }

      setRejecting(false);
      onDecided(data.request);
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Nao foi possivel registrar a decisao.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <IconButton label="Voltar para a lista" onClick={onBack}>
          <ChevronLeft size={20} />
        </IconButton>
        <p className="text-sm text-white/55">Cadastros profissionais</p>
      </div>

      <section className="glass-strong rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-tight tracking-tight">{request.fullName}</h2>
            <p className="mt-0.5 truncate text-sm text-white/55">{request.email ?? "Conta excluida pelo usuario"}</p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-white/[0.07] pt-4 text-sm">
          <Info label="CREF">
            <span className="tabular-nums">{request.crefNumber}</span>
          </Info>
          <Info label="UF">{request.crefState}</Info>
          <Info label="Formacao">{request.education}</Info>
          <Info label="Especialidade">{request.specialty}</Info>
          <Info label="Solicitada em">{formatDateTime(request.createdAt)}</Info>
          {request.reviewedAt && <Info label="Analisada em">{formatDateTime(request.reviewedAt)}</Info>}
          {request.reviewedBy && <Info label="Responsavel">{request.reviewedBy}</Info>}
          {request.status === "REJECTED" && <Info label="Motivo">{request.rejectionReason || "Nao informado"}</Info>}
        </dl>
      </section>

      {request.status === "PENDING" && (
        <section className="space-y-4 border-t border-white/[0.07] pt-5">
          <h3 className="text-sm font-medium text-white/80">Decisao</h3>

          {!rejecting ? (
            <>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] p-3 text-sm leading-relaxed text-white/75">
                <input
                  checked={crefChecked}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-accent"
                  onChange={(event) => setCrefChecked(event.target.checked)}
                  type="checkbox"
                />
                Conferi o registro {request.crefNumber}/{request.crefState} no CONFEF ou no CREF do estado e ele e valido.
              </label>
              <button
                className="btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                disabled={!crefChecked || sending || request.accountDeleted}
                onClick={() => void decide("approve")}
                type="button"
              >
                {sending && <Loader2 className="animate-spin" size={16} />}
                Aprovar cadastro
              </button>
              <button
                className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-red-300/90 transition hover:bg-red-500/10"
                disabled={sending}
                onClick={() => setRejecting(true)}
                type="button"
              >
                Rejeitar cadastro
              </button>
            </>
          ) : (
            <div className="space-y-3 rounded-xl border border-red-400/20 bg-red-500/[0.06] p-4">
              <p className="text-sm font-medium text-red-100">Rejeitar a solicitacao de {request.fullName}?</p>
              <p className="text-xs leading-relaxed text-white/55">
                O CREF {request.crefNumber}/{request.crefState} fica bloqueado para novos cadastros. O profissional sera
                notificado com o motivo abaixo.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-xs text-white/55">Motivo (opcional)</span>
                <textarea
                  className="glass-field block w-full resize-y rounded-xl px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-white/35"
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex.: registro nao encontrado no CREF informado"
                  rows={3}
                  value={reason}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="h-11 rounded-xl border border-white/10 text-sm font-medium text-white/80 transition hover:bg-white/[0.05]"
                  disabled={sending}
                  onClick={() => setRejecting(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500/85 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                  disabled={sending}
                  onClick={() => void decide("reject")}
                  type="button"
                >
                  {sending && <Loader2 className="animate-spin" size={16} />}
                  Confirmar rejeicao
                </button>
              </div>
            </div>
          )}

          {request.accountDeleted && (
            <p className="text-xs text-white/50">A conta foi excluida pelo usuario. So e possivel rejeitar a solicitacao.</p>
          )}
          {error && (
            <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-100" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </section>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-white/45">{label}</dt>
      <dd className="min-w-0 break-words text-white/85">{children}</dd>
    </>
  );
}
