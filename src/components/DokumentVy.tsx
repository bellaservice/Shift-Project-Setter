"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Haller Arbetsdagbokens A4-ark inom skarmens bredd.
 *
 * Papperet ar 210mm brett — knappt 794px — och andrar sig inte efter skarmen,
 * for det ar meningen: forhandsvisningen ar arken som hamnar i filen, med samma
 * sidbrytning. Det som maste ge sig ar alltsa inte layouten utan STORLEKEN.
 *
 * Tva tal raknas fram har och skickas in som CSS-egenskaper:
 *
 *   --ad-skala   hur mycket arket krymper. Aldrig over 1: pa en bred skarm ska
 *                papperet ligga i sin ratta storlek, inte forstoras.
 *   --ad-hojd    hojden ytan ska ta. En transform flyttar bara pixlar; den
 *                andrar inte hur mycket plats elementet begar. Utan den skulle
 *                sidan fortsatta vara lika hog som ett OSKALAT dokument och
 *                lamna en skarmlang tomhet under det sista arket.
 *
 * Bada lases bara inuti @media screen i Arbetsdagbokens egen CSS, sa utskriften
 * ar oberord.
 */

/** A4 i pixlar vid 96 dpi, samma matt som `.ad-sheet` satter i millimeter. */
const ARK_BREDD = 794;

export function DokumentVy({ children }: { children: React.ReactNode }) {
  const ytan = useRef<HTMLDivElement>(null);
  const arket = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(1);
  const [hojd, setHojd] = useState<number | null>(null);

  const rakna = useCallback(() => {
    const yta = ytan.current;
    const ark = arket.current;
    if (!yta || !ark) return;

    // Ytans bredd, inte arkets: arket ar alltid 794px och skulle ge samma svar
    // varje gang. Golvet pa 0,3 ar en sparr mot en bredd nara noll under en
    // overgang, som annars gav ett osynligt dokument.
    const s = Math.min(1, Math.max(0.3, yta.clientWidth / ARK_BREDD));
    setSkala(s);
    // scrollHeight och inte clientHeight: ytan klipper (overflow: hidden), sa
    // clientHeight vore hojden vi just satt — talet skulle mata sig sjalvt.
    setHojd(ark.scrollHeight * s);
  }, []);

  useEffect(() => {
    rakna();
    const yta = ytan.current;
    const ark = arket.current;
    if (!yta || !ark) return;

    // Tva iakttagare med olika arenden. Ytan andrar bredd nar fonstret gor det
    // ELLER nar man vaxlar mellan Detaljer och Dokument — alltsa utan att
    // fonstret rort sig. Arket andrar hojd nar ramen valjer fler eller farre
    // dagar, vilket lagger till och tar bort hela sidor.
    const obs = new ResizeObserver(rakna);
    obs.observe(yta);
    obs.observe(ark);
    return () => obs.disconnect();
  }, [rakna]);

  return (
    <div
      ref={ytan}
      className="ad-skalad-yta w-full"
      style={
        hojd === null ? undefined : ({ "--ad-hojd": `${hojd}px` } as React.CSSProperties)
      }
    >
      <div
        ref={arket}
        className="ad-skalad"
        style={{ "--ad-skala": skala } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
