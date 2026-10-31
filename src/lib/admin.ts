import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/http";

export async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return { user: null, response: unauthorized() } as const;
  }

  if (user.accountType !== "ADMIN") {
    return { user: null, response: forbidden() } as const;
  }

  return { user, response: null } as const;
}
