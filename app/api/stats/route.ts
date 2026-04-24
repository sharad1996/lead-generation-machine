import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DATABASE_UNAVAILABLE_HINT, isDatabaseUnreachable } from "@/lib/db-connection-hint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [total, noWebsite, contacted, converted] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({
        where: {
          OR: [{ website: null }, { website: { contains: "maps.google", mode: "insensitive" } }],
        },
      }),
      prisma.lead.count({ where: { status: "contacted" } }),
      prisma.lead.count({ where: { status: "converted" } }),
    ]);

    return NextResponse.json({
      ok: true,
      totalLeads: total,
      filteredLeadsNoWebsite: noWebsite,
      contacted,
      converted,
    });
  } catch (e) {
    if (isDatabaseUnreachable(e)) {
      return NextResponse.json(
        { ok: false, error: "Database unreachable", hint: DATABASE_UNAVAILABLE_HINT },
        { status: 503 },
      );
    }
    throw e;
  }
}
