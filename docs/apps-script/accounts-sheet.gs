/**
 * Board OS ← "Andreal Accounts 26-27" (Invoice Responses tab)
 *
 * Paste this whole file into the accounts sheet: Extensions → Apps Script (replace any sample code), then:
 *   1. Deploy → New deployment → type "Web app"
 *        Execute as: Me      Who has access: Anyone
 *      → Deploy → Authorize access (choose your Google account → Advanced → Go to project → Allow).
 *   2. Deploy → Manage deployments → copy the Web app URL (ends in /exec) into WEB_APP_URL below, save.
 *   3. Reload the sheet → menu Board OS → Copy link (allow the extra permission once).
 *      A "Board OS link" box opens: click Copy link, then paste it in
 *      Board OS → Settings → Integrations → Accounts sheet → Connect.
 *
 * The link contains a secret token; without it the web app returns nothing. Read-only: it never changes the sheet.
 * To cut access, run "resetToken" (then paste the new link in Board OS) or archive the deployment.
 */
const TAB = 'Invoice Responses';
const WEB_APP_URL = ''; // Deploy → Manage deployments → Web app URL (…/exec)

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

function boardOsLink_() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('BOARD_OS_TOKEN');
  if (!token) { token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); props.setProperty('BOARD_OS_TOKEN', token); }
  const url = WEB_APP_URL || ScriptApp.getService().getUrl();
  if (!url || !/\/exec$/.test(url)) throw new Error('Set WEB_APP_URL to the Web app URL from Deploy → Manage deployments (it ends in /exec).');
  return url + '?token=' + token;
}

/** Opens a box in the sheet with the link and a Copy button (menu Board OS → Copy link). */
function copyBoardOsLink() {
  const link = boardOsLink_();
  const html = HtmlService.createHtmlOutput(
    '<div style="font:13px Arial">Paste this in Board OS → Settings → Integrations → Accounts sheet → Connect.<br><br>' +
    '<input id="l" readonly style="width:100%;padding:6px" value="' + link + '"><br><br>' +
    '<button id="b" style="padding:6px 14px" onclick="var l=document.getElementById(\'l\');l.focus();l.select();' +
    'document.execCommand(\'copy\');this.textContent=\'Copied ✓\'">Copy link</button></div>'
  ).setWidth(620).setHeight(150);
  SpreadsheetApp.getUi().showModalDialog(html, 'Board OS link');
}

/** Adds a Board OS menu to the sheet (Board OS → Copy link). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Board OS').addItem('Copy link', 'copyBoardOsLink').addToUi();
}

function showBoardOsLink() {
  Logger.log(boardOsLink_());
}

function resetToken() {
  PropertiesService.getScriptProperties().deleteProperty('BOARD_OS_TOKEN');
  boardOsLink_();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
