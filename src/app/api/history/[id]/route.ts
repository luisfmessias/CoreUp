import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, notFound, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const { id } = await context.params;
  const deleted = await prisma.workoutLog.deleteMany({ where: { id, userId: user.id } });

  if (!deleted.count) {
    return notFound("Registro");
  }

  return json({ ok: true });
}
