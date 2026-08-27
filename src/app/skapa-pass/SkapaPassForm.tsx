"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { DateSelect } from "@/components/DateSelect";
import { FieldHint, FieldLabel } from "@/components/Field";
import { FormError } from "@/components/FormError";
import { FormSection } from "@/components/Panel";
import { TimeRangeSelect } from "@/components/TimeWheelSelect";
import { WorkerRows } from "@/components/WorkerRows";
import { Dropdown } from "@/components/Dropdown";
import { projectLabel } from "@/lib/format";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import type { Project, Worker } from "@/lib/types";
import { skapaPass } from "./actions";

/**
 * Formularet som lagger ut pass i forvag.
 *
 * Nastan samma falt som Logga Timmar, med ETT borttaget och det ar det som gor
 * hela skillnaden: har finns ingen ruta for timmar. Ett pass som ska hanta har
 * inga arbetade timmar, och att erbjuda faltet hade inbjudit till att fylla i
 * det -- varpa passet fott sig sjalvt en siffra ingen arbetat ihop.
 *
 * Falten aterbrukas fran Logga Timmar (DateSelect, WorkerRows). Det ar med
 * flit: den som kan det ena formularet ska kanna igen sig i det andra, och
 * skillnaden mellan dem ska vara innehallet och inte utseendet.
 *
 * Projectvaljaren ar dock EGEN — se kommentaren vid <Dropdown> nedan.
 */
export function SkapaPassForm({
  projects,
  workers,
  selectedProjectId,
  defaultDate,
}: {
  projects: Project[];
  workers: Worker[];
  selectedProjectId: string;
  defaultDate?: string;
}) {
  const { submit, error, pending } = useNavigatingAction(skapaPass);

  // `selectedProjectId` ar bara utgangslaget — kommer man hit med ?project=
  // star det redan valt. Darefter bar formularet sitt eget varde.
  const [projectId, setProjectId] = useState(selectedProjectId);

  // Planerade tider, lokalt burna. Frivilliga -- se hinten nedan.
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  return (
    <form action={submit} className="flex flex-col gap-3.5">
      <FormSection title="Nar och var">
        <DateSelect defaultDate={defaultDate} />
        <div>
          <FieldLabel>
            Project
            <span aria-hidden className="ml-1 text-night-accent">
              *
            </span>
          </FieldLabel>
          {/* En vanlig Dropdown med lokalt varde, INTE
              <LoggaTimmarProjectSelect>. Den senare lagger valet i adressen och
              gor `router.replace("/logga-timmar")` — den ar hardkodad till sin
              egen skarm, sa ett projectval har hade slangt ut anvandaren till
              Logga Timmar med formularet tomt. (Det gjorde den ocksa, tills ett
              test upptackte det.)

              Skarmen behover inte adressen: till skillnad fran Logga Timmar har
              den ingen "Senaste Pass"-lista som beror pa valet. */}
          <Dropdown
            name="project_id"
            required
            value={projectId}
            onChange={setProjectId}
            options={projects.map((p) => ({ value: p.id, label: projectLabel(p) }))}
            placeholder="Valj project"
            emptyMessage="Inga project ännu."
          />
        </div>
      </FormSection>

      <FormSection title="Pass Tider">
        <TimeRangeSelect
          start={{
            name: "start_time",
            label: "Pass start",
            value: start,
            fallback: "07:00",
            onChange: setStart,
          }}
          end={{
            name: "end_time",
            label: "Pass slut",
            value: end,
            fallback: "16:00",
            onChange: setEnd,
          }}
          onClear={
            start !== "" || end !== ""
              ? () => {
                  setStart("");
                  setEnd("");
                }
              : undefined
          }
        />
        <FieldHint>
          Frivilligt. Tiderna sager nar passet ska börja och sluta — arbetaren
          stamplar anda sina egna. Fyller du i dem star de som Pass Tider i
          Arbetsdagboken.
        </FieldHint>
      </FormSection>

      <FormSection title="Arbetare">
        {/* `hoursLabel={null}`: det ar ekot av timfaltet i Logga Timmar, och
            det faltet finns inte har. */}
        <WorkerRows workers={workers} hoursLabel={null} />
      </FormSection>

      <FormError message={error} />

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Skapar…" : "Skapa Pass"}
      </Button>
    </form>
  );
}
