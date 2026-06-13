import { NextRequest } from "next/server";
import { createSession } from "@/lib/auth";
import { badRequest, json } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const payload = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      return json({ error: "E-mail ou senha invalidos." }, 401);
    }

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
