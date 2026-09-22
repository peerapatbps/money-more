// Core interest / repayment calculation logic for MoneyMore.
// Simple (non-compounding) interest, fixed at contract creation.
// Mirrored in apps-script/lib/Interest.gs — keep both in sync.

export type RateUnit = "day" | "week" | "month";
export type RepaymentMode = "bullet" | "installment";
export type InstallmentCalcMode = "interestOnlyBalloon" | "equalInstallment";

export const RATE_UNIT_LABEL: Record<RateUnit, string> = {
  day: "รายวัน",
  week: "รายสัปดาห์",
  month: "รายเดือน",
};

/** Net interest for a given principal, rate% and number of periods. Simple interest: principal * rate% * periods. */
export function calcNetInterest(principal: number, ratePercent: number, periods: number): number {
  return Math.round(principal * (ratePercent / 100) * periods * 100) / 100;
}

export interface RateTableCell {
  ratePercent: number;
  periods: number;
  netInterest: number;
  totalDue: number;
}

/** Builds the rate(%) x duration(periods) matrix shown on the "ปล่อยกู้" page. */
export function buildRateTable(
  principal: number,
  ratePercentRange: number[] = range(3, 15, 1),
  periodsRange: number[] = range(3, 30, 1),
): { rates: number[]; periods: number[]; cells: RateTableCell[][] } {
  const cells = ratePercentRange.map((rate) =>
    periodsRange.map((periods) => {
      const netInterest = calcNetInterest(principal, rate, periods);
      return { ratePercent: rate, periods, netInterest, totalDue: principal + netInterest };
    }),
  );
  return { rates: ratePercentRange, periods: periodsRange, cells };
}

function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let v = start; v <= end; v += step) out.push(v);
  return out;
}

export interface InstallmentRow {
  seq: number;
  dueOffset: number; // periods from start
  amountDue: number;
  principalPortion: number;
  interestPortion: number;
}

/**
 * Builds the repayment schedule.
 * - bullet: single row at `periods`, full principal + interest.
 * - installment: `numInstallments` rows spaced evenly across `periods`.
 *   - interestOnlyBalloon: each row pays interest/numInstallments, last row also pays full principal.
 *   - equalInstallment: (principal+interest) split evenly across all rows.
 */
export function buildRepaymentSchedule(params: {
  principal: number;
  ratePercent: number;
  periods: number;
  repaymentMode: RepaymentMode;
  installmentCalcMode?: InstallmentCalcMode;
  numInstallments?: number;
}): InstallmentRow[] {
  const { principal, ratePercent, periods, repaymentMode } = params;
  const totalInterest = calcNetInterest(principal, ratePercent, periods);

  if (repaymentMode === "bullet") {
    return [
      {
        seq: 1,
        dueOffset: periods,
        amountDue: round2(principal + totalInterest),
        principalPortion: round2(principal),
        interestPortion: round2(totalInterest),
      },
    ];
  }

  const n = Math.max(1, params.numInstallments ?? 1);
  const rows: InstallmentRow[] = [];

  if (params.installmentCalcMode === "equalInstallment") {
    const totalDue = principal + totalInterest;
    const perInstallment = round2(totalDue / n);
    const principalPerInstallment = round2(principal / n);
    const interestPerInstallment = round2(totalInterest / n);
    for (let i = 1; i <= n; i++) {
      const isLast = i === n;
      rows.push({
        seq: i,
        dueOffset: Math.round((periods * i) / n),
        amountDue: isLast
          ? round2(totalDue - perInstallment * (n - 1))
          : perInstallment,
        principalPortion: isLast
          ? round2(principal - principalPerInstallment * (n - 1))
          : principalPerInstallment,
        interestPortion: isLast
          ? round2(totalInterest - interestPerInstallment * (n - 1))
          : interestPerInstallment,
      });
    }
    return rows;
  }

  // interestOnlyBalloon (default)
  const interestPerInstallment = round2(totalInterest / n);
  for (let i = 1; i <= n; i++) {
    const isLast = i === n;
    const interestPortion = isLast
      ? round2(totalInterest - interestPerInstallment * (n - 1))
      : interestPerInstallment;
    const principalPortion = isLast ? round2(principal) : 0;
    rows.push({
      seq: i,
      dueOffset: Math.round((periods * i) / n),
      amountDue: round2(interestPortion + principalPortion),
      principalPortion,
      interestPortion,
    });
  }
  return rows;
}

/** Allocates an incoming payment against outstanding interest first, then principal. */
export function allocatePayment(
  amount: number,
  outstandingInterest: number,
  outstandingPrincipal: number,
): { interestApplied: number; principalApplied: number; remainder: number } {
  const interestApplied = round2(Math.min(amount, outstandingInterest));
  const afterInterest = round2(amount - interestApplied);
  const principalApplied = round2(Math.min(afterInterest, outstandingPrincipal));
  const remainder = round2(afterInterest - principalApplied);
  return { interestApplied, principalApplied, remainder };
}

/** Early-close ("ปิดยอดพิเศษ") calculation. */
export function calcEarlyClose(params: {
  outstandingPrincipal: number;
  originalInterestOwed: number; // interest still owed under the original locked rate
  specialRatePercent: number;
}): { specialInterest: number; difference: number; totalDue: number } {
  const specialInterest = round2(
    params.outstandingPrincipal * (params.specialRatePercent / 100),
  );
  const difference = round2(params.originalInterestOwed - specialInterest);
  const totalDue = round2(params.outstandingPrincipal + specialInterest);
  return { specialInterest, difference, totalDue };
}

export const EARLY_CLOSE_THRESHOLD_RATIO = 0.8;

/** True when total collected so far is >= 80% of total amount due (principal + interest). */
export function isEligibleForEarlyClose(totalCollected: number, totalDue: number): boolean {
  if (totalDue <= 0) return false;
  return totalCollected / totalDue >= EARLY_CLOSE_THRESHOLD_RATIO;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
