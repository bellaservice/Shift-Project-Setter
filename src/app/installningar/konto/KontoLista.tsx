"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { KontoList } from "@/components/KontoList";
import { Query } from "@/components/Query";
import { EmptyState } from "@/components/Screen";
import { getKonton } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/useQuery";
import { satsRoll } from "./actions";
import { MinaUppgifter } from "./MinaUppgifter";
import { farLeda } from "@/lib/roller";

/**
 * Hamtningen, bruten ut ur sidan.
 *
 * Sidan bredvid ar medvetet kvar som en serverkomponent, eftersom den ar det
 * enda stallet dar `export const metadata` far sta -- en klientkomponent kan
 * inte exportera den, och sidans titel ar varken data eller interaktion. Den
 * ratta uppdelningen ar darfor inte "sidan blir klient" utan "det som laser ur
 * databasen blir klient", och det ar precis den gransen som gar har.
 *
 * Sedan rollerna infordes ar listan inte langre bara att lasa: en arbetsledare
 * kan byta roll pa ett konto harifran. Det ar appens enda stalle dar
 * befogenheter delas ut, vilket ar varfor bade rollgrinden nedan och
 * databasens tva vakter finns.
 */
export function KontoLista() {
  const { roll, rollLoading, session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const konton = useQuery(() => getKonton(), []);

  async function byteAvRoll(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await satsRoll(formData);
      // Raden andrade sig, och med den kan sista-arbetsledaren-laget ha andrat
      // sig ocksa. Las om hela listan i stallet for att gissa.
      konton.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Nagot gick fel. Forsok igen."
      );
    } finally {
      setPending(false);
    }
  }

  // Kontolistan visar vilka som kommer in i appen, och rollvaxeln delar ut
  // befogenheter. Bada hor till arbetsledaren. Grinden ar artighet -- RLS
  // avvisar en arbetares skrivning oavsett -- men en skarm full av knappar som
  // alltid misslyckas ar inte ett vanligt bemotande.
  /**
   * Arbetaren far INTE listan -- men hon far sina egna uppgifter.
   *
   * Har stod tidigare "Den har skarmen ar arbetsledarens", vilket var sant om
   * listan och fel om skarmen: den heter Konto, och hennes eget konto finns
   * har, med tomma falt som bara hon kan fylla i. Ett besked om att ga nagon
   * annanstans var svar pa en fraga hon inte stallt.
   */
  if (!rollLoading && !farLeda(roll)) {
    return <MinaUppgifter />;
  }

  return (
    <>
      <FormError message={error} />
      <Query state={konton}>
        {(data) => (
          <KontoList
            konton={data}
            egetKontoId={session?.user.id ?? null}
            onRollByte={byteAvRoll}
            pending={pending}
          />
        )}
      </Query>
    </>
  );
}
