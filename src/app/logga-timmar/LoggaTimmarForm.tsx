"use client";

import { Button } from "@/components/Button";
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
 */
export function LoggaTimmarForm({
  projects,
  workers,
  selectedProjectId,
}: {
  projects: Project[];
  workers: Worker[];
  selectedProjectId: string;
}) {
  // Passets langd bors har och inte i <PassFields>: timmarna som skrivs hogst
  // upp i formularet ar samma timmar som ekas bredvid arbetarna langst ner.
  const pass = usePassFields();
  const submit = useNavigatingAction(logShifts);

  return (
    <form action={submit} className="flex flex-col gap-3.5">
      <FormSection title="Passet">
        <PassFields {...pass} />
      </FormSection>

      <FormSection title="När och var">
        <DateSelect />
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

      <Button type="submit" className="mt-1 w-full">
        Logga Timmar
      </Button>
    </form>
  );
}
