const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { buildDocumentHtml } = require('./lib/pdf-template');

const payload = {
  cover: { adressChecked: true, adress: 'Testgatan 1', bolagChecked: true, bolag: 'Test AB', orgnrChecked: false, orgnr: '', project: 'P-999' },
  days: [{ date: '2026-08-14', rows: [{ arbetare: 'Test Person', passTyp1: '4', passTyp2: 'Dag', project: 'Test Projekt' }] }]
};

const pdfPath = path.join(__dirname, '_smoke_output.pdf');
const draftPath = pdfPath.replace(/\.pdf$/i, '') + '.json';

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  const html = buildDocumentHtml(payload);
  const tempHtmlPath = path.join(__dirname, '_smoke_tmp.html');
  await fs.writeFile(tempHtmlPath, html, 'utf-8');
  await win.loadFile(tempHtmlPath);
  const pdfBuffer = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'none' } });
  await fs.writeFile(pdfPath, pdfBuffer);
  await fs.writeFile(draftPath, JSON.stringify({ days: payload.days, cover: payload.cover }, null, 2), 'utf-8');
  win.destroy();
  await fs.unlink(tempHtmlPath).catch(() => {});

  // Now simulate "open draft": read it back exactly like the open-draft handler does
  const raw = await fs.readFile(draftPath, 'utf-8');
  const loaded = JSON.parse(raw);

  const roundTripOk =
    loaded.cover.bolag === payload.cover.bolag &&
    loaded.cover.orgnrChecked === false &&
    loaded.days[0].rows[0].arbetare === 'Test Person' &&
    loaded.days[0].date === '2026-08-14';

  console.log('PDF_BYTES=' + pdfBuffer.length);
  console.log('ROUND_TRIP_OK=' + roundTripOk);
  console.log('LOADED=' + JSON.stringify(loaded));

  app.quit();
});
