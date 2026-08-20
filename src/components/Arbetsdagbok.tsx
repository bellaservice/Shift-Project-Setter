import { COMPANY } from "@/lib/company";
import { formatHoursSv } from "@/lib/format";
import type { ArbetsdagbokData } from "@/lib/types";

/**
 * The layout is DocMaker's `lib/pdf-template.js`, with the paper model rebuilt
 * so a browser can print it. Three things differ from that file, deliberately:
 *
 *  - **Real sheets.** DocMaker put the whole document in one padded `<body>`
 *    and leaned on Electron's PDF engine. In a browser, `<body>` padding only
 *    applies to the first and last printed page, so page 2 onward would start
 *    at the paper edge. Here `@page` carries the margins, which every page
 *    gets, and each `.ad-sheet` is an explicit page. On screen the same
 *    elements render as visible A4 sheets, so the preview is what gets saved.
 *  - **The cover is exactly one page high** (`241mm` = A4 minus the vertical
 *    page margins), not `100vh`. `100vh` is the whole 297mm paper *inside* a
 *    box already inset by 50mm of margin, which overflowed the cover onto page
 *    two and pushed GODKÄND AV under the footer.
 *  - The day table's fourth column is "Tjänst", not "Project". DocMaker had
 *    two unrelated fields both called Project; here the cover keeps that name
 *    and the column says what it actually holds.
 */
