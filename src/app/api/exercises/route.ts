import { NextRequest } from "next/server";
import { exerciseList, normalizeText } from "@/lib/exercises";
import { json } from "@/lib/http";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = normalizeText(searchParams.get("q") ?? "");
  const group = normalizeText(searchParams.get("grupoMuscular") ?? "");
  const level = normalizeText(searchParams.get("nivel") ?? "");

  const exercises = exerciseList.filter((exercise) => {
    const matchesQuery = query ? normalizeText(exercise.nome).includes(query) : true;
    const matchesGroup = group ? normalizeText(exercise.grupoMuscular) === group : true;
    const matchesLevel = level ? normalizeText(exercise.nivel) === level : true;

    return matchesQuery && matchesGroup && matchesLevel;
  });

  return json({
    total: exercises.length,
    exercises
  });
}
