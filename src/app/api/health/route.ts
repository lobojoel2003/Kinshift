import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appVersion } from "@/lib/env";

/** Liveness and readiness probe for Docker, load balancers and uptime monitors. */
export async function GET() {
  try {
    getDb().get(sql`select 1`);
    return Response.json(
      {
        status: "ok",
        version: appVersion.version,
        build: appVersion.build,
        commit: appVersion.commit,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[kinshift] Health check failed", err);
    return Response.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
