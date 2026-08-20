"use client";

import { useEffect, useRef } from "react";

/**
 * Ett formularfalt: etikett ovanfor, ruta under, och eventuellt en hjalprad
 * langst ner.
 *
 * Etiketten ar alltid synlig och aldrig ersatt av en placeholder. En placeholder
 * forsvinner i samma ogonblick som man borjar skriva, och da star man med ett
 * ifyllt falt utan att veta vad det var man fyllde i.
 *
 * Rutan ar `glass-field` — appens ena faltmaterial. Den ar morkare an panelerna
 * runt omkring, inte ljusare: en panel ar nagot man tittar pa, ett falt ar
 * nagot man tittar ner i. Fokus, oppet lage och fel bors av materialet sjalvt
 * (se globals.css), sa inget falt kan tappa bort sin fokusmarkering.
 *
 * Hojden ar 48px och inte de 38px den var: 44px ar golvet for en trafftyta, och
 * 16px text ar det som hindrar iOS fran att zooma in nar man trycker i faltet.
 */
export const FIELD_BOX =
  "glass-field w-full rounded-xl px-3.5 py-3 text-base outline-none";

/** Etikettraden — samma ton och vikt over hela appen. Exporterad for de fa
 *  stallen som har en grupp i stallet for ett enskilt falt. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-semibold text-white/75">
      {children}
    </span>
  );
}

/** Hjalptexten under ett falt. Kvar hela tiden, inte bara vid fel — den
 *  forklarar vad varden anvands till, och det behovs innan man skrivit. */
export function FieldHint({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "warn" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-night-danger"
      : tone === "warn"
        ? "text-night-accent"
        : "text-white/55";
  return <p className={`mt-1.5 text-[11px] leading-relaxed ${color}`}>{children}</p>;
}

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  textarea,
  numeric,
  hint,
  onValueChange,
  validationMessage,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  textarea?: boolean;
  /** Tillater bara siffror och oppnar sifferknappsatsen pa mobil. */
  numeric?: boolean;
  /** Stadigvarande forklaring under faltet. */
  hint?: React.ReactNode;
  /** Anropas med faltets varde varje gang det andras. */
  onValueChange?: (value: string) => void;
  /** Satt till ett felmeddelande for att blockera submit, eller undefined nar faltet ar giltigt. */
  validationMessage?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.setCustomValidity(validationMessage ?? "");
  }, [validationMessage]);

  return (
    <label className="block">
      <FieldLabel>
        {label}
        {/* Obligatoriskt markeras med accenten och inte med en gra asterisk:
            pa svart forsvinner en gra asterisk, och den ar dessutom det enda
            som skiljer ett maste-falt fran ett frivilligt. */}
        {required && (
          <span aria-hidden className="ml-1 text-night-accent">
            *
          </span>
        )}
      </FieldLabel>

      {textarea ? (
        <textarea
          name={name}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={3}
          onInput={
            onValueChange
              ? (event) => onValueChange(event.currentTarget.value)
              : undefined
          }
          className={`${FIELD_BOX} resize-y leading-relaxed`}
        />
      ) : (
        <input
          ref={inputRef}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          inputMode={numeric ? "numeric" : undefined}
          pattern={numeric ? "[0-9]*" : undefined}
          onInput={
            numeric || onValueChange
              ? (event) => {
                  const input = event.currentTarget;
                  if (numeric) {
                    const digits = input.value.replace(/\D/g, "");
                    if (digits !== input.value) input.value = digits;
                  }
                  onValueChange?.(input.value);
                }
              : undefined
          }
          className={FIELD_BOX}
        />
      )}

      {hint && <FieldHint>{hint}</FieldHint>}
    </label>
  );
}
