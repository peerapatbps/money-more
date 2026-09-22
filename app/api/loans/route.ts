import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sheetsApi } from "@/lib/sheetsApi";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  try {
    const data = await sheetsApi.createLoan({
      ...body,
      startDate: new Date().toISOString(),
      dueDate: new Date().toISOString(), // Apps Script recomputes the real due date from durationUnits
    });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
