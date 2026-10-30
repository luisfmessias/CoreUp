import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, badRequest, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { preferencesSchema } from "@/lib/schemas";

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const preferences = preferencesSchema.parse(await request.json());

    await prisma.user.update({
      where: { id: user.id },
      data: { preferences }
    });

    return json({ preferences });
  } catch (error) {
    return badRequest(error);
  }
}
