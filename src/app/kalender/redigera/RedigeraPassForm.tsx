"use client";

import { Button } from "@/components/Button";
import { DateSelect } from "@/components/DateSelect";
import { Dropdown } from "@/components/Dropdown";
import { FieldLabel } from "@/components/Field";
import { FormError } from "@/components/FormError";
import { FormSection } from "@/components/Panel";
import { PassFields, usePassFields } from "@/components/PassFields";
import { projectLabel } from "@/lib/format";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import type { Project, ShiftDetail } from "@/lib/types";
import { useState } from "react";
import { saveShift } from "../actions";

/**
 * Ett loggat pass, öppnat ur kalendern.
 *
 * Samma tre grupper som Logga Timmar och i samma ordning, för det är samma pass
 * — men bara ETT pass och bara EN arbetare, så den tredje gruppen är ingen lista
 * att fylla på utan ett namn att känna igen raden på.
 *
 * Arbetaren går med flit inte att byta. Ett pass som byter arbetare är inte ett
 * rättat pass; det är ett borttaget och ett nytt, och de här timmarna skulle
 * flytta mellan två personers löner utan att någonting på skärmen sagt det.
 * Blev det fel person är rätt väg att logga om passet på rätt.
 *
 * Fälten är förifyllda med det som står i databasen, inklusive Pass Tider när
 * passet har dem — `usePassFields` tar emot ett utgångsläge just för det här.
 * Sambandet mellan tiderna och timmarna gäller likadant här: ändrar man ett
 * klockslag skrivs det nya spannet in i Pass Timmar, färdigt att godta eller
 * skriva över.
 */
export function RedigeraPassForm({
  shift,
  projects,
}: {
  shift: ShiftDetail;
  projects: Project[];
}) {
  const pass = usePassFields({
    hours: String(shift.hours),
    start: shift.startTime ?? "",
    end: shift.endTime ?? "",
  });
  const [projectId, setProjectId] = useState(shift.projectId);
  const { submit, error, pending } = useNavigatingAction(saveShift);

  return (
    <form action={submit} className="flex flex-col gap-3.5">
      <input type="hidden" name="id" value={shift.id} />

      <FormSection title="Passet">
        <PassFields {...pass} />
      </FormSection>

      <FormSection title="När och var">
        <DateSelect defaultDate={shift.shiftDate} />
        <div>
          <FieldLabel>
            Project
            <span aria-hidden className="ml-1 text-night-accent">
              *
            </span>
          </FieldLabel>
          <Dropdown
            name="project_id"
            required
            value={projectId}
            onChange={setProjectId}
            options={projects.map((p) => ({ value: p.id, label: projectLabel(p) }))}
            placeholder="Välj project"
            emptyMessage="Inga project ännu."
          />
        </div>
      </FormSection>

      {/* Arbetaren som en läst rad och inte som ett fält: den som öppnat passet
          ur kalendern tryckte på ett namn, och namnet ska stå kvar så att man
          ser att man rättar rätt rad. */}
      <FormSection title="Arbetare">
        <div className="glass-flat rounded-xl px-3.5 py-3">
          <p className="text-[15px] font-bold text-white">{shift.workerName}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Passet hör till den här arbetaren och kan inte flyttas till någon
            annan. Blev det fel person: logga passet på rätt arbetare i stället.
          </p>
        </div>
      </FormSection>

      <FormError message={error} />

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Sparar…" : "Spara Passet"}
      </Button>
    </form>
  );
}
