/* Loggan importeras och namns inte med sin URL. Dokumentet ar en riktig sida som
   Chrome skriver ut till PDF, sa en bild som inte laddar blir ett tomt hal i
   sidhuvudet pa varje ark — och pa GitHub Pages ligger sajten under
   /Shift-Project-Setter/, dar `/bella-logo.png` pekar forbi prefixet och ger
   404. Bundlern skriver ut ratt URL. Plain `<img>` och inte `<Image>`: den har
   sidan ar A4 med egna matt i millimeter, inte ett responsivt layoutblock. */
import logo from "../../public/bella-logo.png";
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

  /* Arket krymper tills det får plats.

     Ett A4 är 210mm — knappt 794px — och en telefon är 390. Utan det här
     sticker papperet ut halvvägs utanför skärmen och hela sidan börjar glida i
     sidled, vilket är det enda som får en app att kännas trasig snabbare än en
     krasch. Alternativet, att låta arket rulla i sidled i sin egen ruta, ger en
     halv sida i taget och gör förhandsvisningen oläslig som DOKUMENT — och det
     är just som dokument man tittar på den.

     transform: scale() och inte zoom. zoom ser enklare ut -- den krymper även
     den plats elementet tar -- men vad den gör med mm-mått och med
     getBoundingClientRect skiljer sig mellan webbläsare, och en förhandsvisning
     som råkar hamna på halva sin tänkta storlek är svår att ens upptäcka: arket
     ser rätt ut, bara mindre. En scale gör exakt en sak och gör den likadant
     överallt.

     Priset är att en scale INTE ändrar den plats elementet tar, så ytan runt om
     måste få höjden satt åt sig. Båda talen räknas fram av DokumentVy och
     skickas in som egenskaper.

     Bara @media screen. På papper finns ingen skalning -- där ÄR arket A4, och
     varken --ad-skala eller --ad-hojd läses. */
  .ad-skalad-yta { overflow: hidden; height: var(--ad-hojd, auto); }
  .ad-skalad {
    width: 794px;
    transform: scale(var(--ad-skala, 1));
    transform-origin: top left;
  }
  /* Yttertabellen får INTE växa efter sitt innehåll.

     .ad-pagegrid finns bara för utskriftens skull -- en tfoot är det enda en
     webbläsare upprepar på varje sida -- men den är en tabell, och en tabell med
     automatisk layout blir så bred som dess bredaste innehåll kräver, oavsett
     vad föräldern säger. Dagtabellerna inuti arket ville ha 1890px, och då blev
     hela ställningen 1890px inuti en 794px-behållare. Arket självt förblev
     korrekta 210mm, men skalan räknades mot en yta som var dubbelt för bred, så
     dokumentet ritades ut på ungefär 40% av avsedd storlek -- läsbart nog att
     inte se ut som ett fel, litet nog att vara oläsligt.

     table-layout: fixed låter första raden bestämma bredden i stället för
     innehållet. Ställningen har en enda kolumn, så det finns inget att fördela
     fel. Bara @media screen: utskriften har ingen skalning att räkna mot. */
  .ad-skalad .ad-pagegrid { table-layout: fixed; width: 794px; }

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

  /* HÄR LÅG EN ZOOM-TRAPPA. Den är borta, och det är värt en förklaring.
     
     Sex mediefrågor krympte .ad-viewport efter FÖNSTRETS bredd: 0,80 vid 948px
     och nedåt, ända till 0,34 vid 360px. Den gjorde sitt jobb så länge arket var
     det enda på sidan och alltså alltid lika brett som fönstret minus marginal.
     
     Sedan dokumentbyggaren fick två spalter stämmer det inte längre. Vid 1200px
     fönsterbredd säger trappan "ingen skalning" -- men dokumentspalten är då
     bara omkring 700px, och arket hade svämmat över den. Frågan är inte hur brett
     FÖNSTRET är utan hur bred RUTAN är, och det kan CSS inte svara på: en
     container query hade kunnat, men inte räkna fram förhållandet 794px / rutan,
     eftersom CSS inte kan dela längd med längd. Det var också därför det blev en
     trappa och inte en calc() från början.
     
     DokumentVy mäter rutan i stället och skickar in faktorn. Se .ad-skalad ovan.
     
     ⚠️ Trappan och den nya skalningen får ALDRIG finnas samtidigt: de
     multipliceras. Under en stund gjorde de det, och 0,42 × 0,45 ritade ut
     dokumentet på 19% av rätt storlek -- fortfarande ett prydligt A4, bara
     obegripligt litet, vilket är precis den sortens fel man tittar förbi. */
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
      <img className="ad-logo" src={logo.src} alt="Bella Service" />
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
