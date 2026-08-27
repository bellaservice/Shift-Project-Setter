"use client";

import { User } from "@/components/Icons";
import { EmptyState } from "@/components/Screen";
import { KONTO_STATUS } from "@/lib/konton";
import type { KontoItem, Roll } from "@/lib/types";

/**
 * Vilka som kan logga in, och vad de har for status. Bara att lasa.
 *
 * Skarmen kunde tidigare tillverka, ta bort och sparra konton. Alla tre gick
 * genom Supabases admin-API, som bara svarar pa service role-nyckeln, och den
 * nyckeln kan inte finnas i en webblasare — se src/lib/accounts.ts. Nar appen
 * blev en statisk sida pa GitHub Pages forsvann servern som bar den, och
 * darmed knapparna.
 *
 * Listan ar kvar. `public.accounts` ar en vanlig tabell som RLS later en
 * inloggad anvandare lasa, sa fragan "vem kommer in i appen, och ar hon aktiv"
 * gar fortfarande att svara pa harifran. Det som inte gar ar att andra svaret:
 * det sker i Supabase (Authentication > Users), eller genom en Edge Function
 * om skarmen ska fa tillbaka sina knappar.
 *
 * Statusen visas som en bricka i stallet for en dropdown. En dropdown man kan
 * oppna men inte spara ar varre an ingen dropdown: den ser ut som ett val, och
 * det ar den inte langre.
 */
export function KontoList({
  konton,
  onRollByte,
  pending = false,
}: {
  konton: KontoItem[];
  /**
   * Utelamnas den ar listan bara att lasa — precis som forr. Skickas den med
   * far varje rad en rollvaxel.
   *
   * En prop och inte ett internt rollkall: den som INTE ar arbetsledare ska
   * inte se kontrollen alls, och den som anropar vet det redan. Att gomma
   * kontrollen ar dock artighet — accounts_update_arbetsledare avvisar en
   * arbetares skrivning oavsett vad skarmen visar.
   */
  onRollByte?: (formData: FormData) => void;
  pending?: boolean;
}) {
  if (konton.length === 0) {
    return (
      <EmptyState
        title="Inga konton än."
        hint="Ett konto är en arbetares inloggning i appen."
      />
    );
  }

  return (
    <div className="glass rounded-2xl">
      <div className="divide-y divide-night-line">
        {konton.map((konto) => (
          <KontoRad
            key={konto.id}
            konto={konto}
            onRollByte={onRollByte}
            pending={pending}
          />
        ))}
      </div>
    </div>
  );
}

/** De tva rollerna, i den ordning de star i vaxeln. */
const ROLLER: { value: Roll; label: string }[] = [
  { value: "arbetsledare", label: "Arbetsledare" },
  { value: "arbetare", label: "Arbetare" },
];

/**
 * Rollvaxeln: EN kontroll med tva lagen, inte tva knappar bredvid varandra.
 *
 * Skillnaden ar inte kosmetisk. Tva likadana knappar sager "har finns tva
 * saker att gora"; en vaxel med ett markerat lage sager "kontot ar det har, och
 * det gar att flytta" — vilket ar sant. Den gallande rollen bar den gula
 * plattan, den andra halvan ar bara text, och plattan glider over nar rollen
 * byts. Att den ROR sig ar sjalva beskedet om att nagot hant.
 *
 * Ett formular och tva submit-knappar, inte tva formular: en submit-knapp med
 * `name` och `value` skickar med sitt eget varde i formData, sa hela vaxeln ar
 * en enda inlamning och `konto_id` behover bara sta en gang.
 *
 * Den gallande halvan ar avstangd. Ett tryck pa den roll kontot redan har vore
 * en skrivning som inte andrar nagot, och skarmen hade rapporterat en lyckad
 * andring som aldrig skedde. Avstangd syns inte som gragjord har — halvan ar
 * ju den upplysta — utan bara som att det inte hander nagot.
 */
