"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Field, FieldHint, FieldLabel } from "@/components/Field";
import { Check, Copy, Eye, EyeOff } from "@/components/Icons";
import { FormSection } from "@/components/Panel";
import { ProfilePictureInput } from "@/components/ProfilePictureInput";
import {
  addKonto,
  epostFinns,
  inloggningsText,
  skrivTillUrklipp,
  toAvatarDataUrl,
} from "@/lib/konton";

/** Kortare an sa ar det inte ett losenord, det ar en gissning. */
const MIN_LANGD = 8;

/**
 * Att tillverka ett konto at nagon annan.
 *
 * Ordningen pa sidan ar ordningen handlingen faktiskt har: fyll i vem det ar,
 * bestam ett losenord, KOPIERA uppgifterna, och skapa sedan kontot. Kopieringen
 * ligger fore knappen som skapar och inte efter, och det ar hela poangen med
 * placeringen: losenordet finns bara sa lange det star i rutan (se
 * lib/konton.ts — det sparas aldrig), sa den som skapar forst och tanker pa att
 * skicka uppgifterna efterat star med ett konto ingen kan logga in i.
 *
 * Formatet pa det som kopieras ar mottagarens, inte appens:
 *
 *     E-post: nagon@bellaservice.se
 *     Lösenord: ...
 *
 * — tva rader att klistra in i ett meddelande, ingenting daromkring.
 */
export function NyttKontoForm() {
  const router = useRouter();

  const [namn, setNamn] = useState("");
  const [epost, setEpost] = useState("");
  const [losenord, setLosenord] = useState("");
  const [upprepa, setUpprepa] = useState("");
  const [bild, setBild] = useState<string | null>(null);
  /** null = inte forsokt an. Aterstalls sa fort nagot av det kopierade andras,
   *  annars star kvittot kvar och pastar att ett gammalt losenord ligger i
   *  urklipp. */
  const [kopierat, setKopierat] = useState<"ja" | "nej" | null>(null);

  const langdOk = losenord.length >= MIN_LANGD;
  const lika = losenord !== "" && losenord === upprepa;
  const epostOk = epost.trim() !== "" && !epostFinns(epost);
  const kanKopiera = epostOk && langdOk && lika;

  function andra(satt: (v: string) => void) {
    return (value: string) => {
      setKopierat(null);
      satt(value);
    };
  }

  async function kopiera() {
    const gick = await skrivTillUrklipp(inloggningsText(epost.trim(), losenord));
    // Nekades urklippet visas raderna i klartext i stallet, sa att de gar att
    // markera for hand. Se `skrivTillUrklipp` for nar det hander.
    setKopierat(gick ? "ja" : "nej");
  }

  function skapa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kanKopiera) return;

    addKonto({
      namn: namn.trim(),
      epost: epost.trim(),
      status: "aktiv",
      bild,
    });
    router.push("/installningar/konto");
  }

  return (
    <form onSubmit={skapa} className="flex flex-col gap-3.5">
      <FormSection title="Kontot">
        <ProfilePictureInput
          onPick={async (file) => {
            setBild(file ? await toAvatarDataUrl(file) : null);
          }}
        />
        <Field
          label="Namn"
          name="namn"
          required
          onValueChange={andra(setNamn)}
        />
        <Field
          label="E-post"
          name="epost"
          type="email"
          required
          placeholder="namn@bellaservice.se"
          onValueChange={andra(setEpost)}
          validationMessage={
            epost.trim() !== "" && epostFinns(epost)
              ? "Det finns redan ett konto med den e-postadressen."
              : undefined
          }
          hint="Det är den här adressen man loggar in med."
        />
      </FormSection>

      <FormSection
        title="Lösenord"
        hint="Skrivs två gånger för att ett skrivfel inte ska bli ett konto ingen kommer in i. Lösenordet sparas inte i appen — det lämnar den här sidan bara via knappen nedan."
      >
        <PasswordField
          label="Lösenord"
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

      {kopierat === "nej" && (
        <div className="glass-flat rounded-xl p-3">
          <FieldLabel>Kopiera för hand</FieldLabel>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-white/85 select-all">
            {inloggningsText(epost.trim(), losenord)}
          </pre>
          <FieldHint tone="warn">
            Webbläsaren nekade appen tillgång till urklipp.
          </FieldHint>
        </div>
      )}

      {!kanKopiera && (
        <FieldHint>
          Knappen tänds när e-posten är ifylld och de två lösenorden är lika.
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
  value,
  onChange,
  autoComplete,
  problem,
}: {
  label: string;
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
