"use client";

import { Button } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { DateSelect } from "@/components/DateSelect";
import { FieldLabel } from "@/components/Field";
import { FormSection } from "@/components/Panel";
import { PassFields, usePassFields } from "@/components/PassFields";
import { WorkerRows } from "@/components/WorkerRows";
import { projectLabel } from "@/lib/format";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import type { Project, Worker } from "@/lib/types";
import { logShifts } from "./actions";
import { LoggaTimmarProjectSelect } from "./LoggaTimmarProjectSelect";

/**
 * Ett pass, i tre steg: hur langt det var, nar och var det var, och vilka som
 * gick det. Grupperna ar precis de tre fragorna — och ordningen ar avsiktlig,
 * for langden ar det man kommer ihag samst och darfor skriver in forst.
 *
 * Tre av de fyra fälten är obligatoriska, och det är precis de tre som gör
 * passet till ett pass: Pass Timmar, Pass Datum och Project. Pass Tider är det
 * fjärde och det enda frivilliga — se <PassFields>.
 */
export function LoggaTimmarForm({
  projects,
  workers,
  selectedProjectId,
  defaultDate,
  returnTo,
}: {
  projects: Project[];
  workers: Worker[];
  selectedProjectId: string;
  /** 'YYYY-MM-DD' från Kalendern: dagen man tryckte på är redan ifylld. */
  defaultDate?: string;
  /** Vart man ska tillbaka efter sparandet. Utan den: Hem. */
  returnTo?: string;
}) {
  // Passets langd bors har och inte i <PassFields>: timmarna som skrivs hogst
  // upp i formularet ar samma timmar som ekas bredvid arbetarna langst ner.
  const pass = usePassFields();
  const { submit, error, pending } = useNavigatingAction(logShifts);

  return (
    <form action={submit} className="flex flex-col gap-3.5">
      {/* Kommer man från Kalendern ska man tillbaka dit, till den dag man just
          fyllde på. Ett dolt fält och inte ett argument till `logShifts`:
          åtgärden svarar med vart användaren ska, och det är ett faktum om
          skärmen som anropade den — se useNavigatingAction. */}
      {returnTo && <input type="hidden" name="retur" value={returnTo} />}

      <FormSection title="Passet">
        <PassFields {...pass} />
      </FormSection>

      <FormSection title="När och var">
        <DateSelect defaultDate={defaultDate} />
        <div>
          <FieldLabel>
            Project
            <span aria-hidden className="ml-1 text-night-accent">
              *
            </span>
          </FieldLabel>
          <LoggaTimmarProjectSelect
            value={selectedProjectId}
            options={projects.map((p) => ({ value: p.id, label: projectLabel(p) }))}
          />
        </div>
      </FormSection>

      <FormSection title="Arbetare">
        <WorkerRows workers={workers} hoursLabel={pass.echoHours} />
      </FormSection>

      <FormError message={error} />

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Sparar…" : "Logga Timmar"}
      </Button>
    </form>
  );
}
