import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type SessionPayload = {
  sub: string;
  sid: string;
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionExpiry() {
  const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? 30);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);

  return expiresAt;
}

export async function createSession(userId: string) {
  const sessionId = randomBytes(24).toString("hex");
  const secret = getJwtSecret();
  const expiresAt = createSessionExpiry();
  const token = jwt.sign({ sid: sessionId } satisfies Omit<SessionPayload, "sub">, secret, {
    subject: userId,
    expiresIn: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  });

  await prisma.authSession.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt
    }
  });

  return token;
}

export function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function getCurrentUser(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);

  if (!payload?.sub) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!session || session.userId !== payload.sub || session.expiresAt <= new Date()) {
    return null;
  }

  return session.user;
}

function verifySessionToken(token: string) {
  try {
    return jwt.verify(token, getJwtSecret()) as SessionPayload;
  } catch {
    return null;
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET precisa estar configurado em producao.");
  }

  return "coreup-local-dev-secret-change-me";
}
