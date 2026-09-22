import { auth } from "@/auth";
import { sheetsApi } from "@/lib/sheetsApi";
import { isEligibleForEarlyClose } from "@/lib/interest";
import { DebtorDetailClient } from "./debtor-detail-client";

export default async function DebtorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await auth();
  const { id } = await params;

  const [debtors, loans] = await Promise.all([sheetsApi.listDebtors(), sheetsApi.listLoans(id)]);
  const debtor = debtors.find((d) => d.id === id);
  if (!debtor) return <p>ไม่พบลูกหนี้</p>;

  const loansWithDetails = await Promise.all(
    loans.map(async (loan) => {
      const [installments, payments] = await Promise.all([
        sheetsApi.listInstallments(loan.id),
        sheetsApi.listPayments(loan.id),
      ]);
      const collected = payments.reduce((sum, p) => sum + p.amount, 0);
      const collectedInterest = payments.reduce((sum, p) => sum + p.interestApplied, 0);
      const collectedPrincipal = payments.reduce((sum, p) => sum + p.principalApplied, 0);
      const outstandingPrincipal = Math.max(0, loan.principal - collectedPrincipal);
      const outstandingInterest = Math.max(0, loan.totalInterest - collectedInterest);
      const eligible = loan.status === "active" && isEligibleForEarlyClose(collected, loan.totalDue);
      return {
        loan,
        installments,
        payments,
        collected,
        collectedInterest,
        collectedPrincipal,
        outstandingPrincipal,
        outstandingInterest,
        eligible,
      };
    }),
  );

  return <DebtorDetailClient debtor={debtor} loans={loansWithDetails} />;
}
