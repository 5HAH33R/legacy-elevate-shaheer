import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { requireBusinessOwner } from "@/server/businesses";
import { errorResponse } from "@/server/errors";
import { explainForecast } from "@/server/ai/forecast";
import { HORIZONS, type Horizon } from "@/lib/forecast";
import { z } from "zod";

type RouteContext = { params: Promise<{ businessId: string }> };

const bodySchema = z.object({
  horizon: z.coerce.number().refine((n) => (HORIZONS as readonly number[]).includes(n), "Invalid horizon."),
  language: z.enum(["english", "urdu", "roman-urdu", "en", "ur", "roman-ur"]).default("english"),
});

const langMap: Record<string, "en" | "ur" | "roman-ur"> = {
  english: "en",
  en: "en",
  urdu: "ur",
  ur: "ur",
  "roman-urdu": "roman-ur",
  "roman-ur": "roman-ur",
};

/** AI explanation of the deterministic forecast with Firestore persistence. */
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
      language: langMap[body.language] ?? "en",
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
