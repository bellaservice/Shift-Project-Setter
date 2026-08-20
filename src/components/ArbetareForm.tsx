"use client";

import { saveWorker } from "@/app/ny-arbetare/actions";
import { Button } from "@/components/Button";
import { EmergencyContactFields } from "@/components/EmergencyContactFields";
import { Field } from "@/components/Field";
import { FormSection } from "@/components/Panel";
import { ProfilePictureInput } from "@/components/ProfilePictureInput";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import type { Worker } from "@/lib/types";

/**
 * Samma formular for Ny Arbetare och Redigera Arbetare — bara knappen langst
 * ner byter ord, precis som LoggaProjectForm gor for project. Utan `worker`
 * skapas en ny rad; med `worker` uppdateras den som id:t pekar pa.
 *
 * Nio falt i rad ar en vagg. De ar darfor grupperade i tre kort efter vad de
 * anvands till — vem personen ar, hur man nar hen, och vad som behovs for att
 * betala ut lon — sa att formularet ar tre saker att fylla i i stallet for nio.
 * Grupperna ar ocksa varfor knappen langst ner alltid syns som knappen: den ar
 * det enda fyllda faltet pa hela sidan.
 */
export function ArbetareForm({
  worker,
  submitLabel = "Lägg Till Arbetare",
  next,
}: {
  worker?: Worker;
  submitLabel?: string;
  /** Vagen tillbaka till sidan som skickade hit, t.ex. ett paborjat Logga
   *  Project. Utan den lamnar sparandet till Hem eller arbetarlistan. */
  next?: string;
}) {
  // saveWorker svarar numera med vagen framat i stallet for att kalla pa
  // redirect(), som inte finns i en handelsehanterare. Se useNavigatingAction.
  const submit = useNavigatingAction(saveWorker);

  return (
    <form action={submit} className="flex flex-col gap-3.5">
      {worker && <input type="hidden" name="id" value={worker.id} />}
      {next && <input type="hidden" name="next" value={next} />}

      <FormSection title="Person">
        <ProfilePictureInput currentUrl={worker?.profile_picture_url} />
        <Field label="Namn" name="name" required defaultValue={worker?.name} />
        <Field
          label="Person nummer"
          name="personal_number"
          numeric
          defaultValue={worker?.personal_number ?? ""}
        />
      </FormSection>

      <FormSection title="Kontakt">
        <Field
          label="E-postadress"
          name="email"
          type="email"
          defaultValue={worker?.email ?? ""}
        />
        <Field
          label="Telefon Nummer"
          name="phone"
          type="tel"
          numeric
          defaultValue={worker?.phone ?? ""}
        />
        <Field label="Adress" name="address" defaultValue={worker?.address ?? ""} />
      </FormSection>

      <FormSection title="Ersättning">
        <Field
          label="Kontonummer"
          name="account_number"
          numeric
          defaultValue={worker?.account_number ?? ""}
        />
      </FormSection>

      <EmergencyContactFields
        defaultName={worker?.emergency_contact_name ?? ""}
        defaultPhone={worker?.emergency_contact_phone ?? ""}
        defaultEmail={worker?.emergency_contact_email ?? ""}
      />

      <Button type="submit" className="mt-1 w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
