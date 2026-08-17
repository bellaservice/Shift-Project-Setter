"use client";

import { Field } from "@/components/Field";
import { ProfilePictureInput } from "@/components/ProfilePictureInput";
import { createWorker } from "./actions";

export function NyArbetareForm() {
  return (
    <form action={createWorker} className="flex flex-col gap-4">
      <ProfilePictureInput />
      <Field label="Namn" name="name" required />
      <Field label="E-postadress" name="email" type="email" />
      <Field label="Telefon Nummer" name="phone" type="tel" />
      <Field label="Adress" name="address" />
      <Field label="Person nummer" name="personal_number" />
      <Field label="Kontonummer" name="account_number" />
      <Field label="Narmst Anhorig" name="emergency_contact" />

      <button
        type="submit"
        className="mt-2 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white"
      >
        Lagg Till Arbetare
      </button>
    </form>
  );
}
