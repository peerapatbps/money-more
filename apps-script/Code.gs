// Web App entrypoint. Deploy as: Execute as "Me", Access "Anyone".
// All requests are POST with JSON body: { action, token, ...payload }
// Protected by a shared secret checked against Script Property SHEETS_API_SECRET.

var EARLY_CLOSE_THRESHOLD_RATIO = 0.8;

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ error: "invalid JSON body" });
  }

  var secret = PropertiesService.getScriptProperties().getProperty("SHEETS_API_SECRET");
  if (!secret || body.token !== secret) {
    return jsonOut_({ error: "unauthorized" });
  }

  try {
    var data = route_(body.action, body);
    return jsonOut_({ data: data });
  } catch (err) {
    return jsonOut_({ error: err.message || String(err) });
  }
}

function route_(action, payload) {
  switch (action) {
    case "listDebtors":
      return readAll_("Debtors");
    case "createDebtor":
      return createDebtor_(payload);
    case "listLoans":
      return listLoans_(payload.debtorId);
    case "createLoan":
      return createLoan_(payload);
    case "listInstallments":
      return readAll_("Installments").filter(function (i) {
        return i.loanId === payload.loanId;
      });
    case "listPayments":
      return readAll_("Payments").filter(function (p) {
        return p.loanId === payload.loanId;
      });
    case "recordPayment":
      return recordPayment_(payload);
    case "earlyClose":
      return earlyClose_(payload);
    case "getSummary":
      return getSummary_();
    default:
      throw new Error("Unknown action: " + action);
  }
}

function createDebtor_(payload) {
  var debtor = {
    id: newId_(),
    name: payload.name,
    phone: payload.phone || "",
    note: payload.note || "",
    createdAt: new Date().toISOString(),
  };
  appendRow_("Debtors", debtor);
  return debtor;
}

function listLoans_(debtorId) {
  var loans = readAll_("Loans");
  if (!debtorId) return loans;
  return loans.filter(function (l) {
    return l.debtorId === debtorId;
  });
}

function createLoan_(payload) {
  var startDate = new Date();
  var schedule = buildRepaymentSchedule_({
    principal: payload.principal,
    ratePercent: payload.ratePercent,
    periods: payload.durationUnits,
    repaymentMode: payload.repaymentMode,
    installmentCalcMode: payload.installmentCalcMode,
    numInstallments: payload.numInstallments,
  });

  var totalInterest = calcNetInterest_(payload.principal, payload.ratePercent, payload.durationUnits);
  var lastRow = schedule[schedule.length - 1];
  var dueDate = addPeriod_(startDate, payload.rateUnit, lastRow.dueOffset);

  var loan = {
    id: newId_(),
    debtorId: payload.debtorId,
    principal: payload.principal,
    rateUnit: payload.rateUnit,
    ratePercent: payload.ratePercent,
    durationUnits: payload.durationUnits,
    repaymentMode: payload.repaymentMode,
    installmentCalcMode: payload.installmentCalcMode || "",
    numInstallments: payload.numInstallments || 1,
    startDate: startDate.toISOString(),
    dueDate: dueDate.toISOString(),
    status: "active",
    totalInterest: totalInterest,
    totalDue: round2_(payload.principal + totalInterest),
    createdAt: new Date().toISOString(),
  };
  appendRow_("Loans", loan);

  var installments = schedule.map(function (row) {
    var inst = {
      id: newId_(),
      loanId: loan.id,
      seq: row.seq,
      dueDate: addPeriod_(startDate, payload.rateUnit, row.dueOffset).toISOString(),
      amountDue: row.amountDue,
      principalPortion: row.principalPortion,
      interestPortion: row.interestPortion,
      status: "pending",
      paidDate: "",
      paidAmount: "",
    };
    appendRow_("Installments", inst);
    return inst;
  });

  return { loan: loan, installments: installments };
}

function recordPayment_(payload) {
  var loans = readAll_("Loans");
  var loan = loans.filter(function (l) {
    return l.id === payload.loanId;
  })[0];
  if (!loan) throw new Error("Loan not found");

  var payments = readAll_("Payments").filter(function (p) {
    return p.loanId === payload.loanId;
  });
  var collectedInterest = payments.reduce(function (s, p) {
    return s + Number(p.interestApplied || 0);
  }, 0);
  var collectedPrincipal = payments.reduce(function (s, p) {
    return s + Number(p.principalApplied || 0);
  }, 0);
  var outstandingInterest = Math.max(0, loan.totalInterest - collectedInterest);
  var outstandingPrincipal = Math.max(0, loan.principal - collectedPrincipal);

  var alloc = allocatePayment_(payload.amount, outstandingInterest, outstandingPrincipal);

  var payment = {
    id: newId_(),
    loanId: loan.id,
    installmentId: payload.installmentId || "",
    amount: payload.amount,
    principalApplied: alloc.principalApplied,
    interestApplied: alloc.interestApplied,
    paymentDate: payload.paymentDate || new Date().toISOString(),
    note: payload.note || "",
    isEarlyClose: false,
    specialRate: "",
  };
  appendRow_("Payments", payment);

  updateInstallmentStatuses_(loan.id);

  return payment;
}

