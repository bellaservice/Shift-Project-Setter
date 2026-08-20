"use client";

import { useState } from "react";
import { Field, FieldHint } from "@/components/Field";
import { Warning } from "@/components/Icons";
import { FormSection } from "@/components/Panel";

/**
 * Narmst anhorig ar en grupp, inte ett fritextfalt: antingen ar hela gruppen
 * tom, eller sa finns ett namn tillsammans med telefon och/eller e-post.
 * Ett namn utan kontaktvag gar alltsa inte att spara.
 *
 * Gruppen ar ett eget glaskort, precis som formularets ovriga avsnitt — regeln
 * ovan galler HELA rutan, och en ruta ar det enda som visar var "hela rutan"
 * borjar och slutar.
 */
export function EmergencyContactFields({
  defaultName = "",
  defaultPhone = "",
  defaultEmail = "",
}: {
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
} = {}) {
  // Startar pa de sparade varden, annars skulle en redigering av en arbetare som
  // redan har en anhorig visa "ange namn" over ett falt som ar ifyllt.
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);

  const hasName = name.trim().length > 0;
  const hasPhone = phone.trim().length > 0;
  const hasEmail = email.trim().length > 0;

  const missingName = !hasName && (hasPhone || hasEmail);
  const missingContact = hasName && !hasPhone && !hasEmail;
  const broken = missingName || missingContact;

  return (
    // Samma kort som formularets ovriga grupper, och av samma skal: en
    // <fieldset> ritar sin <legend> INUTI sin egen ram, vilket skar ett hack
    // genom bade hairlinen och glasets ovre dager. <FormSection> ar en markt
    // <section>, vilket gor samma sak for skarmlasaren utan att bryta kortet.
    <FormSection title="Närmast Anhörig">
      <Field
        label="Namn"
        name="emergency_contact_name"
        defaultValue={defaultName}
        onValueChange={setName}
        validationMessage={
          missingName ? "Ange namn på närmast anhörig." : undefined
        }
      />
      <Field
        label="Telefon Nummer"
        name="emergency_contact_phone"
        type="tel"
        numeric
        defaultValue={defaultPhone}
        onValueChange={setPhone}
        validationMessage={
          missingContact
            ? "Ange telefonnummer eller e-post till närmast anhörig."
            : undefined
        }
      />
      <Field
        label="E-postadress"
        name="emergency_contact_email"
        type="email"
        defaultValue={defaultEmail}
        onValueChange={setEmail}
      />

      {/* Regeln star kvar hela tiden och byter bara ton — den ar en
            forklaring innan man skrivit och en rattelse efterat. Ikonen kommer
            fram nar den ar en rattelse, sa att larmet inte bars av fargen
            ensam. */}
      <div className="flex items-start gap-1.5">
        {broken && (
          <Warning className="mt-2 h-3.5 w-3.5 shrink-0 text-night-danger" />
        )}
        <FieldHint tone={broken ? "danger" : "muted"}>
          Fyll i namn tillsammans med telefonnummer eller e-post, eller lämna
          hela rutan tom.
        </FieldHint>
      </div>
    </FormSection>
  );
}
