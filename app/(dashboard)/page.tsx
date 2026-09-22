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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        ยังเชื่อมต่อ Apps Script API ไม่ได้ ({error}) — ตั้งค่า SHEETS_API_URL / SHEETS_API_SECRET ใน .env.local
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="เงินต้นคงค้าง" value={thb(summary.outstandingPrincipal)} />
        <KpiCard label="ดอกเบี้ยที่คาดว่าจะได้รับ" value={thb(summary.expectedInterest)} />
        <KpiCard label="ลูกหนี้ที่ยัง Active" value={String(summary.activeLoanCount)} />
        <KpiCard label="เกินกำหนดชำระ" value={String(summary.overdueCount)} tone="danger" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ครบกำหนดวันนี้ / เกินกำหนด</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {summary.dueToday.length === 0 && (
            <p className="text-sm text-neutral-500">ไม่มีรายการที่ต้องเก็บวันนี้</p>
          )}
          {summary.dueToday.map(({ loan, debtor, installment }) => (
            <Link
              key={installment.id}
              href={`/debtors/${debtor.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-neutral-50"
            >
              <div>
                <span className="font-medium">{debtor.name}</span>{" "}
                <span className="text-neutral-500">งวดที่ {installment.seq}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{thb(installment.amountDue)}</span>
                {installment.status === "overdue" && <Badge variant="destructive">เกินกำหนด</Badge>}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>มีโอกาสปิดยอดได้ (เก็บมาแล้ว ≥ 80%)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {summary.eligibleForClose.length === 0 && (
            <p className="text-sm text-neutral-500">ยังไม่มีลูกหนี้ที่เข้าเงื่อนไข</p>
          )}
          {summary.eligibleForClose.map(({ loan, debtor, collected, totalDue }) => (
            <Link
              key={loan.id}
              href={`/debtors/${debtor.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-neutral-50"
            >
              <span className="font-medium">{debtor.name}</span>
              <span className="text-neutral-500">
                {thb(collected)} / {thb(totalDue)} ({Math.round((collected / totalDue) * 100)}%)
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className={`mt-1 text-xl font-semibold ${tone === "danger" ? "text-red-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
