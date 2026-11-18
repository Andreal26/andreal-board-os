/**
 * Board OS ← "Andreal Accounts 26-27" (Invoice Responses tab)
 *
 * Paste this whole file into the accounts sheet: Extensions → Apps Script (replace any sample code), then:
 *   1. Deploy → New deployment → type "Web app"
 *        Execute as: Me      Who has access: Anyone
 *      → Deploy → Authorize access (choose your Google account → Advanced → Go to project → Allow).
 *   2. Back in the editor choose the function "showBoardOsLink" in the toolbar and click Run.
 *      The Execution log prints the link to paste into Board OS → Settings → Integrations → Accounts sheet.
 *
 * The link contains a secret token; without it the web app returns nothing. Read-only: it never changes the sheet.
 * To cut access, run "resetToken" (then paste the new link in Board OS) or archive the deployment.
 */
const TAB = 'Invoice Responses';

function doGet(e) {
  const token = PropertiesService.getScriptProperties().getProperty('BOARD_OS_TOKEN');
  if (!token || !e || !e.parameter || e.parameter.token !== token) return json_({ error: 'unauthorized' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TAB);
  if (!sh) return json_({ error: 'tab not found: ' + TAB });
  const tz = ss.getSpreadsheetTimeZone();
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(String);

  // The tab has thousands of empty formula rows: find the last row with a Job Number or Invoice No.
  const jobCol = header.indexOf('Job Number') + 1, invCol = header.indexOf('Invoice No') + 1;
  const n = sh.getLastRow() - 1;
  if (n < 1) return json_({ header: header, rows: [] });
  const keyA = sh.getRange(2, jobCol, n, 1).getValues(), keyB = sh.getRange(2, invCol, n, 1).getValues();
  let last = 0;
  for (let i = n - 1; i >= 0; i--) if (String(keyA[i][0]).trim() || String(keyB[i][0]).trim()) { last = i + 1; break; }
  if (!last) return json_({ header: header, rows: [] });

  const rows = sh.getRange(2, 1, last, lastCol).getValues()
    .filter(function (r) { return String(r[jobCol - 1]).trim() || String(r[invCol - 1]).trim(); })
    .map(function (r) {
      return r.map(function (v) { return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v; });
    });
  return json_({ sheet: TAB, fetchedAt: new Date().toISOString(), header: header, rows: rows });
}

function showBoardOsLink() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('BOARD_OS_TOKEN');
  if (!token) { token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); props.setProperty('BOARD_OS_TOKEN', token); }
  const url = ScriptApp.getService().getUrl();
  if (!url) { Logger.log('Deploy the script as a Web app first (Deploy → New deployment → Web app), then run this again.'); return; }
  Logger.log('Paste this link in Board OS → Settings → Integrations → Accounts sheet:\n' + url + '?token=' + token);
}

function resetToken() {
  PropertiesService.getScriptProperties().deleteProperty('BOARD_OS_TOKEN');
  showBoardOsLink();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
