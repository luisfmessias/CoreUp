import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import { badRequest, json, tooManyRequests } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clearAttempts, getClientIp, limits, recordAttempt } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const payload = loginSchema.parse(await request.json());
    const emailLimit = limits.loginByEmail(payload.email);
    const ipLimit = limits.loginByIp(getClientIp(request));
    const retryAfter = await checkRateLimit(emailLimit, ipLimit);

    if (retryAfter) {
      return tooManyRequests(retryAfter);
    }

    const user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      await recordAttempt(emailLimit, ipLimit);
      return json({ error: "E-mail ou senha invalidos." }, 401);
    }

    await clearAttempts(emailLimit);
    const token = await createSession(user.id);

    return json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        heightCm: user.heightCm,
        weightKg: user.weightKg
      }
    });
  } catch (error) {
    return badRequest(error);
  }
}
