/**
 * FlowIQ Workshop Contacts – receives the welcome-form data from the Next.js app.
 * Paste into the Contacts sheet: Extensions → Apps Script. See README step 1.
 * Script property SHARED_SECRET must equal CONTACTS_WEBHOOK_SECRET in Vercel.
 */
var SHEET = 'Contacts';

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET') || '';
    if (!secret || d.secret !== secret) return out_({ ok: false, error: 'unauthorised' });

    var clean = function (v, n) { return String(v == null ? '' : v).replace(/^[=+\-@]/, "'$&").slice(0, n); };
    var email = clean(d.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out_({ ok: false, error: 'bad email' });

    lock.waitLock(10000);
    SpreadsheetApp.getActive().getSheetByName(SHEET).appendRow([
      new Date(), clean(d.name, 80), clean(d.mobile, 15), email,
      clean(d.company, 120), clean(d.consent, 5), clean(d.id, 40)
    ]);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function doGet() { return out_({ ok: true, service: 'FlowIQ contacts' }); }

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
