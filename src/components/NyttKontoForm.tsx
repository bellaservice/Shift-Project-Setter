"use client";

import { useEffect, useRef, useState } from "react";
import { skapaKonto } from "@/app/installningar/konto/actions";
import { Button, ButtonLink } from "@/components/Button";
import { FieldHint, FieldLabel } from "@/components/Field";
import { Dropdown } from "@/components/Dropdown";
import { Check, Copy, Eye, EyeOff } from "@/components/Icons";
import { FormSection } from "@/components/Panel";
import { EmptyState } from "@/components/Screen";
import { inloggningsText, skrivTillUrklipp } from "@/lib/konton";
import type { KontoKandidat } from "@/lib/types";

/** Kortare an sa ar det inte ett losenord, det ar en gissning. */
const MIN_LANGD = 8;

/**
 * Att tillverka ett konto at nagon annan.
 *
 * Kontot ar INTE en ny person. Man valjer en arbetare som redan finns, och det
 * ar det valet som gor att appen vet vem inloggningen ar: passen, timmarna och
 * Arbetsdagbockerna hanger alla pa arbetaren, och ett konto utan den kopplingen
 * vore en e-postadress utan agare.
 *
 * Darfor finns det inget e-postfalt heller. Adressen ar arbetarens egen, den ur
 * hennes profil, och den visas har som en uppgift och inte som ett falt — den
 * andras i Redigera Arbetare, dar den bor, och foljer da med inloggningen.
 *
 * Ordningen pa sidan ar ordningen handlingen faktiskt har: vem det ar, ett
 * losenord, KOPIERA uppgifterna, och skapa sedan kontot. Kopieringen ligger
 * fore knappen som skapar och inte efter, och det ar hela poangen med
 * placeringen: losenordet finns bara sa lange det star i rutan — efterat ligger
 * det som en hash hos Supabase Auth och gar inte att lasa ut — sa den som
 * skapar forst och tanker pa att skicka uppgifterna efterat star med ett konto
 * ingen kan logga in i.
 *
 * Formatet pa det som kopieras ar mottagarens, inte appens:
 *
 *     E-post: nagon@bellaservice.se
 *     Lösenord: ...
 *
 * — tva rader att klistra in i ett meddelande, ingenting daromkring.
 */
