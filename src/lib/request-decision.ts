import type { User } from "@prisma/client";
import { json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminRequestInclude, serializeRequestForAdmin } from "@/lib/professional-requests";

type Decision = { kind: "approve" } | { kind: "reject"; reason?: string };

class DecisionError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
  }
}

export async function decideProfessionalRequest(requestId: string, admin: User, decision: Decision) {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.professionalRequest.findUnique({ where: { id: requestId } });

      if (!current) {
        throw new DecisionError("Solicitação não encontrada.", 404);
      }

      if (current.status !== "PENDING") {
        throw new DecisionError("Esta solicitação já foi analisada.", 409);
      }

      if (decision.kind === "approve" && !current.userId) {
        throw new DecisionError("A conta desta solicitação foi excluída. Não há conta para liberar.", 409);
      }

      const now = new Date();
      const updated = await tx.professionalRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: {
          status: decision.kind === "approve" ? "APPROVED" : "REJECTED",
          rejectionReason: decision.kind === "reject" ? decision.reason || null : null,
          reviewedAt: now,
          reviewedById: admin.id
        }
      });

      if (!updated.count) {
        throw new DecisionError("Esta solicitação já foi analisada.", 409);
      }

      if (current.userId) {
        if (decision.kind === "approve") {
          await tx.user.updateMany({
            where: { id: current.userId, accountType: "USER" },
            data: { accountType: "PROFESSIONAL" }
          });
        }

        await tx.notification.create({
          data: {
            userId: current.userId,
            requestId,
            ...(decision.kind === "approve"
              ? {
                  type: "PROFESSIONAL_REQUEST_APPROVED",
                  title: "Cadastro profissional aprovado",
                  message: "Seu CREF foi aprovado. Agora você pode avaliar os treinos do app."
                }
              : {
                  type: "PROFESSIONAL_REQUEST_REJECTED",
                  title: "Cadastro profissional rejeitado",
                  message: decision.reason
                    ? `Motivo informado pelo administrador: ${decision.reason}`
                    : "O administrador não informou um motivo."
                })
          }
        });
      }

      await tx.notification.updateMany({
        where: { requestId, type: "PROFESSIONAL_REQUEST_CREATED", readAt: null },
        data: { readAt: now }
      });
    });
  } catch (error) {
    if (error instanceof DecisionError) {
      return json({ error: error.message }, error.httpStatus);
    }

    throw error;
  }

  const request = await prisma.professionalRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: adminRequestInclude
  });

  return json({ request: serializeRequestForAdmin(request) });
}
