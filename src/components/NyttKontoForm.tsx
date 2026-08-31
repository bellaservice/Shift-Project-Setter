"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Dropdown } from "@/components/Dropdown";
import { FieldHint, FieldLabel, FIELD_BOX } from "@/components/Field";
import { FormSection } from "@/components/Panel";
import { Check, Copy, Eye, EyeOff, Warning } from "@/components/Icons";
import { inloggningsText, skrivTillUrklipp } from "@/lib/konton";
import { ROLLER, ROLL_ETIKETT } from "@/lib/roller";
import { tillverkaKonto } from "@/lib/tillverkaKonto";
import type { KontoKandidat, Roll } from "@/lib/types";

/**
 * Tillverka Konto.
 *
 * Skarmen ar byggd runt en sak som inte gar att angra och inte gar att slaa upp
 * i efterhand: LOSENORDET SPARAS INTE. Det skickas till Supabase Auth nar
 * kontot skapas och finns darefter bara som en hash dar. Rutan i det har
 * formularet ar den enda kopian appen nagonsin ser, och den forsvinner nar
 * sidan lamnas.
 *
 * Darav grinden. "Kopiera Inloggning" star FORE "Tillverka Konto", och den
 * andra gar inte att trycka pa forran den forsta har tryckts. Ordningen ar inte
 * en rekommendation utan formularets enda regel, for det enda utfall som ar
 * riktigt daligt ar ett konto som finns i databasen och vars losenord ingen
 * langre kan lasa — arbetaren kan inte logga in, administratoren kan inte se
 * vad hon skrev, och det gar inte att reparera utan att bora om.
 *
 * Grinden stangs igen om nagot andras efter kopieringen. Det ar hela poangen
 * med att den finns: hade den stannat oppen skulle en administrator kunna
 * kopiera ett losenord, komma pa att adressen var fel, andra den och skapa
 * kontot — och det som ligger i urklipp vore da inte det som gar att logga in
 * med. Se `gateNyckel` nedan.
 */
