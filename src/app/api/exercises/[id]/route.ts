import { NextRequest } from "next/server";
import { findExercise } from "@/lib/exercises";
import { json, notFound } from "@/lib/http";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const exercise = findExercise(Number(id));

  if (!exercise) {
    return notFound("Exercicio");
  }

  return json({ exercise });
}
