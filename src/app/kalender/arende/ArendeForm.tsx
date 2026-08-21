"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { DateSelect } from "@/components/DateSelect";
import { Field, FieldHint } from "@/components/Field";
import { FormError } from "@/components/FormError";
import { Check } from "@/components/Icons";
import { FormSection } from "@/components/Panel";
import { TimeRangeSelect } from "@/components/TimeWheelSelect";
import { ARENDE_FARGER, ARENDE_FARG_DEFAULT } from "@/lib/arendeFarger";
import { formatHoursSv, passSpanHours } from "@/lib/format";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import type { ArendeDetalj, ArendeSynlighet, KontoItem } from "@/lib/types";
import { deleteArende, saveArende } from "../actions";

/** Postgres lämnar `time` som 'HH:MM:SS'; hjulen räknar i 'HH:MM'. */
function toWheel(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

const SYNLIGHETER: Array<{
  value: ArendeSynlighet;
  label: string;
  hint: string;
}> = [
  {
    value: "alla",
    label: "Alla",
    hint: "Alla med ett konto ser ärendet i sin kalender.",
  },
  {
    value: "egen",
    label: "Bara jag",
    hint: "Ingen annan ser ärendet — inte ens att dagen har något bokat.",
  },
  {
    value: "valda",
    label: "Valda konton",
    hint: "Du och de konton du kryssar i nedan.",
  },
];

/**
 * Ett ärende — en avtalad tid i kalendern.
 *
 * Fälten står i den ordning man skriver dem, inte i den ordning de råkar ligga i
 * tabellen: rubriken och anteckningen först, för de två är vad ärendet ÄR och
 * skrivs i ett svep, och allt som är omständigheter — dag, tid, plats — under
 * dem.
 *
 * Tiden ligger bakom en kryssruta och inte framme. De flesta ärenden man skriver
 * upp i en kalender har en dag men inte ett klockslag, och två tidshjul som
 * alltid står framme ber om ett svar man oftast inte har. Ingen kryssruta =
 * heldag, vilket också är precis vad frånvaron av klockslag betyder i tabellen.
 * Rutan är därmed inte ett eget tillstånd att hålla i synk med fälten — den ÄR
 * fälten.
 *
 * Samma formulär för nytt och sparat. Skillnaden är ett dolt `id` och en
 * raderingsknapp längst ner — se `saveArende`.
 */
export function ArendeForm({
  arende,
  konton,
  defaultDate,
}: {
  /** Det sparade ärendet, eller undefined när ett nytt skapas. */
  arende?: ArendeDetalj;
  /** Kontona att välja bland när synligheten är "Valda konton". */
  konton: KontoItem[];
  /** 'YYYY-MM-DD' från kalenderrutan man tryckte på. */
  defaultDate?: string;
}) {
  const [start, setStart] = useState(toWheel(arende?.start_time ?? null));
  const [end, setEnd] = useState(toWheel(arende?.end_time ?? null));
  // Ett sparat ärende med klockslag öppnar med rutan i, ett utan öppnar utan.
  const [harTid, setHarTid] = useState(arende?.start_time != null);
  const [farg, setFarg] = useState(arende?.farg ?? ARENDE_FARG_DEFAULT);
  const [synlighet, setSynlighet] = useState<ArendeSynlighet>(
    arende?.synlighet ?? "alla"
  );
  const [valda, setValda] = useState<Set<string>>(
    () => new Set(arende?.tittare ?? [])
  );

  const { submit, error, pending } = useNavigatingAction(saveArende);
  const span = harTid ? passSpanHours(start, end) : null;

  const router = useRouter();
  // <ConfirmDeleteButton> lämnar sitt formulär till React som det är, så
  // åtgärdens svar om vart användaren ska tar sig aldrig någonstans. Samma
  // adapter som Redigera Arbetare och Redigera Project använder: vänta in
  // raderingen, navigera sedan. Tillbaka till kalendern och inte till ärendets
  // dag — raden som gjorde dagen värd att öppna finns inte längre.
  async function onDelete(formData: FormData) {
    await deleteArende(formData);
    router.push("/kalender");
  }

  function toggleKonto(id: string) {
    setValda((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={submit} className="flex flex-col gap-3.5">
        {arende && <input type="hidden" name="id" value={arende.id} />}

        <FormSection title="Ärendet">
          <Field
            label="Titel"
            name="titel"
            required
            placeholder="t.ex. Besiktning med beställaren"
            defaultValue={arende?.titel ?? ""}
          />
          <Field
            label="Anteckningar"
            name="anteckning"
            textarea
            placeholder="Vad gäller det?"
            defaultValue={arende?.anteckning ?? ""}
          />
        </FormSection>

        <FormSection title="När och var">
          <DateSelect label="Datum" defaultDate={arende?.arende_date ?? defaultDate} />

          <div>
            {/* Kryssrutan bär hela tidsfältet. Är den av finns hjulen inte i
                DOM:en, så formData saknar klockslagen och ärendet blir en
                heldag — utan att någon rad kod behöver säga det en andra gång. */}
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={harTid}
                onChange={(event) => setHarTid(event.currentTarget.checked)}
                className="h-[18px] w-[18px] shrink-0 rounded"
              />
              <span className="text-sm font-semibold text-white/75">
                Ange en tid
              </span>
            </label>

            {harTid ? (
              <div className="mt-2">
                <TimeRangeSelect
                  start={{
                    name: "start_time",
                    label: "Starttid",
                    value: start,
                    fallback: "09:00",
                    onChange: setStart,
                  }}
                  end={{
                    name: "end_time",
                    label: "Sluttid",
                    value: end,
                    fallback: "10:00",
                    onChange: setEnd,
                  }}
                />
                {span !== null && (
                  <FieldHint>Ärendet är {formatHoursSv(span)} h långt.</FieldHint>
                )}
              </div>
            ) : (
              <FieldHint>
                Utan tid är ärendet en heldag. Det räknas aldrig som arbetade
                timmar — det är Logga Timmar som gör det.
              </FieldHint>
            )}
          </div>

          <Field
            label="Plats"
            name="plats"
            placeholder="t.ex. Storgatan 4"
            defaultValue={arende?.plats ?? ""}
          />
        </FormSection>

        <FormSection title="Färg">
          <input type="hidden" name="farg" value={farg} />
          <FargValjare value={farg} onChange={setFarg} />
        </FormSection>

        <FormSection
          title="Synlighet"
          hint="Vem som ser ärendet i sin kalender. Databasen håller regeln, inte bara den här skärmen."
        >
          <input type="hidden" name="synlighet" value={synlighet} />

          {/* En radiogrupp som rader och inte som en skena: de tre valen har
              varsin förklaring under sig, och en skena med tre lika stora
              halvor har ingenstans att sätta den. */}
          <div
            role="radiogroup"
            aria-label="Synlighet"
            className="glass-flat divide-y divide-night-line overflow-hidden rounded-xl"
          >
            {SYNLIGHETER.map((option) => {
              const active = option.value === synlighet;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSynlighet(option.value)}
                  className="flex w-full cursor-pointer items-start gap-3 px-3.5 py-3 text-left transition-colors duration-200 ease-out active:bg-white/10 motion-reduce:transition-none"
                >
                  {/* Ring plus bock, inte bara en färgad ring: valt/ovalt måste
                      överleva att läsas i svartvitt. */}
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-night-accent bg-night-accent text-black"
                        : "border-white/30"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-bold ${
                        active ? "text-white" : "text-white/80"
                      }`}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/55">
                      {option.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {synlighet === "valda" && (
            <KontoValjare
              konton={konton}
              valda={valda}
              onToggle={toggleKonto}
            />
          )}
        </FormSection>

        <FormError message={error} />

        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? "Sparar…" : arende ? "Spara Ärendet" : "Tillverka Ärende"}
        </Button>
      </form>

      {/* Radering ligger utanför formuläret ovan: den har ett eget formulär med
          ett eget fält, och nästlade formulär finns inte. Ett ärende går till
          skillnad från en arbetare eller ett project inte till Papperskorgen —
          dialogen säger det rakt ut, för det är skillnaden som spelar roll. */}
      {arende && (
        <ConfirmDeleteButton
          action={onDelete}
          id={arende.id}
          label="Radera Ärende"
          title="Radera ärendet?"
          description={`"${arende.titel}" tas bort ur kalendern direkt och hamnar inte i Papperskorgen. Det går inte att ångra.`}
          confirmLabel="Radera Ärende"
        />
      )}
    </div>
  );
}

/**
 * De sex färgerna som en rad brickor.
 *
 * Den valda bär en ring och en bock. Bara en ring hade varit färg som enda
 * bärare av "vald" i en kontroll som helt består av färger — och det är precis
 * den kombination som slutar fungera för den som inte skiljer två av dem åt.
 * Namnet finns i `aria-label`, så valet går också att höra.
 */
function FargValjare({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Färg" className="flex flex-wrap gap-2">
      {ARENDE_FARGER.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            onClick={() => onChange(option.value)}
            style={{ backgroundColor: option.hex }}
            className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-black transition-transform duration-200 ease-out motion-reduce:transition-none ${
              active
                ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                : "opacity-70"
            }`}
          >
            {active && <Check className="h-5 w-5" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Kontona ett "valda"-ärende visas för.
 *
 * Listan är kontona och inte arbetarna: det är en inloggning som öppnar en
 * kalender, och en arbetare utan konto har ingen kalender att visa ärendet i.
 * Att lista henne ändå hade varit att erbjuda ett val som inte gör något.
 *
 * Den som skapar ärendet står inte i listan och behöver inte kryssas i — hen ser
 * alltid sitt eget, vilket databasen håller på och inte den här skärmen.
 */
function KontoValjare({
  konton,
  valda,
  onToggle,
}: {
  konton: KontoItem[];
  valda: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (konton.length === 0) {
    return (
      <p className="text-sm text-white/55">
        Inga konton att välja bland än. Tillverka ett under Inställningar →
        Konto, så går det att dela ärendet med det.
      </p>
    );
  }

  return (
    <div className="glass-flat divide-y divide-night-line overflow-hidden rounded-xl">
      {konton.map((konto) => (
        <label
          key={konto.id}
          className="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2 transition-colors duration-200 ease-out active:bg-white/10 motion-reduce:transition-none"
        >
          <input
            type="checkbox"
            name="konto_id"
            value={konto.id}
            checked={valda.has(konto.id)}
            onChange={() => onToggle(konto.id)}
            className="h-[18px] w-[18px] shrink-0 rounded"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-white">
              {konto.namn}
            </span>
            {/* Adressen under namnet: två arbetare kan heta lika, och det är
                inloggningen man faktiskt delar med. */}
            {konto.kopplad && konto.epost && (
              <span className="block truncate text-xs text-white/55">
                {konto.epost}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
