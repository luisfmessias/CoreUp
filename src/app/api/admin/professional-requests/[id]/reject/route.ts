import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { badRequest } from "@/lib/http";
import { decideProfessionalRequest } from "@/lib/request-decision";
import { rejectRequestSchema } from "@/lib/schemas";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdmin(request);

  if (response) {
    return response;
  }

  let reason: string | undefined;

  try {
    reason = rejectRequestSchema.parse(await request.json()).reason;
  } catch (error) {
    return badRequest(error);
  }

  const { id } = await context.params;
  return decideProfessionalRequest(id, user, { kind: "reject", reason });
}
