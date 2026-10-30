import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type Limit = {
  key: string;
  max: number;
  windowMs: number;
};

const MINUTE = 60 * 1000;
const CLEANUP_AFTER_MS = 24 * 60 * MINUTE;

export const limits = {
  loginByEmail: (email: string): Limit => ({ key: `login:email:${email}`, max: 5, windowMs: 15 * MINUTE }),
  loginByIp: (ip: string): Limit => ({ key: `login:ip:${ip}`, max: 20, windowMs: 15 * MINUTE }),
  registerByIp: (ip: string): Limit => ({ key: `register:ip:${ip}`, max: 5, windowMs: 60 * MINUTE }),
  deleteAccount: (userId: string): Limit => ({ key: `delete:user:${userId}`, max: 5, windowMs: 15 * MINUTE })
};

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "desconhecido";
}

// Devolve quantos segundos faltam para liberar, ou 0 se nenhum limite estourou.
export async function checkRateLimit(...checks: Limit[]) {
  for (const limit of checks) {
    const attempts = await prisma.authAttempt.findMany({
      where: {
        key: limit.key,
        createdAt: { gte: new Date(Date.now() - limit.windowMs) }
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
      take: limit.max
    });

    if (attempts.length >= limit.max) {
      const releasesAt = attempts[0].createdAt.getTime() + limit.windowMs;
      return Math.max(1, Math.ceil((releasesAt - Date.now()) / 1000));
    }
  }

  return 0;
}

export async function recordAttempt(...checks: Limit[]) {
  await prisma.authAttempt.createMany({
    data: checks.map((limit) => ({ key: limit.key }))
  });

  // Limpeza oportunista: sem cron, de vez em quando uma requisicao apaga
  // os registros que ja nao entram em nenhuma janela.
  if (Math.random() < 0.05) {
    await prisma.authAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - CLEANUP_AFTER_MS) } }
    });
  }
}

export async function clearAttempts(limit: Limit) {
  await prisma.authAttempt.deleteMany({ where: { key: limit.key } });
}
