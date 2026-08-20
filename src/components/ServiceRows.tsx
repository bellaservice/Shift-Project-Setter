"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { FIELD_BOX, FieldLabel } from "@/components/Field";
import { Plus } from "@/components/Icons";

type ServiceRow = {
  key: number;
  service_name: string;
  price: string;
  priceOpen: boolean;
};

function nextKey(rows: { key: number }[]): number {
  return rows.length > 0 ? Math.max(...rows.map((r) => r.key)) + 1 : 0;
}

// Endast siffror och ett decimaltecken.
function sanitizePrice(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, "");
  const sep = cleaned.search(/[.,]/);
  if (sep === -1) return cleaned;
  return cleaned.slice(0, sep + 1) + cleaned.slice(sep + 1).replace(/[.,]/g, "");
}

export function ServiceRows({
  initial,
}: {
  initial?: { service_name: string; price: number | null }[];
}) {
  const [rows, setRows] = useState<ServiceRow[]>(() => {
    const base = initial && initial.length > 0 ? initial : [{ service_name: "", price: null }];
    return base.map((s, i) => ({
      key: i,
      service_name: s.service_name,
      price: s.price != null ? String(s.price) : "",
      // Per wireframe: rad 1 visar alltid båda fälten. Bara rader som läggs
      // till med "+ Lägg Till" döljer Pris bakom knappen.
      priceOpen: i === 0 || s.price != null,
    }));
  });
  const [focusKey, setFocusKey] = useState<number | null>(null);

  function updateRow(key: number, patch: Partial<ServiceRow>) {
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-end gap-2">
          {/* Etiketten ligger i första radens kolumn, i nivå med "Pris", så att
              radens höjd inte skapar ett glapp mellan rubrik och textfält. */}
          <div className="min-w-0 flex-[2]">
            {index === 0 && <FieldLabel>Tjänster</FieldLabel>}
            <input
              name="service_name"
              defaultValue={row.service_name}
              placeholder="Tjänst"
              className={FIELD_BOX}
            />
          </div>

          {/* Priset skickas alltid med, så att raderna paras ihop rätt på servern. */}
          <input type="hidden" name="price" value={row.price.replace(",", ".")} />

          {/* flex-1 mot fältets flex-[2] ger 2:1-förhållandet i båda lägena. */}
          <div className="min-w-0 flex-1">
            {row.priceOpen ? (
              <>
                {index === 0 && <FieldLabel>Pris</FieldLabel>}
                <div className="relative">
                  {/* "Kr" ligger i faltet som en fast etikett, inte som en
                      placeholder: enheten hor till rutan och ska sta kvar aven
                      nar det star en siffra i den. */}
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-white/45">
                    Kr
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus={focusKey === row.key}
                    value={row.price}
                    onChange={(e) => updateRow(row.key, { price: sanitizePrice(e.target.value) })}
                    aria-label="Pris i kronor"
                    className={`${FIELD_BOX} pl-10 tabular-nums`}
                  />
                </div>
              </>
            ) : (
              /* Priset ar frivilligt, sa nya rader oppnar utan det. Knappen ar
                 en tom ruta i samma mall som faltet den ersatter — den visar
                 var priset kommer att hamna i stallet for att peka pa det. */
              <button
                type="button"
                onClick={() => {
                  setFocusKey(row.key);
                  updateRow(row.key, { priceOpen: true });
                }}
                className="flex h-[50px] w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-dashed border-night-accent/40 bg-night-accent/10 text-sm font-bold text-night-accent transition-colors duration-200 ease-out active:bg-night-accent/20 motion-reduce:transition-none"
              >
                <Plus className="h-3.5 w-3.5" />
                Pris
              </button>
            )}
          </div>

          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
              aria-label="Ta bort rad"
              className="flex h-[50px] w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-lg text-white/40 transition-colors duration-200 ease-out active:text-night-danger motion-reduce:transition-none"
            >
              &times;
            </button>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          setRows((r) => [
            ...r,
            { key: nextKey(r), service_name: "", price: "", priceOpen: false },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Lägg Till
      </Button>
    </div>
  );
}
