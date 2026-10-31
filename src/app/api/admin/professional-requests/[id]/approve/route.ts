import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { badRequest } from "@/lib/http";
import { decideProfessionalRequest } from "@/lib/request-decision";
import { approveRequestSchema } from "@/lib/schemas";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdmin(request);

  if (response) {
    return response;
  }

  try {
    approveRequestSchema.parse(await request.json());
  } catch (error) {
    return badRequest(error);
  }

  const { id } = await context.params;
  return decideProfessionalRequest(id, user, { kind: "approve" });
}