const DOCUMENT_CSS = `
.ad-doc {
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #1a1a1a;
  font-size: 10.5pt;
}
.ad-doc * { box-sizing: border-box; }

.ad-pagegrid { width: 100%; border-collapse: collapse; }
.ad-pagegrid > tbody > tr > td, .ad-pagegrid > tfoot > tr > td { padding: 0; }

.ad-sheet { display: flex; flex-direction: column; background: #fff; position: relative; }
.ad-sheet-inner { flex: 1; display: flex; flex-direction: column; }

.ad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14mm;
}
.ad-logo { height: 24mm; width: 24mm; object-fit: contain; }
.ad-title { font-size: 19pt; font-weight: 700; color: #111; letter-spacing: 0.2px; }

.ad-cover-meta {
  width: fit-content;
  max-width: 90mm;
  margin-left: auto;
  text-align: left;
  margin-top: 2mm;
  font-size: 10pt;
  line-height: 1.8;
}
.ad-line { margin-bottom: 0; }
.ad-b { font-weight: 700; }
.ad-divider { border: none; border-top: 1.25px solid #111; margin: 10mm 0; }
.ad-cover-project, .ad-cover-hours { font-size: 11pt; margin-bottom: 4mm; }
/* margin-top:auto mot .ad-sheet-inner: signaturblocket sitter alltid längst ned
   på försättsbladet, oavsett hur många beställarrader som fanns att skriva. */
.ad-approval { margin-top: auto; }
.ad-approval-h { font-weight: 700; letter-spacing: 0.6px; margin-bottom: 12mm; }
.ad-signline {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  font-size: 10.5pt;
  margin-bottom: 10mm;
  white-space: nowrap;
}
.ad-signline:last-child { margin-bottom: 0; }
.ad-blank { flex: 1; border-bottom: 1px solid #111; margin-bottom: 2px; }

.ad-day { margin-bottom: 9mm; }
.ad-date { font-size: 12.5pt; font-weight: 700; margin-bottom: 3mm; color: #111; }

.ad-table { width: 100%; }
.ad-row { display: grid; grid-template-columns: 1.1fr 1fr 1.3fr 1.6fr; }
.ad-row-head { background: #FBEFD8; }
.ad-row-head .ad-cell { font-weight: 700; font-size: 9pt; color: #303c54; padding: 3mm 4mm; }
.ad-rows .ad-row:nth-child(odd) { background: #FDF9F1; }
.ad-cell { padding: 3mm 4mm; font-size: 9.5pt; }

.ad-empty {
  border: 1.25px solid #111;
  padding: 6mm;
  font-size: 10.5pt;
  font-weight: 700;
  text-align: center;
}

.ad-footer {
  padding-top: 3mm;
  border-top: 0.75px solid #cfcfcf;
  display: grid;
  grid-template-columns: 1.3fr 1fr 1.4fr;
  gap: 6mm;
  font-size: 8pt;
  color: #767676;
  line-height: 1.5;
}
.ad-footer-legal { text-align: right; }

@media screen {
  /* Appens skal är en 672px-kolumn. Ett A4-ark är 794px brett, så utan detta
     kapas förhandsvisningen på höjden av en sida den aldrig får se. */
  .app-shell { max-width: none; }

  .ad-viewport { padding: 4mm 0; }
  .ad-sheet {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 18mm 36mm 18mm;
    margin: 0 auto 8mm;
    /* Arket ligger numera pa en svart sida. En morkbla skugga syns inte alls
       mot svart, sa lyftet gors i stallet av en ljus hairline runt papperet
       plus en varm, mycket bred glod under det — samma trick som glass-panelen
       anvander, med tecknen omvanda eftersom det ljusa foremalet ar det som
       ligger pa det morka underlaget och inte tvartom. Bara @media screen: pa
       papper finns varken kant eller glod. */
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.14),
      0 18px 50px -12px rgba(0, 0, 0, 0.9),
      0 0 60px -20px rgba(255, 185, 46, 0.28);
  }
  /* Försättsbladet är exakt ett ark, aldrig mer. */
  .ad-sheet-cover { height: 297mm; min-height: 0; }
  /* Samma 12mm som utskriftens sidfot, så arken ser ut som sidorna blir. */
  .ad-footer-screen { position: absolute; left: 18mm; right: 18mm; bottom: 12mm; }
  /* Utskriftens sidfot bor i en tfoot; på skärmen visas i stället varje arks
     egen, så förhandsvisningen har en sidfot per sida precis som utskriften. */
  .ad-pagefoot { display: none; }

  /* Hela arkets bredd ska rymmas på skärmen — en avkapad förhandsvisning är
     värdelös som förhandsvisning. Zoom och inte transform:scale, för zoom
     krymper även layoutrutan; en transform hade lämnat kvar 794px tomrum.
     Trappa i stället för calc(): CSS kan inte dela längd med längd, så det går
     inte att räkna fram förhållandet 100vw / 794px. */
  @media (max-width: 858px) { .ad-viewport { zoom: 0.82; } }
  @media (max-width: 700px) { .ad-viewport { zoom: 0.66; } }
  @media (max-width: 560px) { .ad-viewport { zoom: 0.52; } }
  @media (max-width: 440px) { .ad-viewport { zoom: 0.42; } }
  @media (max-width: 360px) { .ad-viewport { zoom: 0.34; } }
}

@media print {
  /* Marginalen ligger på @page, inte på ett element: då får ALLA sidor den.
     Elementpadding gör det inte — den gäller bara första och sista sidan. */
  @page { size: A4; margin: 20mm 18mm 14mm 18mm; }

  /* Appens skal är en telefonbred kolumn med sidmarginal. Utan detta skrivs
     A4-sidan ut inuti den. */
  .app-shell { max-width: none !important; padding: 0 !important; margin: 0 !important; }
  .ad-noprint { display: none !important; }
  body { background: #fff !important; }

  .ad-viewport { overflow: visible; padding: 0; }
  .ad-sheet { width: auto; min-height: 0; padding: 0; margin: 0; box-shadow: none; }

  /* 232mm, mätt fram och inte gissad: sidytan är 297 - 20 - 14 = 263mm, och
     tfoot-sidfoten mäter 26,2mm på varje sida, alltså 236,8mm kvar åt
     innehållet. 232mm fyller försättsbladet så att signaturblocket hamnar
     längst ned, med ~5mm marginal innan det skulle spilla över till sida 2.
     Ändras sidfotens höjd måste det här talet räknas om. */
  .ad-sheet-cover { height: 232mm; page-break-after: always; break-after: page; }

  /* Dagarksidan måste också fylla sin sida. Utan detta slutar arket direkt
     efter sista raden, och tfoot-sidfoten följer med upp mitt på sidan i
     stället för att sitta längst ned — sista sidan är den enda där browsern
     inte nålar fast tfoot vid sidfoten själv. 235mm + sidfotens 26,2mm =
     261,2mm av sidytans 263mm, alltså nästan exakt samma höjd som den nålade
     sidfoten på sida 1, med knappt 2mm slack kvar innan en tom sida skulle
     tvingas fram. Räcker inte dagarna till en sida blir resten tomt papper,
     precis som i ett pappersdokument. */
  .ad-sheet-days { min-height: 235mm; }

  .ad-day { page-break-inside: avoid; }

  /* Sidfoten ligger i en tfoot. Det är det enda sättet som både UPPREPAR den
     på varje sida och RESERVERAR höjden åt den, så att dagtabellerna bryts
     ovanför i stället för att tryckas bakom den. Ett position:fixed-element
     gör varken det ena eller det andra: med negativ offset klipps det bort
     helt (verifierat — noll sidfotsrader i den utskrivna PDF:en), och med
     positiv offset skriver innehållet under det. */
  .ad-footer-screen { display: none; }
  .ad-pagefoot { display: table-footer-group; }
  .ad-footer-print { margin-top: 6mm; }
}
`;

