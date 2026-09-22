"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RATE_UNIT_LABEL,
  RateUnit,
  RepaymentMode,
  InstallmentCalcMode,
  buildRateTable,
  buildRepaymentSchedule,
} from "@/lib/interest";
import type { Debtor } from "@/lib/sheetsApi";
import { toast } from "sonner";

function thb(n: number) {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export function NewLoanForm() {
  const router = useRouter();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [debtorId, setDebtorId] = useState<string>("");
  const [newDebtorName, setNewDebtorName] = useState("");
  const [creatingNewDebtor, setCreatingNewDebtor] = useState(false);

  const [principal, setPrincipal] = useState<number>(10000);
  const [rateUnit, setRateUnit] = useState<RateUnit>("week");
  const [selected, setSelected] = useState<{ rate: number; periods: number } | null>(null);

  const [repaymentMode, setRepaymentMode] = useState<RepaymentMode>("bullet");
  const [installmentCalcMode, setInstallmentCalcMode] =
    useState<InstallmentCalcMode>("interestOnlyBalloon");
  const [numInstallments, setNumInstallments] = useState(4);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/debtors")
      .then((r) => r.json())
      .then((d) => setDebtors(d.data ?? []))
      .catch(() => {});
  }, []);

  const table = useMemo(() => buildRateTable(principal || 0), [principal]);

  const schedule = useMemo(() => {
    if (!selected) return [];
    return buildRepaymentSchedule({
      principal,
      ratePercent: selected.rate,
      periods: selected.periods,
      repaymentMode,
      installmentCalcMode,
      numInstallments,
    });
  }, [selected, principal, repaymentMode, installmentCalcMode, numInstallments]);

  async function handleSubmit() {
    if (!selected) return toast.error("กรุณาเลือกอัตราดอกเบี้ยและระยะเวลาจากตาราง");
    if (!debtorId && !creatingNewDebtor) return toast.error("กรุณาเลือกหรือเพิ่มลูกหนี้");
    setSubmitting(true);
    try {
      let finalDebtorId = debtorId;
      if (creatingNewDebtor) {
        const res = await fetch("/api/debtors", {
          method: "POST",
          body: JSON.stringify({ name: newDebtorName }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        finalDebtorId = json.data.id;
      }

      const res = await fetch("/api/loans", {
        method: "POST",
        body: JSON.stringify({
          debtorId: finalDebtorId,
          principal,
          rateUnit,
          ratePercent: selected.rate,
          durationUnits: selected.periods,
          repaymentMode,
          installmentCalcMode: repaymentMode === "installment" ? installmentCalcMode : undefined,
          numInstallments: repaymentMode === "installment" ? numInstallments : undefined,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success("สร้างสัญญาเรียบร้อย");
      router.push(`/debtors/${finalDebtorId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>ลูกหนี้</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!creatingNewDebtor ? (
            <div className="flex flex-col gap-2">
              <Label>เลือกลูกหนี้เดิม</Label>
              <select
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                value={debtorId}
                onChange={(e) => setDebtorId(e.target.value)}
              >
                <option value="">-- เลือกลูกหนี้ --</option>
                {debtors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <Button variant="link" className="w-fit px-0" onClick={() => setCreatingNewDebtor(true)}>
                + เพิ่มลูกหนี้ใหม่
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>ชื่อลูกหนี้ใหม่</Label>
              <Input value={newDebtorName} onChange={(e) => setNewDebtorName(e.target.value)} />
              <Button variant="link" className="w-fit px-0" onClick={() => setCreatingNewDebtor(false)}>
                เลือกจากลูกหนี้เดิมแทน
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>จำนวนเงินและหน่วยดอกเบี้ย</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>จำนวนเงินต้น (บาท)</Label>
            <Input
              type="number"
              value={principal}
              onChange={(e) => {
                setPrincipal(Number(e.target.value));
                setSelected(null);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>หน่วยระยะเวลาดอกเบี้ย</Label>
            <div className="flex gap-2">
              {(Object.keys(RATE_UNIT_LABEL) as RateUnit[]).map((unit) => (
                <Button
                  key={unit}
                  type="button"
                  variant={rateUnit === unit ? "default" : "outline"}
                  onClick={() => {
                    setRateUnit(unit);
                    setSelected(null);
                  }}
                >
                  {RATE_UNIT_LABEL[unit]}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            ตารางดอกเบี้ยสุทธิ (อัตราดอกเบี้ย % vs ระยะเวลา {RATE_UNIT_LABEL[rateUnit]})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 border border-border bg-card p-1.5">อัตรา \ ระยะเวลา</th>
                {table.periods.map((p) => (
                  <th key={p} className="border border-border p-1.5 font-normal text-muted-foreground">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.cells.map((row, i) => (
                <tr key={table.rates[i]}>
                  <td className="sticky left-0 border border-border bg-card p-1.5 font-medium">
                    {table.rates[i]}%
                  </td>
                  {row.map((cell) => {
                    const isSelected =
                      selected?.rate === cell.ratePercent && selected?.periods === cell.periods;
                    return (
                      <td
                        key={cell.periods}
                        onClick={() => setSelected({ rate: cell.ratePercent, periods: cell.periods })}
                        className={`cursor-pointer border border-border p-1.5 text-right tabular-nums transition-colors hover:bg-accent/10 ${
                          isSelected ? "bg-accent text-accent-foreground hover:bg-accent" : ""
                        }`}
                      >
                        {thb(cell.netInterest)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {selected && (
            <p className="mt-2 text-sm text-muted-foreground">
              เลือกแล้ว: {selected.rate}% × {selected.periods} {RATE_UNIT_LABEL[rateUnit]} → ดอกเบี้ยสุทธิ{" "}
              {thb(buildRateTable(principal).cells
                .flat()
                .find((c) => c.ratePercent === selected.rate && c.periods === selected.periods)
                ?.netInterest ?? 0)}{" "}
              บาท
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>แผนการผ่อนชำระ</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button
              variant={repaymentMode === "bullet" ? "default" : "outline"}
              onClick={() => setRepaymentMode("bullet")}
            >
              จ่ายก้อนเดียว
            </Button>
            <Button
              variant={repaymentMode === "installment" ? "default" : "outline"}
              onClick={() => setRepaymentMode("installment")}
            >
              ผ่อนหลายงวด
            </Button>
          </div>

          {repaymentMode === "installment" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={installmentCalcMode === "interestOnlyBalloon" ? "default" : "outline"}
                  onClick={() => setInstallmentCalcMode("interestOnlyBalloon")}
                >
                  ดอกเบี้ยรายงวด + ต้นก้อนสุดท้าย
                </Button>
                <Button
                  size="sm"
                  variant={installmentCalcMode === "equalInstallment" ? "default" : "outline"}
                  onClick={() => setInstallmentCalcMode("equalInstallment")}
                >
                  แบ่งต้น+ดอกเท่ากันทุกงวด
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Label>จำนวนงวด</Label>
                <Input
                  type="number"
                  className="w-20"
                  min={1}
                  value={numInstallments}
                  onChange={(e) => setNumInstallments(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {selected && schedule.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1.5 font-normal">งวด</th>
                  <th className="p-1.5 font-normal">ครบกำหนด (หน่วยที่)</th>
                  <th className="p-1.5 text-right font-normal">ต้น</th>
                  <th className="p-1.5 text-right font-normal">ดอกเบี้ย</th>
                  <th className="p-1.5 text-right font-normal">รวม</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.seq} className="border-t border-border/70">
                    <td className="p-1.5">{row.seq}</td>
                    <td className="p-1.5">
                      +{row.dueOffset} {RATE_UNIT_LABEL[rateUnit]}
                    </td>
                    <td className="p-1.5 text-right tabular-nums">{thb(row.principalPortion)}</td>
                    <td className="p-1.5 text-right tabular-nums">{thb(row.interestPortion)}</td>
                    <td className="p-1.5 text-right font-medium tabular-nums">{thb(row.amountDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Button size="lg" disabled={submitting} onClick={handleSubmit}>
        {submitting ? "กำลังบันทึก..." : "สร้างสัญญา"}
      </Button>
    </div>
  );
}
