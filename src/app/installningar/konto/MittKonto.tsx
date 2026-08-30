"use client";

import { User } from "@/components/Icons";
import { useAuth } from "@/lib/auth";
import { KONTO_STATUS } from "@/lib/konton";
import { rollEtikett } from "@/lib/roller";

/**
 * Ditt eget konto, overst pa Konto-skarmen.
 *
 * Listan under ar de ANDRAS konton — vem som kommer in i appen och med vilken
 * roll. Det som saknades var det egna: man kom in pa skarmen som heter Konto
 * och fick en katalog over alla utom sig sjalv, och for att hitta sin egen rad
 * fick man leta efter sitt namn bland kollegornas.
 *
 * Kortet svarar pa "vem ar jag har inne" innan listan svarar pa "vilka andra
 * finns". Bilden ar stor med flit: den ar samma bild som numera sitter som
 * knapp uppe i hornet pa varje skarm, och att mota den i full storlek precis
 * har ar det som gor knappen begriplig.
 *
 * Ingen egen hamtning. Allt kortet visar ligger redan i auth-kontexten, som
 * hamtar det i samma fraga som rollen — se lib/auth.tsx. En skarm som fragar om
 * uppgifter appen redan har ar en fraga till som kan misslyckas.
 */
export function MittKonto() {
  const { namn, bild, epost, roll, kontostatus, rollLoading } = useAuth();

  const status =
    KONTO_STATUS.find((s) => s.value === kontostatus)?.label ?? kontostatus;

  return (
    <div className="glass mb-3 flex items-center gap-4 rounded-2xl p-4">
      {/* 64px och rund, alltsa storre an listans 44px men samma form. Den ar
          samma sak sedd narmare, inte en annan sorts bild. */}
      <span className="glass-flat flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-white/45">
        {bild ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bild} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-7 w-7" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        {/* Ett konto utan arbetarrad heter sin adress — samma regel som i
            kontolistan, sa den som star utan namn dar star utan namn har. */}
        <p className="truncate text-[17px] font-extrabold leading-tight text-white">
          {namn ?? epost ?? "—"}
        </p>
        {namn && epost && (
          <p className="mt-0.5 truncate text-xs text-white/60">{epost}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* Rollen i amber: den ar det som avgor vad resten av appen visar,
              och darfor den enda uppgiften pa kortet som ar vard en fargton. */}
          <span className="rounded-full bg-night-accent/15 px-2.5 py-1 text-[11px] font-bold text-night-accent">
            {rollLoading ? "…" : rollEtikett(roll)}
          </span>
          {status && (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                kontostatus === "aktiv"
                  ? "bg-white/10 text-white/70"
                  : /* Allt annat an aktiv ar vart att marka: ett pausat eller
                       avstangt konto forklarar varfor nagot inte gar att gora. */
                    "bg-night-danger/15 text-night-danger"
              }`}
            >
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
