import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sheetsApi } from "@/lib/sheetsApi";

function thb(n: number) {
  return n.toLocaleString("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
}

export default async function SummaryPage() {
  let summary: Awaited<ReturnType<typeof sheetsApi.getSummary>> | null = null;
  let error: string | null = null;
  try {
    summary = await sheetsApi.getSummary();
  } catch (e) {
    error = e instanceof Error ? e.message : "ไม่สามารถโหลดข้อมูลได้";
  }

  if (error || !summary) {
    return (
      <div className="border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        ยังเชื่อมต่อ Apps Script API ไม่ได้ ({error}) — ตั้งค่า SHEETS_API_URL / SHEETS_API_SECRET ใน .env.local
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-border/70 bg-border/70 sm:grid-cols-4">
        <KpiCard label="เงินต้นคงค้าง" value={thb(summary.outstandingPrincipal)} />
        <KpiCard label="ดอกเบี้ยที่คาดว่าจะได้รับ" value={thb(summary.expectedInterest)} />
        <KpiCard label="ลูกหนี้ที่ยัง Active" value={String(summary.activeLoanCount)} />
        <KpiCard label="เกินกำหนดชำระ" value={String(summary.overdueCount)} tone="danger" />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium text-foreground">
          ครบกำหนดวันนี้ / เกินกำหนด
        </h2>
        <div className="flex flex-col divide-y divide-border/70 border-y border-border/70">
          {summary.dueToday.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">ไม่มีรายการที่ต้องเก็บวันนี้</p>
          )}
          {summary.dueToday.map(({ loan, debtor, installment }) => (
            <Link
              key={installment.id}
              href={`/debtors/${debtor.id}`}
              className="flex items-center justify-between py-4 text-sm transition-colors hover:bg-muted/60"
            >
              <div>
                <span className="font-medium">{debtor.name}</span>{" "}
                <span className="text-muted-foreground">งวดที่ {installment.seq}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">{thb(installment.amountDue)}</span>
                {installment.status === "overdue" && <Badge variant="destructive">เกินกำหนด</Badge>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium text-foreground">
          มีโอกาสปิดยอดได้ (เก็บมาแล้ว ≥ 80%)
        </h2>
        <div className="flex flex-col divide-y divide-border/70 border-y border-border/70">
          {summary.eligibleForClose.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">ยังไม่มีลูกหนี้ที่เข้าเงื่อนไข</p>
          )}
          {summary.eligibleForClose.map(({ loan, debtor, collected, totalDue }) => (
            <Link
              key={loan.id}
              href={`/debtors/${debtor.id}`}
              className="flex items-center justify-between py-4 text-sm transition-colors hover:bg-muted/60"
            >
              <span className="font-medium">{debtor.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {thb(collected)} / {thb(totalDue)} ({Math.round((collected / totalDue) * 100)}%)
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="bg-background p-5">
      <p className="text-[0.65rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={`mt-2 font-heading text-2xl font-medium tabular-nums ${
          tone === "danger" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
