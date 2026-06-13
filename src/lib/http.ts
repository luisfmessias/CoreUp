import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(error: unknown) {
  if (error instanceof ZodError) {
    return json(
      {
        error: "Dados invalidos.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      400
    );
  }

  return json({ error: "Requisicao invalida." }, 400);
}

export function unauthorized() {
  return json({ error: "Autenticacao obrigatoria." }, 401);
}

export function forbidden() {
  return json({ error: "Voce nao tem permissao para acessar este recurso." }, 403);
}

export function notFound(resource = "Recurso") {
  return json({ error: `${resource} nao encontrado.` }, 404);
}
