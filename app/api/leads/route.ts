import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DATABASE_UNAVAILABLE_HINT, isDatabaseUnreachable } from "@/lib/db-connection-hint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const noWebsite = searchParams.get("noWebsite") === "1" || searchParams.get("noWebsite") === "true";
  const location = searchParams.get("location") || undefined;
  const status = searchParams.get("status") || undefined;
  const take = Math.min(Number(searchParams.get("take") || "50"), 200);

  const where: Prisma.LeadWhereInput = {};

  if (location) {
    where.location = { contains: location, mode: "insensitive" };
  }
  if (status) {
    where.status = status;
  }
  if (noWebsite) {
    where.OR = [{ website: null }, { website: { contains: "maps.google", mode: "insensitive" } }];
  }

  try {
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    });
    return NextResponse.json({ ok: true, leads });
  } catch (e) {
    if (isDatabaseUnreachable(e)) {
      return NextResponse.json(
        { ok: false, leads: [], error: "Database unreachable", hint: DATABASE_UNAVAILABLE_HINT },
        { status: 503 },
      );
    }
    throw e;
  }
}
