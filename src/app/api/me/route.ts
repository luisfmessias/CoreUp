import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { badRequest, json, tooManyRequests, unauthorized } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { toPublicUser } from "@/lib/public-user";
import { checkRateLimit, limits, recordAttempt } from "@/lib/rate-limit";
import { deleteAccountSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  return json({ user: toPublicUser(user) });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const payload = deleteAccountSchema.parse(await request.json());
    const limit = limits.deleteAccount(user.id);
    const retryAfter = await checkRateLimit(limit);

    if (retryAfter) {
      return tooManyRequests(retryAfter);
    }

    if (!(await verifyPassword(payload.password, user.passwordHash))) {
      await recordAttempt(limit);
      return json({ error: "Senha incorreta." }, 401);
    }

    await prisma.$transaction([
      prisma.user.delete({ where: { id: user.id } }),
      prisma.authAttempt.deleteMany({ where: { key: limit.key } })
    ]);

    return json({ ok: true });
  } catch (error) {
    return badRequest(error);
  }
}
