import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, badRequest, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { bodyMetricSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const metrics = await prisma.bodyMetric.findMany({
    where: { userId: user.id },
    orderBy: { measuredAt: "desc" },
    take: 100
  });

  return json({ metrics });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  try {
    const payload = bodyMetricSchema.parse(await request.json());

    const metric = await prisma.bodyMetric.create({
      data: {
        userId: user.id,
        weightKg: payload.weightKg,
        heightCm: payload.heightCm,
        bodyFat: payload.bodyFat,
        measuredAt: payload.measuredAt ? new Date(payload.measuredAt) : undefined,
        notes: payload.notes
      }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        weightKg: payload.weightKg ?? user.weightKg,
        heightCm: payload.heightCm ?? user.heightCm
      }
    });

    return json({ metric }, 201);
  } catch (error) {
    return badRequest(error);
  }
}
