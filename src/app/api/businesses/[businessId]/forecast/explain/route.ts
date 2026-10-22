import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { explainForecast, forecastExplainSchema } from "@/server/ai/forecast";
import { z } from "zod";
import type { Horizon } from "@/lib/forecast";

type RouteContext = { params: Promise<{ businessId: string }> };

const bodySchema = forecastExplainSchema.extend({
  language: z.enum(["english", "urdu", "roman-urdu"]).default("english"),
});

/** AI explanation of the deterministic forecast. Read-only. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { businessId } = await context.params;
    const business = await requireBusinessOwner(user.uid, businessId);
    const body = bodySchema.parse((await request.json().catch(() => null)) ?? {});
    const result = await explainForecast({
      uid: user.uid,
      business,
      horizon: body.horizon as Horizon,
      language: body.language,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