/** 'YYYY-MM-DD HH:MM:SS' på svensk väggklocka, som DocMakers formatTimestamp. */
function skapadTimestamp(): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function DocumentHeader() {
  return (
    <div className="ad-header">
      {/* Inte next/image: den skriver ut en optimerad, responsivt skalad bild,
          och den enda storlek som betyder något här är de 24mm stylesheeten
          sätter för papperet. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ad-logo" src="/bella-logo.png" alt="Bella Service" />
      <div className="ad-title">Arbetsdagbok</div>
    </div>
  );
}

function Footer({ variant }: { variant: "screen" | "print" }) {
  return (
    <div className={`ad-footer ad-footer-${variant}`}>
      <div>
        <div>{COMPANY.postadressLabel}</div>
        {COMPANY.postadress.map((rad) => (
          <div key={rad}>{rad}</div>
        ))}
      </div>
      <div>
        {COMPANY.telefonLabel}: {COMPANY.telefon}
      </div>
      <div className="ad-footer-legal">
        <div>
          {COMPANY.bankgiroLabel}: {COMPANY.bankgiro}
        </div>
        <div>{COMPANY.orgnote}</div>
        <div>
          {COMPANY.orgnrLabel}: {COMPANY.orgnr}
        </div>
        <div>
          {COMPANY.momsregLabel}: {COMPANY.momsregnr}
        </div>
      </div>
    </div>
  );
}

export function Arbetsdagbok({ data }: { data: ArbetsdagbokData }) {
  const { bestallare } = data;

  return (
    <div className="ad-doc">
      <style dangerouslySetInnerHTML={{ __html: DOCUMENT_CSS }} />

      <div className="ad-viewport">
        {/* En tabell enbart för sidfotens skull: tfoot är det browsern
            upprepar på varje utskriven sida. Se @media print ovan. */}
        <table className="ad-pagegrid">
          <tfoot className="ad-pagefoot">
            <tr>
              <td>
                <Footer variant="print" />
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td>
        <section className="ad-sheet ad-sheet-cover">
          <div className="ad-sheet-inner">
            <DocumentHeader />

            <div className="ad-cover-meta">
              <div className="ad-line">
                <span className="ad-b">Skapad:</span> {skapadTimestamp()}
              </div>
              <div className="ad-line ad-b">Beställare</div>
              {/* Utelämnas helt när de saknas, precis som DocMakers kryssrutor
                  gör — hellre ingen rad än en etikett med tomt efter sig. */}
              {bestallare.adress && (
                <div className="ad-line">
                  <span className="ad-b">Adress:</span>{" "}
                  {bestallare.adress.split("\n").map((rad, i) => (
                    <span key={i}>
                      {i > 0 && <br />}
                      {rad}
                    </span>
                  ))}
                </div>
              )}
              {bestallare.bolag && (
                <div className="ad-line">
                  <span className="ad-b">Bolag:</span> {bestallare.bolag}
                </div>
              )}
              {bestallare.orgnr && (
                <div className="ad-line">
                  <span className="ad-b">Org nummer:</span> {bestallare.orgnr}
                </div>
              )}
            </div>

            <hr className="ad-divider" />

            <div className="ad-line ad-cover-project">
              <span className="ad-b">Project:</span> {data.projectName}
            </div>
            <div className="ad-line ad-b ad-cover-hours">
              Ordinarie tid: {formatHoursSv(data.totalHours)}h
            </div>

            <hr className="ad-divider" />

            <div className="ad-approval">
              <div className="ad-approval-h">GODKÄND AV</div>
              <div className="ad-signline">
                <span className="ad-b">Ort &amp; datum:</span>
                <span className="ad-blank" />
              </div>
              <div className="ad-signline">
                <span className="ad-b">Signatur:</span>
                <span className="ad-blank" />
              </div>
            </div>
          </div>

          <Footer variant="screen" />
        </section>

        <section className="ad-sheet ad-sheet-days">
          <div className="ad-sheet-inner">
            <DocumentHeader />

            {data.days.length === 0 ? (
              <p className="ad-empty">
                Inga pass är loggade på detta project — dokumentet har därför
                inga rader.
              </p>
            ) : (
              data.days.map((day) => (
                <section key={day.date} className="ad-day">
                  <div className="ad-date">{day.date}</div>
                  <div className="ad-table">
                    <div className="ad-row ad-row-head">
                      <div className="ad-cell">Arbetare</div>
                      <div className="ad-cell">Pass Timmar</div>
                      <div className="ad-cell">Pass Tider</div>
                      <div className="ad-cell">Tjänst</div>
                    </div>
                    <div className="ad-rows">
                      {day.rows.map((row, i) => (
                        <div key={i} className="ad-row">
                          <div className="ad-cell">{row.arbetare}</div>
                          <div className="ad-cell">{formatHoursSv(row.hours)}</div>
                          <div className="ad-cell">{row.passTider}</div>
                          {/* Samma tjänst på varje rad — den hör till
                              projectet, inte till det enskilda passet. */}
                          <div className="ad-cell">{data.tjanst}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))
            )}
          </div>

          <Footer variant="screen" />
        </section>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
