import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(error: unknown) {
  if (error instanceof ZodError) {
    return json(
      {
        error: "Dados inválidos.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      400
    );
  }

  return json({ error: "Requisição inválida." }, 400);
}

export function unauthorized() {
  return json({ error: "Autenticação obrigatória." }, 401);
}

export function forbidden() {
  return json({ error: "Você não tem permissão para acessar este recurso." }, 403);
}

export function tooManyRequests(retryAfterSeconds: number) {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const response = json(
    { error: `Muitas tentativas. Tente novamente em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.` },
    429
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));

  return response;
}

export function notFound(resource = "Recurso") {
  return json({ error: `${resource} não encontrado.` }, 404);
}
