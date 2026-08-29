"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Dropdown } from "@/components/Dropdown";
import { FieldHint, FieldLabel } from "@/components/Field";
import { FormError } from "@/components/FormError";
import { FormSection } from "@/components/Panel";
import { TimeRangeSelect } from "@/components/TimeWheelSelect";
import { TimmarVal } from "@/components/TimmarVal";
import { WorkerRows } from "@/components/WorkerRows";
import { formatWeekdayDateSv, projectLabel } from "@/lib/format";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import type { Project, Worker } from "@/lib/types";
import { skapaPass } from "./actions";

/**
 * Steg 2: vad passen ska innehalla.
 *
 * Dagarna ar redan valda i kalendern och kommer hit som en lista. Formularet
 * fylls i EN gang och galler alla — det ar hela vinsten med kalendersteget, och
 * skalet till att dagarna star uppraknade overst: den som fyller i ska se vad
 * hen fyller i FOR.
 *
 * Inget timfalt, precis som forr: ett pass som ska handa har inga arbetade
 * timmar an, och en nolla hade betytt "arbetaren var har och jobbade inte".
 */
export function SkapaPassForm({
  projects,
  workers,
  dagar,
  onTillbaka,
}: {
  projects: Project[];
  workers: Worker[];
  /** Valda dagar, 'YYYY-MM-DD', stigande. */
  dagar: string[];
  onTillbaka: () => void;
}) {
  const { submit, error, pending } = useNavigatingAction(skapaPass);
  const [projectId, setProjectId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [timmar, setTimmar] = useState("");

  return (
    <form action={submit} className="flex flex-col gap-3.5">
      {/* Dagarna foljer med som dolda falt. Kalendern ager valet; det har ar
          bara hur det tar sig till atgarden. */}
      {dagar.map((d) => (
        <input key={d} type="hidden" name="datum" value={d} />
      ))}

      <FormSection title={dagar.length === 1 ? "Vald dag" : `Valda dagar (${dagar.length})`}>
        <div className="flex flex-wrap gap-1.5">
          {dagar.map((d) => (
            <span
              key={d}
              className="rounded-lg bg-night-accent/15 px-2.5 py-1 text-xs font-bold text-night-accent"
            >
              {formatWeekdayDateSv(d)}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onTillbaka}
          className="mt-2.5 text-sm font-bold text-night-accent active:text-night-accent/70"
        >
          ← Andra dagar
        </button>
      </FormSection>

      <FormSection title="Project">
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
          Frivilligt, och samma tider pa alla valda dagar. Tiderna sager nar
          passet ska börja och sluta — arbetaren stamplar anda sina egna.
        </FieldHint>

        <div className="mt-3.5">
          <FieldLabel>Timmar</FieldLabel>
          <TimmarVal
            name="timmar"
            label="Passets betalda timmar"
            value={timmar}
            onChange={setTimmar}
          />
          <FieldHint>
            Timmarna som betalas — inte spannet ovan. Ar en timme obetald rast ar
            07:00–16:00 ett attatimmarspass. Arbetsledaren kan andra siffran nar
            passet bekraftas.
          </FieldHint>
        </div>
      </FormSection>

      <FormSection title="Arbetare">
        <WorkerRows workers={workers} hoursLabel={null} />
        <FieldHint>
          Varje vald arbetare far ett pass per vald dag.
        </FieldHint>
      </FormSection>

      <FormError message={error} />

      <Button type="submit" disabled={pending} glow className="mt-1 w-full">
        {pending
          ? "Skapar…"
          : dagar.length === 1
            ? "Skapa Pass"
            : `Skapa Pass pa ${dagar.length} dagar`}
      </Button>
    </form>
  );
}
