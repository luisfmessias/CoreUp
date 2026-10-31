import { Loader2 } from "lucide-react";

export function ConfirmPanel({
  title,
  description,
  confirmLabel,
  busy,
  onCancel,
  onConfirm
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div aria-label={title} className="space-y-3 rounded-xl border border-red-400/20 bg-red-500/[0.06] p-4" role="alertdialog">
      <p className="text-sm font-medium text-red-100">{title}</p>
      <p className="text-xs leading-relaxed text-white/55">{description}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="h-11 rounded-xl border border-white/10 text-sm font-medium text-white/80 transition hover:bg-white/[0.05]"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500/85 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          {busy && <Loader2 className="animate-spin" size={16} />}
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
