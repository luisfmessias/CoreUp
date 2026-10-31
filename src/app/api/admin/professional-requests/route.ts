import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminRequestInclude, serializeRequestForAdmin } from "@/lib/professional-requests";

const statuses = ["PENDING", "APPROVED", "REJECTED"] as const;

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);

  if (response) {
    return response;
  }

  const param = new URL(request.url).searchParams.get("status");
  const status = statuses.find((value) => value === param);

  const [requests, grouped] = await Promise.all([
    prisma.professionalRequest.findMany({
      where: status ? { status } : undefined,
      include: adminRequestInclude,
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    prisma.professionalRequest.groupBy({ by: ["status"], _count: true })
  ]);

  const counts = Object.fromEntries(statuses.map((value) => [value, 0])) as Record<(typeof statuses)[number], number>;
  grouped.forEach((group) => {
    counts[group.status] = group._count;
  });

  return json({ requests: requests.map(serializeRequestForAdmin), counts });
}
