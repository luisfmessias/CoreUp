import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import { badRequest, json, tooManyRequests } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createProfessionalRequest, duplicateCrefResponse, type ProfessionalRequestInput } from "@/lib/professional-requests";
import { latestRequestInclude, toPublicUser } from "@/lib/public-user";
import { checkRateLimit, getClientIp, limits, recordAttempt } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  let requestInput: ProfessionalRequestInput | undefined;

  try {
    const payload = registerSchema.parse(await request.json());
    const ipLimit = limits.registerByIp(getClientIp(request));
    const retryAfter = await checkRateLimit(ipLimit);

    if (retryAfter) {
      return tooManyRequests(retryAfter);
    }

    await recordAttempt(ipLimit);

    requestInput =
      payload.accountType === "PROFESSIONAL" && payload.professional
        ? { fullName: payload.name, ...payload.professional }
        : undefined;
    const passwordHash = await hashPassword(payload.password);

    const user = await prisma.$transaction(async (tx) => {
      // Sempre USER: o papel PROFESSIONAL so e concedido na aprovacao do admin.
      const created = await tx.user.create({
        data: {
          name: payload.name,
          email: payload.email,
          passwordHash,
          heightCm: payload.heightCm,
          weightKg: payload.weightKg,
          privacyAcceptedAt: new Date(),
          accountType: "USER"
        }
      });

      if (requestInput) {
        await createProfessionalRequest(tx, created.id, requestInput);
      }

      return tx.user.findUniqueOrThrow({ where: { id: created.id }, include: latestRequestInclude });
    });

    const token = await createSession(user.id);

    return json({ user: toPublicUser(user), token }, 201);
  } catch (error) {
    const duplicate = await duplicateCrefResponse(error, requestInput);

    if (duplicate) {
      return duplicate;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return json({ error: "Ja existe um usuario com este e-mail." }, 409);
    }

    return badRequest(error);
  }
}
