import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { badRequest, json, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createProfessionalRequest, duplicateCrefResponse, type ProfessionalRequestInput } from "@/lib/professional-requests";
import { latestRequestInclude, toPublicUser } from "@/lib/public-user";
import { professionalRequestSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  if (user.accountType !== "USER") {
    return json({ error: "Sua conta ja tem acesso as funcionalidades profissionais." }, 409);
  }

  const latest = user.professionalRequests[0];

  if (latest?.status === "PENDING") {
    return json({ error: "Voce ja tem uma solicitacao em analise. Aguarde a decisao do administrador." }, 409);
  }

  let input: ProfessionalRequestInput | undefined;

  try {
    input = professionalRequestSchema.parse(await request.json());
    const requestInput = input;

    await prisma.$transaction((tx) => createProfessionalRequest(tx, user.id, requestInput));
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: latestRequestInclude });

    return json({ user: toPublicUser(updated) }, 201);
  } catch (error) {
    return (await duplicateCrefResponse(error, input)) ?? badRequest(error);
  }
}
