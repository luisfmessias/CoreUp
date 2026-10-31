import { Prisma, type ProfessionalRequest, type User } from "@prisma/client";
import { json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { crefKeyFor, duplicateCrefMessages } from "@/lib/professional";

type Tx = Prisma.TransactionClient;

export type ProfessionalRequestInput = {
  fullName: string;
  crefNumber: string;
  crefState: string;
  specialty: string;
  education: string;
};

export class DuplicateCrefError extends Error {
  constructor(readonly status: ProfessionalRequest["status"]) {
    super(duplicateCrefMessages[status]);
  }
}

export function canReviewWorkouts(user: Pick<User, "accountType">) {
  return user.accountType === "PROFESSIONAL" || user.accountType === "ADMIN";
}

export function isAdmin(user: Pick<User, "accountType"> | null): user is User {
  return user?.accountType === "ADMIN";
}

export async function assertCrefAvailable(tx: Tx, crefKey: string) {
  const existing = await tx.professionalRequest.findUnique({ where: { crefKey }, select: { status: true } });

  if (existing) {
    throw new DuplicateCrefError(existing.status);
  }
}

export async function createProfessionalRequest(tx: Tx, userId: string, input: ProfessionalRequestInput) {
  const crefKey = crefKeyFor(input.crefNumber, input.crefState);
  await assertCrefAvailable(tx, crefKey);

  const request = await tx.professionalRequest.create({
    data: { userId, crefKey, ...input }
  });

  const admins = await tx.user.findMany({ where: { accountType: "ADMIN" }, select: { id: true } });

  if (admins.length) {
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "PROFESSIONAL_REQUEST_CREATED" as const,
        title: "Nova solicitacao de cadastro profissional",
        message: `${input.fullName} · CREF ${input.crefNumber}/${input.crefState}`,
        requestId: request.id
      }))
    });
  }

  return request;
}

export async function duplicateCrefResponse(error: unknown, input?: ProfessionalRequestInput) {
  if (error instanceof DuplicateCrefError) {
    return json({ error: error.message, code: "CREF_IN_USE", status: error.status }, 409);
  }

  if (
    input &&
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("crefKey")
  ) {
    const existing = await prisma.professionalRequest.findUnique({
      where: { crefKey: crefKeyFor(input.crefNumber, input.crefState) },
      select: { status: true }
    });
    const status = existing?.status ?? "PENDING";
    return json({ error: duplicateCrefMessages[status], code: "CREF_IN_USE", status }, 409);
  }

  return null;
}

export function serializeRequestForAdmin(
  request: ProfessionalRequest & {
    user: Pick<User, "email" | "accountType"> | null;
    reviewedBy: Pick<User, "name"> | null;
  }
) {
  return {
    id: request.id,
    fullName: request.fullName,
    email: request.user?.email ?? null,
    accountDeleted: !request.user,
    crefNumber: request.crefNumber,
    crefState: request.crefState,
    specialty: request.specialty,
    education: request.education,
    status: request.status,
    rejectionReason: request.rejectionReason,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    reviewedBy: request.reviewedBy?.name ?? null
  };
}

export const adminRequestInclude = {
  user: { select: { email: true, accountType: true } },
  reviewedBy: { select: { name: true } }
} satisfies Prisma.ProfessionalRequestInclude;
