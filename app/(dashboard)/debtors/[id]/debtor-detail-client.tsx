"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { calcEarlyClose } from "@/lib/interest";
import type { Debtor, Installment, Loan, Payment } from "@/lib/sheetsApi";
import { toast } from "sonner";

function thb(n: number) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

type LoanDetail = {
  loan: Loan;
  installments: Installment[];
  payments: Payment[];
  collected: number;
  collectedInterest: number;
  collectedPrincipal: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  eligible: boolean;
};

export function DebtorDetailClient({ debtor, loans }: { debtor: Debtor; loans: LoanDetail[] }) {
  const router = useRouter();
  const totalOutstanding = loans
    .filter((l) => l.loan.status === "active")
    .reduce((sum, l) => sum + l.outstandingPrincipal + l.outstandingInterest, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground">
          {debtor.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {debtor.phone && `${debtor.phone} · `}ยอดคงเหลือรวม{" "}
          <span className="tabular-nums text-foreground">{thb(totalOutstanding)}</span> บาท
        </p>
      </div>

      {loans.map((detail) => (
        <LoanCard key={detail.loan.id} detail={detail} onChanged={() => router.refresh()} />
      ))}
    </div>
  );
}

function LoanCard({ detail, onChanged }: { detail: LoanDetail; onChanged: () => void }) {
  const { loan, installments, collected, collectedInterest, collectedPrincipal, outstandingPrincipal, outstandingInterest, eligible } =
    detail;
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [specialRate, setSpecialRate] = useState<number>(loan.ratePercent);
  const [submitting, setSubmitting] = useState(false);

  const earlyCloseCalc = calcEarlyClose({
    outstandingPrincipal,
    originalInterestOwed: outstandingInterest,
    specialRatePercent: specialRate,
  });

  async function recordPayment() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({ loanId: loan.id, amount: paymentAmount }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success("บันทึกการรับเงินแล้ว");
      setPaymentAmount(0);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmEarlyClose() {
    if (!confirm(`ยืนยันปิดยอดด้วยอัตราพิเศษ ${specialRate}% ยอดที่ต้องรับ ${thb(earlyCloseCalc.totalDue)} บาท?`))
      return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/early-close", {
        method: "POST",
        body: JSON.stringify({ loanId: loan.id, specialRatePercent: specialRate }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success("ปิดยอดเรียบร้อย");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          สัญญา {thb(loan.principal)} บาท · {loan.ratePercent}%/{loan.rateUnit} × {loan.durationUnits}
        </CardTitle>
        <Badge variant={loan.status === "active" ? "default" : "secondary"}>
          {loan.status === "active" ? "กำลังดำเนินการ" : "ปิดแล้ว"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="ต้นคงเหลือ" value={thb(outstandingPrincipal)} />
          <Stat label="ดอกคงเหลือ" value={thb(outstandingInterest)} />
          <Stat label="เก็บมาแล้ว (ต้น)" value={thb(collectedPrincipal)} />
          <Stat label="เก็บมาแล้ว (ดอก)" value={thb(collectedInterest)} />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-1.5 font-normal">งวด</th>
              <th className="p-1.5 font-normal">ครบกำหนด</th>
              <th className="p-1.5 text-right font-normal">ยอด</th>
              <th className="p-1.5 font-normal">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {installments.map((inst) => (
              <tr key={inst.id} className="border-t border-border/70">
                <td className="p-1.5">{inst.seq}</td>
                <td className="p-1.5">{new Date(inst.dueDate).toLocaleDateString("th-TH")}</td>
                <td className="p-1.5 text-right tabular-nums">{thb(inst.amountDue)}</td>
                <td className="p-1.5">
                  <Badge
                    variant={
                      inst.status === "paid"
                        ? "default"
                        : inst.status === "overdue"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {inst.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loan.status === "active" && (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label>รับเงิน (บาท)</Label>
              <Input
                type="number"
                className="w-40"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
              />
            </div>
            <Button disabled={submitting || paymentAmount <= 0} onClick={recordPayment}>
              บันทึกรับเงิน
            </Button>
          </div>
        )}

        {loan.status === "active" && eligible && (
          <Card className="border border-accent/40 bg-accent/5 ring-0">
            <CardHeader>
              <CardTitle className="text-base text-accent">
                มีโอกาสปิดยอดได้ — เก็บมาแล้ว {Math.round((collected / loan.totalDue) * 100)}%
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Stat label="อัตราปัจจุบัน" value={`${loan.ratePercent}%`} />
                <Stat label="ดอกเบี้ยตามสัญญาเดิม (คงเหลือ)" value={thb(outstandingInterest)} />
                <Stat label="ต้นคงเหลือ" value={thb(outstandingPrincipal)} />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label>อัตราดอกเบี้ยพิเศษ (%)</Label>
                  <Input
                    type="number"
                    className="w-32"
                    value={specialRate}
                    onChange={(e) => setSpecialRate(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Stat label="ดอกเบี้ยพิเศษ" value={thb(earlyCloseCalc.specialInterest)} />
                <Stat label="ส่วนต่างที่ยอมลด" value={thb(earlyCloseCalc.difference)} />
                <Stat label="ยอดที่ต้องรับทั้งหมด" value={thb(earlyCloseCalc.totalDue)} />
              </div>
              <Button variant="default" disabled={submitting} onClick={confirmEarlyClose}>
                ยืนยันปิดยอดพิเศษ
              </Button>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.65rem] font-medium tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-medium tabular-nums">{value}</p>
    </div>
  );
}
