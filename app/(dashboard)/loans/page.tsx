import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { sheetsApi } from "@/lib/sheetsApi";

function thb(n: number) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function LoansPage() {
  let loans: Awaited<ReturnType<typeof sheetsApi.listLoans>> = [];
  let debtors: Awaited<ReturnType<typeof sheetsApi.listDebtors>> = [];
  let installments: Awaited<ReturnType<typeof sheetsApi.listAllInstallments>> = [];
  let payments: Awaited<ReturnType<typeof sheetsApi.listAllPayments>> = [];
  let error: string | null = null;

  try {
    [loans, debtors, installments, payments] = await Promise.all([
      sheetsApi.listLoans(),
      sheetsApi.listDebtors(),
      sheetsApi.listAllInstallments(),
      sheetsApi.listAllPayments(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "ไม่สามารถโหลดข้อมูลได้";
  }

  if (error) {
    return (
      <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        ยังเชื่อมต่อ Apps Script API ไม่ได้ ({error})
      </div>
    );
  }

  const debtorById = new Map(debtors.map((d) => [d.id, d]));

  const activeLoans = loans
    .filter((l) => l.status === "active")
    .map((loan) => {
      const loanInstallments = installments.filter((i) => i.loanId === loan.id);
      const loanPayments = payments.filter((p) => p.loanId === loan.id);
      const collected = loanPayments.reduce((sum, p) => sum + p.amount, 0);
      const overdue = loanInstallments.some((i) => i.status === "overdue");
      const nextDue = loanInstallments
        .filter((i) => i.status === "pending" || i.status === "overdue")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
      return { loan, collected, overdue, nextDue };
    })
    .sort((a, b) => {
      if (!a.nextDue) return 1;
      if (!b.nextDue) return -1;
      return new Date(a.nextDue.dueDate).getTime() - new Date(b.nextDue.dueDate).getTime();
    });

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground">
        สัญญาที่มีอยู่
      </h1>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col divide-y divide-border/70 border-y border-border/70">
          {activeLoans.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">ยังไม่มีสัญญาที่มีอยู่</p>
          )}
          {activeLoans.map(({ loan, collected, overdue, nextDue }) => {
            const debtor = debtorById.get(loan.debtorId);
            return (
              <Link
                key={loan.id}
                href={debtor ? `/debtors/${debtor.id}` : "#"}
                className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:bg-muted/60"
              >
                <div>
                  <span className="font-medium">{debtor?.name ?? "ไม่ทราบชื่อ"}</span>{" "}
                  <span className="text-muted-foreground">
                    {thb(loan.principal)} บาท · {loan.ratePercent}%/{loan.rateUnit} ×{" "}
                    {loan.durationUnits}
                  </span>
                  {nextDue && (
                    <span className="text-muted-foreground"> · ครบกำหนด {fmtDate(nextDue.dueDate)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">
                    {thb(collected)} / {thb(loan.totalDue)}
                  </span>
                  {overdue && <Badge variant="destructive">เกินกำหนด</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
