// Run setupSheets_() once manually from the Apps Script editor to create
// the 4 tabs with correct headers in a fresh Google Sheet.

function setupSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetWithHeaders_(ss, "Debtors", ["id", "name", "phone", "note", "createdAt"]);
  createSheetWithHeaders_(ss, "Loans", [
    "id", "debtorId", "principal", "rateUnit", "ratePercent", "durationUnits",
    "repaymentMode", "installmentCalcMode", "numInstallments",
    "startDate", "dueDate", "status", "totalInterest", "totalDue", "createdAt",
  ]);
  createSheetWithHeaders_(ss, "Installments", [
    "id", "loanId", "seq", "dueDate", "amountDue", "principalPortion",
    "interestPortion", "status", "paidDate", "paidAmount",
  ]);
  createSheetWithHeaders_(ss, "Payments", [
    "id", "loanId", "installmentId", "amount", "principalApplied", "interestApplied",
    "paymentDate", "note", "isEarlyClose", "specialRate",
  ]);

  // Remove the default "Sheet1" if it's still empty.
  var sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && sheet1.getLastRow() === 0) ss.deleteSheet(sheet1);
}

function createSheetWithHeaders_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

// Run this once to set your shared secret (Project Settings > Script Properties
// can also be used via the UI instead).
function setSecret_() {
  PropertiesService.getScriptProperties().setProperty("SHEETS_API_SECRET", "REPLACE_WITH_A_LONG_RANDOM_STRING");
}
