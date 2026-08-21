"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDaySheet } from "@/components/CalendarDaySheet";
import { CalendarMonth } from "@/components/CalendarMonth";
import { PanelSkeleton, Query } from "@/components/Query";
import { Screen } from "@/components/Screen";
import {
  monthStartOf,
  parseIsoDate,
  shiftMonth,
  stockholmToday,
} from "@/lib/format";
import { getDayLog, getMonthCalendar } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";

/**
 * Kalender.
 *
 * En månad åt gången, med de loggade timmarna skrivna i rutorna. Trycker man på
 * en dag öppnar ett ark som visar vad dagen redan innehåller och erbjuder de två
 * saker man kan lägga till: Logga Timmar och Tillverka Ärende.
 *
 * Två parametrar i adressfältet, och båda finns för att skärmen ska gå att
 * länka TILL:
 *
 *   ?datum=  dagen vars ark ska stå öppet. Det är den Logga Timmar skickar
 *            tillbaka efter ett sparat pass, så man landar på samma dag man
 *            just fyllde på — med timmarna i rutan.
 *   ?manad=  månaden som visas. Skrivs bara när man bläddrat, så att en delad
 *            länk visar det man såg.
 *
 * Att de bor i adressfältet och inte i useState är vad som gör "spara och kom
 * tillbaka hit" möjligt utan att skärmen behöver minnas något över en
 * navigering. Därav också <Suspense>-gränsen — se noteringen i
 * /logga-project/page.tsx.
 */
export default function KalenderPage() {
  return (
    <Screen
      tone="amber"
      eyebrow="Översikt"
      title="Kalender"
      back={{ href: "/", label: "Hem" }}
    >
      <Suspense fallback={<PanelSkeleton />}>
        <KalenderInnehall />
      </Suspense>
    </Screen>
  );
}

function KalenderInnehall() {
  const router = useRouter();
  const params = useSearchParams();

  // Läses en gång per rendering och inte per ruta: `stockholmToday` bygger en
  // Intl-formatterare, och rutnätet frågar trettio gånger om samma dag.
  const [today] = useState(() => stockholmToday());

  // Genom `parseIsoDate`: query-strängen är en egenskap hos besöket och kan
  // innehålla vad som helst. "2026-13-99" ska bli dagens månad, inte ett rutnät
  // för en månad som inte finns.
  const selected = parseIsoDate(params.get("datum"));
  const monthParam = parseIsoDate(`${params.get("manad") ?? ""}-01`);
  // Månaden i tur och ordning: den man bläddrat till, annars den valda dagens,
  // annars den vi står i.
  const monthStart = monthParam ?? monthStartOf(selected ?? today);

  const month = useQuery(() => getMonthCalendar(monthStart), [monthStart]);

  // Dagens innehåll är en egen läsning och inte en del av månaden: rutnätet
  // behöver summor, arket behöver namn, och att hämta hem varje arbetare på
  // varje dag i månaden för det ena arket som kanske öppnas vore att betala
  // trettio gånger för en.
  const day = useQuery(
    () => (selected ? getDayLog(selected) : Promise.resolve(null)),
    [selected ?? ""]
  );

  /** Adressen skrivs om i stället för att sättas i state — se docblocket ovan.
   *  `replace` och inte `push`: att bläddra en månad är inte ett steg tillbaka
   *  man vill ta med bakåtknappen. */
  function goTo(next: { manad?: string; datum?: string | null }) {
    const search = new URLSearchParams();
    const manad = next.manad ?? monthStart.slice(0, 7);
    search.set("manad", manad);
    if (next.datum) search.set("datum", next.datum);
    router.replace(`/kalender?${search.toString()}`);
  }

  return (
    <>
      {/* Rutnätet och ingenting under det. Raden med månadssumman och
          prickförklaringen som stod här är borttagen: rutorna säger redan vem
          som jobbade och vad som är bokat, och en fotnot som förklarar en
          symbol är oftast ett tecken på att symbolen skulle bytts ut i stället.
          Summorna finns kvar där de hör hemma — per pass i dagens kort, per
          project på Alla Project, och totalt på Hem. */}
      <Query state={month}>
        {(days) => (
          <CalendarMonth
            monthStart={monthStart}
            days={days}
            today={today}
            selected={selected}
            onPickDay={(date) => goTo({ datum: date })}
            onChangeMonth={(delta) =>
              // Dagen släpps när månaden byts: ett öppet kort för den 3:e förra
              // månaden hör inte hemma över den här månadens rutnät.
              goTo({ manad: shiftMonth(monthStart, delta).slice(0, 7), datum: null })
            }
          />
        )}
      </Query>

      {selected && (
        <CalendarDaySheet
          date={selected}
          shifts={day.data?.shifts ?? []}
          arenden={day.data?.arenden ?? []}
          loading={day.data === undefined && day.error === null}
          error={day.error}
          onClose={() => goTo({ datum: null })}
        />
      )}
    </>
  );
}