function updateInstallmentStatuses_(loanId) {
  var installments = readAll_("Installments").filter(function (i) {
    return i.loanId === loanId;
  });
  var payments = readAll_("Payments").filter(function (p) {
    return p.loanId === loanId;
  });
  var totalPaid = payments.reduce(function (s, p) {
    return s + Number(p.amount || 0);
  }, 0);

  var cumulativeDue = 0;
  var now = new Date();
  installments.forEach(function (inst) {
    cumulativeDue += Number(inst.amountDue);
    if (inst.status === "waived") return;
    if (totalPaid >= cumulativeDue) {
      updateRowById_("Installments", inst.id, { status: "paid" });
    } else if (new Date(inst.dueDate) < now) {
      updateRowById_("Installments", inst.id, { status: "overdue" });
    } else {
      updateRowById_("Installments", inst.id, { status: "pending" });
    }
  });
}

function earlyClose_(payload) {
  var loans = readAll_("Loans");
  var loan = loans.filter(function (l) {
    return l.id === payload.loanId;
  })[0];
  if (!loan) throw new Error("Loan not found");

  var payments = readAll_("Payments").filter(function (p) {
    return p.loanId === payload.loanId;
  });
  var collectedInterest = payments.reduce(function (s, p) {
    return s + Number(p.interestApplied || 0);
  }, 0);
  var collectedPrincipal = payments.reduce(function (s, p) {
    return s + Number(p.principalApplied || 0);
  }, 0);
  var outstandingPrincipal = Math.max(0, loan.principal - collectedPrincipal);
  var outstandingInterest = Math.max(0, loan.totalInterest - collectedInterest);

  var specialInterest = round2_(outstandingPrincipal * (payload.specialRatePercent / 100));
  var totalDue = round2_(outstandingPrincipal + specialInterest);

  var payment = {
    id: newId_(),
    loanId: loan.id,
    installmentId: "",
    amount: totalDue,
    principalApplied: outstandingPrincipal,
    interestApplied: specialInterest,
    paymentDate: new Date().toISOString(),
    note: "early close",
    isEarlyClose: true,
    specialRate: payload.specialRatePercent,
  };
  appendRow_("Payments", payment);

  var installments = readAll_("Installments").filter(function (i) {
    return i.loanId === loan.id;
  });
  installments.forEach(function (inst) {
    if (inst.status !== "paid") {
      updateRowById_("Installments", inst.id, { status: "waived" });
    }
  });

  updateRowById_("Loans", loan.id, { status: "closed" });
  loan.status = "closed";

  return { payment: payment, loan: loan };
}

function getSummary_() {
  var loans = readAll_("Loans");
  var debtors = readAll_("Debtors");
  var installments = readAll_("Installments");
  var payments = readAll_("Payments");
  var now = new Date();

  var activeLoans = loans.filter(function (l) {
    return l.status === "active";
  });

  var outstandingPrincipal = 0;
  var expectedInterest = 0;
  var dueToday = [];
  var eligibleForClose = [];

  activeLoans.forEach(function (loan) {
    var loanPayments = payments.filter(function (p) {
      return p.loanId === loan.id;
    });
    var collectedInterest = loanPayments.reduce(function (s, p) {
      return s + Number(p.interestApplied || 0);
    }, 0);
    var collectedPrincipal = loanPayments.reduce(function (s, p) {
      return s + Number(p.principalApplied || 0);
    }, 0);
    var collected = loanPayments.reduce(function (s, p) {
      return s + Number(p.amount || 0);
    }, 0);
    outstandingPrincipal += Math.max(0, loan.principal - collectedPrincipal);
    expectedInterest += Math.max(0, loan.totalInterest - collectedInterest);

    var debtor = debtors.filter(function (d) {
      return d.id === loan.debtorId;
    })[0];

    installments
      .filter(function (i) {
        return i.loanId === loan.id && (i.status === "pending" || i.status === "overdue");
      })
      .forEach(function (inst) {
        var due = new Date(inst.dueDate);
        if (due <= now) {
          dueToday.push({ loan: loan, debtor: debtor, installment: inst });
        }
      });

    if (loan.totalDue > 0 && collected / loan.totalDue >= EARLY_CLOSE_THRESHOLD_RATIO) {
      eligibleForClose.push({ loan: loan, debtor: debtor, collected: collected, totalDue: loan.totalDue });
    }
  });

  var overdueCount = installments.filter(function (i) {
    return i.status === "overdue";
  }).length;

  return {
    outstandingPrincipal: round2_(outstandingPrincipal),
    expectedInterest: round2_(expectedInterest),
    activeLoanCount: activeLoans.length,
    overdueCount: overdueCount,
    dueToday: dueToday,
    eligibleForClose: eligibleForClose,
  };
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