function RollVaxel({
  konto,
  onRollByte,
  pending,
}: {
  konto: KontoItem;
  onRollByte: (formData: FormData) => void;
  pending: boolean;
}) {
  // Okand roll behandlas som arbetare, samma hallning som overallt annars.
  const gallande: Roll = konto.roll ?? "arbetare";
  const arLedare = gallande === "arbetsledare";

  return (
    <form action={onRollByte} className="mt-2.5">
      <input type="hidden" name="konto_id" value={konto.id} />

      <div
        role="group"
        aria-label={`Roll for ${konto.namn}`}
        className="relative grid grid-cols-2 rounded-xl bg-white/8 p-1"
      >
        {/* Plattan. `w-[calc(50%-4px)]` ar exakt en halva av innermatten
            (p-1 = 4px pa varje sida), sa `translate-x-full` flyttar den precis
            en halva — fran vanster segments kant till hogers. Ingen gissad
            pixel, och den foljer med nar raden byter bredd. */}
        <span
          aria-hidden
          className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-night-accent shadow-[0_2px_10px_-2px_rgba(255,185,46,0.6)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
            arLedare ? "translate-x-0" : "translate-x-full"
          }`}
        />

        {ROLLER.map((roll) => {
          const vald = roll.value === gallande;
          return (
            <button
              key={roll.value}
              type="submit"
              name="roll"
              value={roll.value}
              disabled={pending || vald}
              aria-pressed={vald}
              /* z-10: texten ligger OVANFOR plattan, sa den valda etiketten
                 blir svart mot gult i stallet for att gomma sig under den. */
              className={`relative z-10 h-10 rounded-lg text-sm font-bold transition-colors duration-200 ease-out motion-reduce:transition-none ${
                vald
                  ? "text-black"
                  : "text-white/70 active:text-white disabled:opacity-45"
              }`}
            >
              {roll.label}
            </button>
          );
        })}
      </div>
    </form>
  );
}

function KontoRad({
  konto,
  onRollByte,
  pending,
}: {
  konto: KontoItem;
  onRollByte?: (formData: FormData) => void;
  pending: boolean;
}) {
  // Ett konto utan arbetare heter sin adress, sa att upprepa adressen pa
  // underraden vore att skriva samma sak tva ganger. Underraden sager i stallet
  // vad raden ar, vilket ar den enda uppgift som skiljer den fran de andra.
  const status =
    KONTO_STATUS.find((s) => s.value === konto.status)?.label ?? konto.status;

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Avatar bild={konto.bild} />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-white">
            {konto.namn}
          </div>
          <div className="truncate text-xs text-white/60">
            {konto.kopplad ? konto.epost : "Utan arbetare"}
          </div>
        </div>

        <StatusBricka status={status} aktiv={konto.status === "aktiv"} />
      </div>

      {onRollByte && (
        <RollVaxel konto={konto} onRollByte={onRollByte} pending={pending} />
      )}
    </div>
  );
}

/** Aktiv ar amber, allt annat ar damput — sparrad ar inte ett fel, bara ett nej. */
function StatusBricka({ status, aktiv }: { status: string; aktiv: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        aktiv
          ? "bg-night-accent/15 text-night-accent"
          : "bg-white/10 text-white/55"
      }`}
    >
      {status}
    </span>
  );
}

/**
 * Bilden, eller det som star i stallet for den.
 *
 * Ingen `next/image`: kallan ar arbetarens profilbild i Supabase Storage, den
 * ar redan liten, och raden visar den i 44px. En optimerare mellan dem hade
 * bara varit ett led till som kan sakna konfiguration for varden.
 */
function Avatar({ bild }: { bild: string | null }) {
  return (
    <span className="glass-flat flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-white/45">
      {bild ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bild} alt="" className="h-full w-full object-cover" />
      ) : (
        <User className="h-5 w-5" />
      )}
    </span>
  );
}
