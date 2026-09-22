// Thin helpers over SpreadsheetApp for reading/writing rows as objects,
// keyed by header row. All 4 sheets (Debtors, Loans, Installments, Payments)
// must have a header row matching the field names used in Code.gs.

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Sheet not found: " + name);
  return sheet;
}

function readAll_(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join("") === "") continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    rows.push(obj);
  }
  return rows;
}

function appendRow_(sheetName, obj) {
  var sheet = getSheet_(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) {
    return obj[h] !== undefined ? obj[h] : "";
  });
  sheet.appendRow(row);
  return obj;
}

function updateRowById_(sheetName, id, patch) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf("id");
  for (var i = 1; i < values.length; i++) {
    if (values[i][idCol] === id) {
      for (var key in patch) {
        var col = headers.indexOf(key);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(patch[key]);
      }
      return true;
    }
  }
  return false;
}

function newId_() {
  return Utilities.getUuid();
}
