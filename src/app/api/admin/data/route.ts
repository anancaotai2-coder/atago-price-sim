import { NextRequest, NextResponse } from "next/server";
import { getData, saveData } from "@/lib/store";
import { PriceData } from "@/lib/pricing";

export async function GET() {
  const data = await getData();
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as PriceData;
  await saveData(body);
  return NextResponse.json({ ok: true });
}
