// Mirrors lib/interest.ts on the frontend. Keep both in sync.

function calcNetInterest_(principal, ratePercent, periods) {
  return round2_(principal * (ratePercent / 100) * periods);
}

function round2_(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Builds the repayment schedule rows: [{ seq, dueOffset, amountDue, principalPortion, interestPortion }]
 */
function buildRepaymentSchedule_(params) {
  var principal = params.principal;
  var ratePercent = params.ratePercent;
  var periods = params.periods;
  var repaymentMode = params.repaymentMode;
  var totalInterest = calcNetInterest_(principal, ratePercent, periods);

  if (repaymentMode === "bullet") {
    return [
      {
        seq: 1,
        dueOffset: periods,
        amountDue: round2_(principal + totalInterest),
        principalPortion: round2_(principal),
        interestPortion: round2_(totalInterest),
      },
    ];
  }

  var n = Math.max(1, params.numInstallments || 1);
  var rows = [];

  if (params.installmentCalcMode === "equalInstallment") {
    var totalDue = principal + totalInterest;
    var perInstallment = round2_(totalDue / n);
    var principalPerInstallment = round2_(principal / n);
    var interestPerInstallment = round2_(totalInterest / n);
    for (var i = 1; i <= n; i++) {
      var isLast = i === n;
      rows.push({
        seq: i,
        dueOffset: Math.round((periods * i) / n),
        amountDue: isLast ? round2_(totalDue - perInstallment * (n - 1)) : perInstallment,
        principalPortion: isLast
          ? round2_(principal - principalPerInstallment * (n - 1))
          : principalPerInstallment,
        interestPortion: isLast
          ? round2_(totalInterest - interestPerInstallment * (n - 1))
          : interestPerInstallment,
      });
    }
    return rows;
  }

  // interestOnlyBalloon (default)
  var interestPerInstallment2 = round2_(totalInterest / n);
  for (var j = 1; j <= n; j++) {
    var isLast2 = j === n;
    var interestPortion = isLast2
      ? round2_(totalInterest - interestPerInstallment2 * (n - 1))
      : interestPerInstallment2;
    var principalPortion = isLast2 ? round2_(principal) : 0;
    rows.push({
      seq: j,
      dueOffset: Math.round((periods * j) / n),
      amountDue: round2_(interestPortion + principalPortion),
      principalPortion: principalPortion,
      interestPortion: interestPortion,
    });
  }
  return rows;
}

function allocatePayment_(amount, outstandingInterest, outstandingPrincipal) {
  var interestApplied = round2_(Math.min(amount, outstandingInterest));
  var afterInterest = round2_(amount - interestApplied);
  var principalApplied = round2_(Math.min(afterInterest, outstandingPrincipal));
  return { interestApplied: interestApplied, principalApplied: principalApplied };
}

function addPeriod_(date, unit, count) {
  var d = new Date(date);
  if (unit === "day") d.setDate(d.getDate() + count);
  else if (unit === "week") d.setDate(d.getDate() + count * 7);
  else if (unit === "month") d.setMonth(d.getMonth() + count);
  return d;
}
