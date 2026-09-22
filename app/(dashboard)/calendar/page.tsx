import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { sheetsApi } from "@/lib/sheetsApi";

function thb(n: number) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  let loans: Awaited<ReturnType<typeof sheetsApi.listLoans>> = [];
  let debtors: Awaited<ReturnType<typeof sheetsApi.listDebtors>> = [];
  let installments: Awaited<ReturnType<typeof sheetsApi.listAllInstallments>> = [];
  let error: string | null = null;

  try {
    [loans, debtors, installments] = await Promise.all([
      sheetsApi.listLoans(),
      sheetsApi.listDebtors(),
      sheetsApi.listAllInstallments(),
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
  const activeLoanIds = new Set(loans.filter((l) => l.status === "active").map((l) => l.id));
  const loanById = new Map(loans.map((l) => [l.id, l]));

  const relevantInstallments = installments.filter(
    (i) => activeLoanIds.has(i.loanId) && (i.status === "pending" || i.status === "overdue"),
  );

  const byDay = new Map<string, typeof relevantInstallments>();
  for (const inst of relevantInstallments) {
    const key = toDateKey(new Date(inst.dueDate));
    const list = byDay.get(key) ?? [];
    list.push(inst);
    byDay.set(key, list);
  }

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const prevMonthDate = new Date(year, month - 1, 1);
  const nextMonthDate = new Date(year, month + 1, 1);
  const prevMonthParam = `${prevMonthDate.getFullYear()}-${String(
    prevMonthDate.getMonth() + 1,
  ).padStart(2, "0")}`;
  const nextMonthParam = `${nextMonthDate.getFullYear()}-${String(
    nextMonthDate.getMonth() + 1,
  ).padStart(2, "0")}`;

  const monthItems = relevantInstallments
    .filter((i) => {
      const d = new Date(i.dueDate);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const todayKey = toDateKey(now);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground">
          ปฏิทิน
        </h1>
        <div className="flex items-center gap-4 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
          <Link href={`/calendar?month=${prevMonthParam}`} className="hover:text-foreground">
            &larr; ก่อนหน้า
          </Link>
          <span className="text-foreground">
            {MONTH_NAMES[month]} {year + 543}
          </span>
          <Link href={`/calendar?month=${nextMonthParam}`} className="hover:text-foreground">
            ถัดไป &rarr;
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border/70 bg-border/70 text-xs">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="bg-muted/60 py-2 text-center font-medium text-muted-foreground"
            >
              {w}
            </div>
          ))}
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} className="min-h-20 bg-background" />;
            const key = toDateKey(date);
            const dayInstallments = byDay.get(key) ?? [];
            const hasOverdue = dayInstallments.some((i) => i.status === "overdue");
            const isToday = key === todayKey;
            return (
              <div
                key={idx}
                className={`flex min-h-20 flex-col gap-1 bg-background p-1.5 ${
                  isToday ? "ring-1 ring-inset ring-accent" : ""
                }`}
              >
                <span className="text-xs tabular-nums text-muted-foreground">{date.getDate()}</span>
                {dayInstallments.length > 0 && (
                  <span
                    className={`w-fit rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      hasOverdue
                        ? "bg-destructive/15 text-destructive"
                        : "bg-accent/15 text-accent-foreground"
                    }`}
                  >
                    {dayInstallments.length} รายการ
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium text-foreground">
          ครบกำหนดในเดือนนี้
        </h2>
        <div className="flex flex-col divide-y divide-border/70 border-y border-border/70">
          {monthItems.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">ไม่มีรายการครบกำหนดในเดือนนี้</p>
          )}
          {monthItems.map((inst) => {
            const loan = loanById.get(inst.loanId);
            const debtor = loan ? debtorById.get(loan.debtorId) : undefined;
            return (
              <Link
                key={inst.id}
                href={debtor ? `/debtors/${debtor.id}` : "#"}
                className="flex items-center justify-between gap-4 py-4 text-sm transition-colors hover:bg-muted/60"
              >
                <div>
                  <span className="font-medium">{debtor?.name ?? "ไม่ทราบชื่อ"}</span>{" "}
                  <span className="text-muted-foreground">
                    {new Date(inst.dueDate).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{thb(inst.amountDue)}</span>
                  {inst.status === "overdue" && <Badge variant="destructive">เกินกำหนด</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
