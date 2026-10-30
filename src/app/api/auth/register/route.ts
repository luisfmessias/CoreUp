import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import { badRequest, json, tooManyRequests } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, limits, recordAttempt } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const payload = registerSchema.parse(await request.json());
    const ipLimit = limits.registerByIp(getClientIp(request));
    const retryAfter = await checkRateLimit(ipLimit);

    if (retryAfter) {
      return tooManyRequests(retryAfter);
    }

    await recordAttempt(ipLimit);

    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        passwordHash: await hashPassword(payload.password),
        heightCm: payload.heightCm,
        weightKg: payload.weightKg,
        privacyAcceptedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        heightCm: true,
        weightKg: true,
        createdAt: true
      }
    });

    const token = await createSession(user.id);

    return json({ user, token }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return json({ error: "Ja existe um usuario com este e-mail." }, 409);
    }

    return badRequest(error);
  }
}
