"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { EmergencyContactFields } from "@/components/EmergencyContactFields";
import { Field, FieldHint, FieldLabel } from "@/components/Field";
import { FormError } from "@/components/FormError";
import { FormSection } from "@/components/Panel";
import { Query } from "@/components/Query";
import { EmptyState } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { getWorker } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";
import { sparaEgnaUppgifter } from "./egnaUppgifter";

/**
 * Arbetarens egen halva av Konto-skarmen.
 *
 * Skarmen visade tidigare en vagg for den som inte ledde arbetet: "Den har
 * skarmen ar arbetsledarens." Sant om kontoLISTAN, men skarmen heter Konto, och
 * det finns ett konto har som ar arbetarens eget — med tomma falt som bara hon
 * kan fylla i. Telefonnumret och kontonumret skrevs fram till nu in av
 * administratoren efter muntlig uppgift, vilket ar bade omvagen och det stalle
 * dar ett felstavat clearingnummer uppstar.
 *
 * TRE SAKER GAR INTE ATT RORA HARIFRAN, och de star utskrivna pa skarmen i
 * stallet for att bara vara avstangda:
 *
 *   Namnet    Det ar administratorens uppgift om vem hon ar.
 *   E-posten  Den ar inloggningen. Den star bade i auth.users och i workers,
 *             och andras den pa ett stalle utan det andra gar kontot inte
 *             langre att logga in i.
 *   Kontot    Det tas inte bort harifran. Papperskorgen ar arbetsledarens.
 *
 * Ett last falt utan forklaring lases som ett fel i appen. Ett last falt med en
 * rad under sig lases som en regel, och da slutar man undra.
 *
 * ⚠️ Allt det har ar KOSMETIK. Grinden ar kit.workers_guard_egna_uppgifter(),
 * som avvisar en andring av namn, e-post eller deleted_at fran den som inte
 * leder arbetet — oavsett vilket formular den kom ifran.
 */
export function MinaUppgifter() {
  const { arbetareId } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [sparat, setSparat] = useState(false);
  const [sparar, setSparar] = useState(false);

  const arbetare = useQuery(
    () => (arbetareId ? getWorker(arbetareId) : Promise.resolve(null)),
    [arbetareId ?? ""]
  );

  async function spara(formData: FormData) {
    setSparar(true);
    setError(null);
    setSparat(false);
    try {
      await sparaEgnaUppgifter(formData);
      setSparat(true);
      // Las om: vakten kan ha avvisat en del av skrivningen, och da ar det
      // databasens rad som ar sanningen — inte det som star i rutorna.
      arbetare.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nagot gick fel.");
    } finally {
      setSparar(false);
    }
  }

  if (arbetareId === null) {
    return (
      <EmptyState
        title="Det har kontot ar inte kopplat till nagon arbetare."
        hint="Ett konto for kontoret har inga egna uppgifter att fylla i. Kontot ovan ar allt som finns."
      />
    );
  }

  return (
    <Query state={arbetare}>
      {(w) =>
        w === null ? (
          <EmptyState
            title="Dina uppgifter gick inte att hamta."
            hint="Ladda om sidan. Star det kvar, sag till din arbetsledare."
          />
        ) : (
          <form action={spara} className="flex flex-col gap-3.5">
            <input type="hidden" name="id" value={w.id} />
            <FormError message={error} />

            {/* Det lasta forst, och som TEXT och inte som avstangda falt. En
                gragjord ruta ser ut som nagot man borde kunna fylla i; en rad
                text ser ut som en uppgift. */}
            <FormSection title="Satt av din arbetsledare">
              <div>
                <FieldLabel>Namn</FieldLabel>
                <p className="text-[15px] font-bold text-white">{w.name}</p>
              </div>
              <div>
                <FieldLabel>E-post</FieldLabel>
                <p className="text-[15px] font-bold text-white">
                  {w.email ?? "—"}
                </p>
                <FieldHint>
                  Namnet och e-posten andras av din arbetsledare. E-posten ar
                  dessutom din inloggning.
                </FieldHint>
              </div>
            </FormSection>

            <FormSection title="Kontakt">
              <Field
                label="Telefon"
                name="phone"
                type="tel"
                defaultValue={w.phone ?? ""}
              />
              <Field label="Adress" name="address" defaultValue={w.address ?? ""} />
            </FormSection>

            <FormSection title="For lonen">
              <Field
                label="Personnummer"
                name="personal_number"
                defaultValue={w.personal_number ?? ""}
                placeholder="ÅÅÅÅMMDD-XXXX"
              />
              <Field
                label="Kontonummer"
                name="account_number"
                defaultValue={w.account_number ?? ""}
                hint="Clearingnummer och kontonummer."
              />
            </FormSection>

            <EmergencyContactFields
              defaultName={w.emergency_contact_name ?? ""}
              defaultPhone={w.emergency_contact_phone ?? ""}
              defaultEmail={w.emergency_contact_email ?? ""}
            />

            <Button type="submit" disabled={sparar} className="w-full">
              {sparar ? "Sparar…" : "Spara Mina Uppgifter"}
            </Button>

            {sparat && error === null && (
              <p className="text-center text-sm font-bold text-night-accent">
                Sparat.
              </p>
            )}
          </form>
        )
      }
    </Query>
  );
}
