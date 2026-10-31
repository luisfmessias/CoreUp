import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { latestRequestInclude, toPublicUser } from "@/lib/public-user";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const updated = user.onboardingCompletedAt
    ? user
    : await prisma.user.update({
        where: { id: user.id },
        data: { onboardingCompletedAt: new Date() },
        include: latestRequestInclude
      });

  return json({ user: toPublicUser(updated) });
}
