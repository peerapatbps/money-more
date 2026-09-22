import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { sheetsApi } from "@/lib/sheetsApi";

function thb(n: number) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export default async function HistoryPage() {
  let payments: Awaited<ReturnType<typeof sheetsApi.listAllPayments>> = [];
  let loans: Awaited<ReturnType<typeof sheetsApi.listLoans>> = [];
  let debtors: Awaited<ReturnType<typeof sheetsApi.listDebtors>> = [];
  let error: string | null = null;

  try {
    [payments, loans, debtors] = await Promise.all([
      sheetsApi.listAllPayments(),
      sheetsApi.listLoans(),
      sheetsApi.listDebtors(),
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
  const loanById = new Map(loans.map((l) => [l.id, l]));

  const sortedPayments = [...payments].sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
  );

  const closedLoans = loans
    .filter((l) => l.status === "closed")
    .map((loan) => {
      const loanPayments = payments.filter((p) => p.loanId === loan.id);
      const collected = loanPayments.reduce((sum, p) => sum + p.amount, 0);
      const closedAt = loanPayments.reduce<string | null>((latest, p) => {
        if (!latest || new Date(p.paymentDate) > new Date(latest)) return p.paymentDate;
        return latest;
      }, null);
      const closedEarly = loanPayments.some((p) => p.isEarlyClose);
      return { loan, collected, closedAt, closedEarly };
    })
    .sort((a, b) => new Date(b.closedAt ?? 0).getTime() - new Date(a.closedAt ?? 0).getTime());

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground">ประวัติ</h1>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium text-foreground">
          ประวัติการรับเงินทั้งหมด
        </h2>
        <div className="flex flex-col divide-y divide-border/70 border-y border-border/70">
          {sortedPayments.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">ยังไม่มีประวัติการรับเงิน</p>
          )}
          {sortedPayments.map((payment) => {
            const loan = loanById.get(payment.loanId);
            const debtor = loan ? debtorById.get(loan.debtorId) : undefined;
            return (
              <Link
                key={payment.id}
                href={debtor ? `/debtors/${debtor.id}` : "#"}
                className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:bg-muted/60"
              >
                <div>
                  <span className="font-medium">{debtor?.name ?? "ไม่ทราบชื่อ"}</span>{" "}
                  <span className="text-muted-foreground">
                    {new Date(payment.paymentDate).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {payment.note && <span className="text-muted-foreground"> · {payment.note}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{thb(payment.amount)}</span>
                  {payment.isEarlyClose && <Badge variant="outline">ปิดยอดก่อนกำหนด</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium text-foreground">สัญญาที่ปิดแล้ว</h2>
        <div className="flex flex-col divide-y divide-border/70 border-y border-border/70">
          {closedLoans.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">ยังไม่มีสัญญาที่ปิดแล้ว</p>
          )}
          {closedLoans.map(({ loan, collected, closedAt, closedEarly }) => {
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
                    {thb(loan.principal)} บาท · {loan.ratePercent}%/{loan.rateUnit} × {loan.durationUnits}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">
                    {closedAt
                      ? new Date(closedAt).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "-"}
                  </span>
                  <span className="tabular-nums">{thb(collected)}</span>
                  {closedEarly && <Badge variant="outline">ปิดก่อนกำหนด</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
