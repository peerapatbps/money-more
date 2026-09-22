import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sheetsApi } from "@/lib/sheetsApi";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const [debtors, loans] = await Promise.all([sheetsApi.listDebtors(), sheetsApi.listLoans(id)]);
    const debtor = debtors.find((d) => d.id === id);
    if (!debtor) return NextResponse.json({ error: "not found" }, { status: 404 });

    const loansWithDetails = await Promise.all(
      loans.map(async (loan) => {
        const [installments, payments] = await Promise.all([
          sheetsApi.listInstallments(loan.id),
          sheetsApi.listPayments(loan.id),
        ]);
        return { loan, installments, payments };
      }),
    );

    return NextResponse.json({ data: { debtor, loans: loansWithDetails } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