export function NyttKontoForm({ kandidater }: { kandidater: KontoKandidat[] }) {
  const router = useRouter();

  /**
   * Rollen kontot fods med, oberoende av om det hor till en arbetare.
   *
   * De tva fragorna ar verkligen skilda. "Arbetare / Ej arbetare" sager vem
   * kontot AR -- om det finns en person i workers bakom inloggningen, och
   * darmed om hen gar att schemalagga och stampla in. Rollen sager vad kontot
   * FAR GORA. En arbetsledare som ocksa gar pass ar bada; en admin pa kontoret
   * ar det ena utan det andra.
   *
   * Standard 'arbetare': det vanligaste kontot, och den minst behoriga rollen.
   * Ett falt man glommer att rora ska inte dela ut befogenheter.
   */
  const [roll, setRoll] = useState<Roll>("arbetare");
  const [tillArbetare, setTillArbetare] = useState(true);
  const [workerId, setWorkerId] = useState("");
  const [epost, setEpost] = useState("");
  const [losen, setLosen] = useState("");
  const [losenIgen, setLosenIgen] = useState("");
  const [visaLosen, setVisaLosen] = useState(false);

  const [kopierad, setKopierad] = useState(false);
  const [kopieringsfel, setKopieringsfel] = useState<string | null>(null);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const vald = kandidater.find((k) => k.id === workerId) ?? null;
  /** Arbetaren har redan en adress, och da ar den adressen inloggningen. */
  const lastEpost = tillArbetare && vald !== null && vald.epost !== null;

  // Adressen foljer den valda arbetaren, och aterstalls under renderingen
  // snarare an i en effekt. Det ar Reacts egen form for "justera state nar
  // indata andras": setState under rendering renderar om direkt, utan att den
  // mellanliggande bilden nagonsin visas, medan samma sak i en useEffect forst
  // malar foregaende arbetares adress i ett bildruta.
  //
  // Nyckeln och inte `vald` direkt, eftersom faltet ocksa maste tommas nar man
  // byter till en arbetare UTAN adress — annars star foregaende arbetares
  // e-post kvar och kontot skapas pa fel adress.
  const epostNyckel = tillArbetare ? workerId : "fri";
  const [senasteEpostNyckel, setSenasteEpostNyckel] = useState(epostNyckel);
  if (senasteEpostNyckel !== epostNyckel) {
    setSenasteEpostNyckel(epostNyckel);
    setEpost(tillArbetare ? vald?.epost ?? "" : "");
  }

  const trimmadEpost = epost.trim();
  const stammer = losen.length > 0 && losen === losenIgen;
  const langNog = losen.length >= 6;

  const felIFalt = useMemo(() => {
    if (tillArbetare && !workerId) return "Välj vilken arbetare kontot gäller.";
    if (!trimmadEpost || !trimmadEpost.includes("@")) {
      return "Fyll i en e-postadress.";
    }
    if (!langNog) return "Lösenordet måste vara minst 6 tecken.";
    if (!stammer) return "De två lösenorden är inte lika.";
    return null;
  }, [tillArbetare, workerId, trimmadEpost, langNog, stammer]);

  const kanKopiera = felIFalt === null;

  /**
   * Allt som gar att kopiera fel, som en strang.
   *
   * Grinden ar oppen bara sa lange den har nyckeln ar densamma som nar man
   * tryckte pa Kopiera. Byts en enda av delarna stangs den, och knappen maste
   * tryckas igen — annars kan det som ligger i urklipp och det som hamnar i
   * databasen vara tva olika saker.
   */
  const gateNyckel = `${tillArbetare ? workerId : "fri"}|${trimmadEpost}|${losen}`;
  const [kopieradNyckel, setKopieradNyckel] = useState("");
  const grindOppen = kopierad && kopieradNyckel === gateNyckel;

  async function kopiera() {
    setKopieringsfel(null);
    const gick = await skrivTillUrklipp(inloggningsText(trimmadEpost, losen));

    // Grinden oppnas aven om urklipp nekade. Raderna visas da i klartext i
    // stallet, och da HAR administratoren dem — att lasa knappen for att
    // webblasaren sagt nej vore att lasa ute nagon som gjort allt ratt.
    setKopierad(true);
    setKopieradNyckel(gateNyckel);
    if (!gick) setKopieringsfel(inloggningsText(trimmadEpost, losen));
  }

  async function skapa() {
    setSparar(true);
    setFel(null);
    try {
      await tillverkaKonto({
        workerId: tillArbetare ? workerId : null,
        email: trimmadEpost,
        password: losen,
        roll,
      });
      router.push("/installningar/konto");
    } catch (cause) {
      setFel(cause instanceof Error ? cause.message : "Något gick fel.");
      setSparar(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <FormSection title="Kontot gäller">
        {/* Samma segmenterade vaxel som Utseende i Installningar: tva lagen som
            utesluter varandra och bada ryms pa en rad. En dropdown for tva
            alternativ ar ett klick for mycket. */}
        <div className="glass-flat flex gap-1 rounded-xl p-1">
          <VaxelKnapp
            aktiv={tillArbetare}
            onClick={() => setTillArbetare(true)}
            label="Arbetare"
          />
          <VaxelKnapp
            aktiv={!tillArbetare}
            onClick={() => {
              setTillArbetare(false);
              setWorkerId("");
              setEpost("");
            }}
            label="Ej arbetare"
          />
        </div>

        {tillArbetare ? (
          <div className="mt-3.5">
            <FieldLabel>
              Arbetare
              <span aria-hidden className="ml-1 text-night-accent">
                *
              </span>
            </FieldLabel>
            <Dropdown
              value={workerId}
              onChange={setWorkerId}
              options={kandidater.map((k) => ({
                value: k.id,
                label: k.epost ? `${k.namn} — ${k.epost}` : `${k.namn} (ingen e-post)`,
              }))}
              placeholder="Välj arbetare"
              ariaLabel="Arbetare kontot gäller"
              emptyMessage="Alla arbetare har redan konto."
            />
            {/* Hindret star DAR det gar att atgarda.

                Det stod redan langst ned, under den lasta knappen -- alltsa en
                skarmhojd bort fran den tomma rutan det handlar om, i samma
                dampade grafton som varje annan hjalprad. Man kunde fylla i
                adress och losenord, mota en knapp som inte gick att trycka pa,
                och inte hitta orsaken: den lag ovanfor, i ett falt man redan
                scrollat forbi.

                Andra meningen namner utvagen med flit. Att valja rollen Admin
                och anda bli ombedd att peka ut en arbetare ar forvirrande om man
                inte vet att de tva fragorna ar skilda -- och den som ska ha ett
                kontorskonto vill at "Ej arbetare", inte at listan. */}
            {workerId === "" ? (
              <FieldHint tone="warn">
                Välj vilken arbetare kontot gäller — eller byt till{" "}
                <strong className="font-bold">Ej arbetare</strong> ovan om
                kontot inte hör till någon som loggar pass.
              </FieldHint>
            ) : (
              <FieldHint>
                Bara arbetare utan konto visas. En arbetare kan ha högst en
                inloggning.
              </FieldHint>
            )}
          </div>
        ) : (
          <FieldHint>
            Ett konto utan arbetare — för någon som ska in i appen men inte
            loggar pass. Det syns i listan under sin e-postadress.
          </FieldHint>
        )}
      </FormSection>

      <FormSection title="Roll">
        {/* Tre lagen, samma vaxel som i kontolistan -- och medvetet SKILD fran
            valet ovan. Rollen gar att satta pa bade ett arbetarkonto och ett
            utan arbetare: en arbetsledare som ocksa gar pass ar det forsta, en
            admin pa kontoret det andra. */}
        <div className="glass-flat flex gap-1 rounded-xl p-1">
          {ROLLER.map((r) => (
            <VaxelKnapp
              key={r}
              aktiv={roll === r}
              onClick={() => setRoll(r)}
              label={ROLL_ETIKETT[r]}
            />
          ))}
        </div>
        <FieldHint>
          {roll === "arbetare"
            ? "Stämplar in och ut på sina egna pass. Ser ingenting annat."
            : roll === "arbetsledare"
              ? "Lägger ut pass, bekräftar dem och sköter project och konton."
              : "Allt arbetsledaren kan, plus att styra project och skriva ut Arbetsdagboken."}
        </FieldHint>
      </FormSection>

      <FormSection title="Inloggning">
        <label className="block">
          <FieldLabel>
            E-post
            <span aria-hidden className="ml-1 text-night-accent">
              *
            </span>
          </FieldLabel>
          <input
            type="email"
            value={epost}
            readOnly={lastEpost}
            onChange={(event) => setEpost(event.target.value)}
            placeholder="namn@bellaservice.se"
            autoComplete="off"
            className={`${FIELD_BOX} ${lastEpost ? "opacity-70" : ""}`}
          />
          {lastEpost ? (
            <FieldHint>
              Hämtad från arbetaren. Adressen är inloggningen, så den kan bara
              ändras på arbetaren själv.
            </FieldHint>
          ) : tillArbetare && vald ? (
            <FieldHint tone="warn">
              {vald.namn} saknar e-post. Adressen du skriver här sparas på
              arbetaren när kontot tillverkas.
            </FieldHint>
          ) : null}
        </label>

        <div className="mt-3.5">
          <LosenordsFalt
            label="Lösenord"
            value={losen}
            onChange={setLosen}
            visa={visaLosen}
            onToggleVisa={() => setVisaLosen((v) => !v)}
          />
          <FieldHint tone={losen.length > 0 && !langNog ? "danger" : "muted"}>
            Minst 6 tecken.
          </FieldHint>
        </div>

        <div className="mt-3.5">
          <LosenordsFalt
            label="Lösenord igen"
            value={losenIgen}
            onChange={setLosenIgen}
            visa={visaLosen}
            onToggleVisa={() => setVisaLosen((v) => !v)}
          />
          {losenIgen.length > 0 && !stammer && (
            <FieldHint tone="danger">
              De två lösenorden är inte lika. Tryck på ögat för att se dem.
            </FieldHint>
          )}
        </div>
      </FormSection>

      {/* ------------------------------------------------------------------
          Grinden.
          ------------------------------------------------------------------ */}
      <FormSection title="Innan kontot skapas">
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant={grindOppen ? "secondary" : "primary"}
            onClick={kopiera}
            disabled={!kanKopiera}
            className="w-full"
          >
            {grindOppen ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            {grindOppen ? "Inloggning kopierad" : "Kopiera Inloggning"}
          </Button>

          {/* warn och inte muted: raden sager varfor knappen ovanfor inte gar
              att trycka pa, och det ar inte en upplysning i forbigaende. */}
          {!kanKopiera && felIFalt && (
            <FieldHint tone="warn">{felIFalt}</FieldHint>
          )}

          {/* Urklipp nekade. Raderna star i klartext i stallet, sa att de gar
              att markera for hand — se skrivTillUrklipp(). */}
          {kopieringsfel && (
            <div className="rounded-xl border border-night-accent/40 bg-night-accent/10 p-3.5">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-night-accent">
                <Warning className="mt-px h-4 w-4 shrink-0" />
                Webbläsaren tillät inte kopiering. Markera raderna nedan för
                hand.
              </p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-white/80">
                {kopieringsfel}
              </pre>
            </div>
          )}
        </div>
      </FormSection>

      <Button
        type="button"
        onClick={skapa}
        // `felIFalt` ocksa, och inte bara grinden. Nyckeln som haller grinden
        // oppen innehaller inte `losenIgen` — den ar en kontrollruta, inte en del
        // av det som kopierades — sa den gar att andra efterat utan att stanga
        // grinden. Det ar ratt for urklippet och fel for skarmen: knappen skulle
        // ga att trycka medan faltet under sager att de tva inte ar lika.
        disabled={!grindOppen || felIFalt !== null || sparar}
        // `glow` ar knappens "nu ar det bara det har kvar"-lage. Den ar precis
        // vad grinden betyder: allt annat pa skarmen ar gjort.
        glow={grindOppen && felIFalt === null && !sparar}
        className="w-full"
      >
        {sparar ? "Tillverkar…" : "Tillverka Konto"}
      </Button>

      {!grindOppen && (
        <p className="px-1 text-center text-[11px] leading-relaxed text-white/50">
          {kopierad
            ? "Något ändrades efter kopieringen. Kopiera inloggningen igen."
            : "Kopiera inloggningen först."}
        </p>
      )}

      {fel && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-night-danger/40 bg-night-danger/10 p-3.5 text-xs leading-relaxed text-night-danger"
        >
          <Warning className="mt-px h-4 w-4 shrink-0" />
          {fel}
        </p>
      )}
    </div>
  );
}

function VaxelKnapp({
  aktiv,
  onClick,
  label,
}: {
  aktiv: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktiv}
      className={`h-11 flex-1 cursor-pointer rounded-lg text-sm font-bold transition-colors duration-200 ease-out motion-reduce:transition-none ${
        aktiv ? "bg-night-accent text-black" : "text-white/60 active:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Ett losenordsfalt med oga.
 *
 * Ogat styr BADA falten, inte bara sitt eget, och det ar avsiktligt: det man
 * behover ogat till ar att se varfor de tva inte ar lika, och ett avslojat falt
 * bredvid ett dolt svarar inte pa den fragan.
 */
function LosenordsFalt({
  label,
  value,
  onChange,
  visa,
  onToggleVisa,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visa: boolean;
  onToggleVisa: () => void;
}) {
  return (
    <label className="block">
      <FieldLabel>
        {label}
        <span aria-hidden className="ml-1 text-night-accent">
          *
        </span>
      </FieldLabel>
      <div className="relative">
        <input
          type={visa ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          // Plats at knappen, sa att lang text inte hamnar under den.
          className={`${FIELD_BOX} pr-12`}
        />
        <button
          type="button"
          onClick={onToggleVisa}
          aria-label={visa ? "Dölj lösenorden" : "Visa lösenorden"}
          aria-pressed={visa}
          className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-white/55 active:text-white/80"
        >
          {visa ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </label>
  );
}
