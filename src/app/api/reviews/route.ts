import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { json, unauthorized } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { serializeReview, reviewInclude } from "@/lib/reviews";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return unauthorized();
  }

  const reviews = await prisma.workoutReview.findMany({
    where: { professional: { accountType: { in: ["PROFESSIONAL", "ADMIN"] } } },
    include: reviewInclude,
    orderBy: { updatedAt: "desc" }
  });

  return json({ reviews: reviews.map((review) => serializeReview(review, user.id)) });
}
