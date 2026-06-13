import { NextRequest } from "next/server";
import { getBearerToken, hashToken } from "@/lib/auth";
import { json, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return unauthorized();
  }

  await prisma.authSession.deleteMany({
    where: { tokenHash: hashToken(token) }
  });

  return json({ ok: true });
}