export function NyttKontoForm({ kandidater }: { kandidater: KontoKandidat[] }) {
  const [workerId, setWorkerId] = useState("");
  const [losenord, setLosenord] = useState("");
  const [upprepa, setUpprepa] = useState("");
  /** null = inte forsokt an. Aterstalls sa fort nagot av det kopierade andras,
   *  annars star kvittot kvar och pastar att ett gammalt losenord ligger i
   *  urklipp. */
  const [kopierat, setKopierat] = useState<"ja" | "nej" | null>(null);

  const vald = kandidater.find((k) => k.id === workerId);
  const langdOk = losenord.length >= MIN_LANGD;
  const lika = losenord !== "" && losenord === upprepa;
  const kanKopiera = vald !== undefined && langdOk && lika;

  function andra(satt: (v: string) => void) {
    return (value: string) => {
      setKopierat(null);
      satt(value);
    };
  }

  async function kopiera() {
    if (!vald) return;
    const gick = await skrivTillUrklipp(inloggningsText(vald.epost, losenord));
    // Nekades urklippet visas raderna i klartext i stallet, sa att de gar att
    // markera for hand. Se `skrivTillUrklipp` for nar det hander.
    setKopierat(gick ? "ja" : "nej");
  }

  // Ingen att ge ett konto: antingen har alla arbetare redan ett, eller sa
  // saknar de e-post. Bada lagas pa samma stalle, sa skarmen pekar dit i
  // stallet for att visa ett formular med en tom lista i.
  if (kandidater.length === 0) {
    return (
      <EmptyState
        title="Ingen arbetare att ge ett konto."
        hint="Konton görs åt arbetare som finns i appen och har en e-postadress i sin profil — adressen är den man loggar in med."
        action={
          <ButtonLink href="/alla-arbetare" variant="secondary">
            Alla Arbetare
          </ButtonLink>
        }
      />
    );
  }

  return (
    <form action={skapaKonto} className="flex flex-col gap-3.5">
      <FormSection
        title="Vem"
        hint="Kontot blir den här arbetarens inloggning, så appen vet vems passen och timmarna är."
      >
        <div>
          <FieldLabel>
            Arbetare
            <span aria-hidden className="ml-1 text-night-accent">
              *
            </span>
          </FieldLabel>
          <Dropdown
            name="worker_id"
            required
            value={workerId}
            onChange={andra(setWorkerId)}
            options={kandidater.map((k) => ({ value: k.id, label: k.namn }))}
            placeholder="Välj arbetare"
            ariaLabel="Arbetare"
            emptyMessage="Ingen arbetare utan konto."
          />
        </div>

        {/* E-posten som en uppgift och inte som ett falt: den ar redan bestamd,
            den star i arbetarens profil, och tva rutor som ska innehalla samma
            adress ar tva rutor som forr eller senare gor det. */}
        <div>
          <FieldLabel>E-post</FieldLabel>
          <div className="glass-flat flex min-h-12 items-center rounded-xl px-3.5">
            <span
              className={`truncate text-base ${
                vald ? "text-white" : "text-white/40"
              }`}
            >
              {vald ? vald.epost : "Väljs med arbetaren"}
            </span>
          </div>
          <FieldHint>
            Arbetarens egen adress — den man loggar in med. Ändras i Redigera
            Arbetare.
          </FieldHint>
        </div>
      </FormSection>

      <FormSection
        title="Lösenord"
        hint="Skrivs två gånger för att ett skrivfel inte ska bli ett konto ingen kommer in i. Efter att kontot skapats går lösenordet inte att läsa ut igen."
      >
        <PasswordField
          label="Lösenord"
          name="losenord"
          value={losenord}
          onChange={andra(setLosenord)}
          autoComplete="new-password"
          problem={
            losenord !== "" && !langdOk
              ? `Lösenordet behöver minst ${MIN_LANGD} tecken.`
              : undefined
          }
        />
        <PasswordField
          label="Upprepa Lösenord"
          name="upprepa"
          value={upprepa}
          onChange={andra(setUpprepa)}
          autoComplete="new-password"
          problem={
            upprepa !== "" && !lika ? "De två lösenorden är inte lika." : undefined
          }
        />
      </FormSection>

      <Button
        type="button"
        variant="secondary"
        onClick={kopiera}
        disabled={!kanKopiera}
        className="w-full"
      >
        {kopierat === "ja" ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {kopierat === "ja" ? "Kopierat" : "Kopiera Inloggningsuppgifter"}
      </Button>

      {kopierat === "nej" && vald && (
        <div className="glass-flat rounded-xl p-3">
          <FieldLabel>Kopiera för hand</FieldLabel>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-white/85 select-all">
            {inloggningsText(vald.epost, losenord)}
          </pre>
          <FieldHint tone="warn">
            Webbläsaren nekade appen tillgång till urklipp.
          </FieldHint>
        </div>
      )}

      {!kanKopiera && (
        <FieldHint>
          Knappen tänds när en arbetare är vald och de två lösenorden är lika.
        </FieldHint>
      )}

      <Button type="submit" disabled={!kanKopiera} className="mt-1 w-full">
        Skapa Konto
      </Button>
    </form>
  );
}

/**
 * Ett losenordsfalt med ogat i kanten.
 *
 * Rutan ar `glass-field` precis som varje annat falt, men den ar wrappern och
 * inte sjalva <input>:en — knappen ska ligga INUTI rutan, och hela rutan ska
 * lysa upp nar markoren star i den. Det ar samma konstruktion som "20"-prefixet
 * i Project Start.
 *
 * Ogat ar en `button` och inte en kryssruta: det andrar ingenting som sparas,
 * det andrar bara vad man ser, och `aria-pressed` ar det som sager vilket lage
 * det star i utan att ordet "visa" behover byta till "dolj" for skarmlasaren.
 */
function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  problem,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  /** Blockerar submit via `setCustomValidity` och visas under faltet. */
  problem?: string;
}) {
  const [synligt, setSynligt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.setCustomValidity(problem ?? "");
  }, [problem]);

  return (
    <div>
      <FieldLabel>
        {label}
        <span aria-hidden className="ml-1 text-night-accent">
          *
        </span>
      </FieldLabel>

      <div className="glass-field flex h-12 items-center rounded-xl pl-3.5">
        <input
          ref={inputRef}
          name={name}
          type={synligt ? "text" : "password"}
          required
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="w-full min-w-0 bg-transparent py-2 pr-2 text-base text-white outline-none"
        />
        <button
          type="button"
          aria-label={synligt ? "Dölj lösenordet" : "Visa lösenordet"}
          aria-pressed={synligt}
          onClick={() => setSynligt((v) => !v)}
          className="mr-0.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/55 transition-colors duration-200 ease-out active:bg-white/10 motion-reduce:transition-none"
        >
          {synligt ? (
            <EyeOff className="h-[18px] w-[18px]" />
          ) : (
            <Eye className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>

      {problem && <FieldHint tone="danger">{problem}</FieldHint>}
    </div>
  );
}
