"use client";

import { ChevronRight } from "lucide-react";
import { formatDateTime, type AppNotification } from "@/lib/api-client";
import { requestStatusLabels } from "@/lib/professional";
import { Badge } from "@/components/ui/Badge";

export function NotificationsView({
  notifications,
  unreadCount,
  onOpen,
  onMarkAllRead
}: {
  notifications: AppNotification[];
  unreadCount: number;
  onOpen: (notification: AppNotification) => void;
  onMarkAllRead: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-white/45">{unreadCount ? `${unreadCount} nao lidas` : "Tudo lido"}</p>
          <h2 className="text-2xl font-semibold tracking-tight">Notificacoes</h2>
        </div>
        {unreadCount > 0 && (
          <button className="text-sm text-white/70 underline underline-offset-4 hover:text-white" onClick={onMarkAllRead} type="button">
            Marcar todas como lidas
          </button>
        )}
      </div>

      {notifications.length ? (
        <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {notifications.map((notification) => {
            const unread = !notification.readAt;

            return (
              <li key={notification.id}>
                <button
                  className="flex w-full items-start gap-3 py-3.5 text-left transition hover:bg-white/[0.03]"
                  onClick={() => onOpen(notification)}
                  type="button"
                >
                  <span
                    aria-label={unread ? "Nao lida" : undefined}
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-accent" : "bg-transparent"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${unread ? "font-semibold" : "font-medium text-white/80"}`}>
                      {notification.title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-white/60">{notification.message}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/40">
                      {formatDateTime(notification.createdAt)}
                      {notification.request && (
                        <Badge tone={notification.request.status === "APPROVED" ? "green" : "muted"}>
                          {requestStatusLabels[notification.request.status]}
                        </Badge>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 shrink-0 text-white/30" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-white/[0.07] p-5 text-center text-sm text-white/55">
          Voce ainda nao tem notificacoes.
        </p>
      )}
    </section>
  );
}
