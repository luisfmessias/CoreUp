import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { json, notFound } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminRequestInclude, serializeRequestForAdmin } from "@/lib/professional-requests";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request);

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const found = await prisma.professionalRequest.findUnique({ where: { id }, include: adminRequestInclude });

  if (!found) {
    return notFound("Solicitação");
  }

  return json({ request: serializeRequestForAdmin(found) });
}
