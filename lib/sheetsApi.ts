// Client wrapper for calling the Google Apps Script Web App backend.
// The Apps Script deployment URL and shared secret live in env vars.

const BASE_URL = process.env.SHEETS_API_URL ?? "";
const SECRET = process.env.SHEETS_API_SECRET ?? "";

export type Debtor = {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  createdAt: string;
};

export type Loan = {
  id: string;
  debtorId: string;
  principal: number;
  rateUnit: "day" | "week" | "month";
  ratePercent: number;
  durationUnits: number;
  repaymentMode: "bullet" | "installment";
  installmentCalcMode?: "interestOnlyBalloon" | "equalInstallment";
  numInstallments?: number;
  startDate: string;
  dueDate: string;
  status: "active" | "closed";
  totalInterest: number;
  totalDue: number;
  createdAt: string;
};

export type Installment = {
  id: string;
  loanId: string;
  seq: number;
  dueDate: string;
  amountDue: number;
  principalPortion: number;
  interestPortion: number;
  status: "pending" | "paid" | "overdue" | "waived";
  paidDate?: string;
  paidAmount?: number;
};

export type Payment = {
  id: string;
  loanId: string;
  installmentId?: string;
  amount: number;
  principalApplied: number;
  interestApplied: number;
  paymentDate: string;
  note?: string;
  isEarlyClose: boolean;
  specialRate?: number;
};

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!BASE_URL) throw new Error("SHEETS_API_URL is not configured");
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token: SECRET, ...payload }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data as T;
}

export const sheetsApi = {
  listDebtors: () => call<Debtor[]>("listDebtors"),
  createDebtor: (data: { name: string; phone?: string; note?: string }) =>
    call<Debtor>("createDebtor", data),

  listLoans: (debtorId?: string) => call<Loan[]>("listLoans", { debtorId }),
  createLoan: (data: Omit<Loan, "id" | "status" | "totalInterest" | "totalDue" | "createdAt">) =>
    call<{ loan: Loan; installments: Installment[] }>("createLoan", data),

  listInstallments: (loanId: string) => call<Installment[]>("listInstallments", { loanId }),
  listPayments: (loanId: string) => call<Payment[]>("listPayments", { loanId }),

  recordPayment: (data: { loanId: string; amount: number; paymentDate: string; note?: string }) =>
    call<Payment>("recordPayment", data),

  earlyClose: (data: { loanId: string; specialRatePercent: number }) =>
    call<{ payment: Payment; loan: Loan }>("earlyClose", data),

  getSummary: () =>
    call<{
      outstandingPrincipal: number;
      expectedInterest: number;
      activeLoanCount: number;
      overdueCount: number;
      dueToday: Array<{ loan: Loan; debtor: Debtor; installment: Installment }>;
      eligibleForClose: Array<{ loan: Loan; debtor: Debtor; collected: number; totalDue: number }>;
    }>("getSummary"),
};
