import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, unauthorized } from "@/lib/http";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  return json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      heightCm: user.heightCm,
      weightKg: user.weightKg,
      createdAt: user.createdAt
    },
    dashboard: {
      status: "placeholder",
      message: "Painel inicial ainda sera implementado no front."
    }
  });
}
