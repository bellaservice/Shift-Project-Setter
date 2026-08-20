import { User } from "@/components/Icons";
import { EmptyState } from "@/components/Screen";
import { KONTO_STATUS } from "@/lib/konton";
import type { KontoItem } from "@/lib/types";

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
export function KontoList({ konton }: { konton: KontoItem[] }) {
  return (
    <>
      <p className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] leading-relaxed text-white/65">
        Konton visas har men hanteras i Supabase under{" "}
        <span className="font-semibold text-white/80">
          Authentication &gt; Users
        </span>
        . Appen kor utan server och kan darfor inte skapa, ta bort eller sparra
        inloggningar.
      </p>

      {konton.length === 0 ? (
        <EmptyState
          title="Inga konton än."
          hint="Ett konto är en arbetares inloggning i appen."
        />
      ) : (
        <div className="glass rounded-2xl">
          <div className="divide-y divide-night-line">
            {konton.map((konto) => (
              <KontoRad key={konto.id} konto={konto} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function KontoRad({ konto }: { konto: KontoItem }) {
  const status =
    KONTO_STATUS.find((s) => s.value === konto.status)?.label ?? konto.status;

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Avatar bild={konto.bild} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-white">
          {konto.namn}
        </div>
        <div className="truncate text-xs text-white/60">{konto.epost}</div>
      </div>

      <StatusBricka status={status} aktiv={konto.status === "aktiv"} />
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
