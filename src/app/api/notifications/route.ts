import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { badRequest, json, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { markNotificationsSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { request: { select: { status: true, crefNumber: true, crefState: true, fullName: true } } }
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } })
  ]);

  return json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const { ids } = markNotificationsSchema.parse(await request.json());

    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() }
    });

    return json({ ok: true });
  } catch (error) {
    return badRequest(error);
  }
}
