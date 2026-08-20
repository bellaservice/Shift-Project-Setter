"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Plus } from "@/components/Icons";
import { FormSection } from "@/components/Panel";
import { ProjectStartDateField } from "@/components/ProjectStartDateField";
import { ServiceRows } from "@/components/ServiceRows";
import {
  clearProjectDraft,
  forgetProjectDraft,
  getProjectDraft,
  getServerProjectDraft,
  saveProjectDraft,
  subscribeProjectDraft,
  type ProjectFormValues,
} from "@/lib/projectDraft";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import type { ProjectWithDetails, Worker } from "@/lib/types";
import { saveProject } from "./actions";

/** Ett sparat project — eller ingenting alls — som formulärets startvärden. */
function valuesFromProject(project?: ProjectWithDetails): ProjectFormValues {
  return {
    name: project?.name ?? "",
    start_date: project?.start_date ?? "",
    address: project?.address ?? "",
    client_name: project?.client_name ?? "",
    client_address: project?.client_address ?? "",
    client_org_number: project?.client_org_number ?? "",
    client_phone: project?.client_phone ?? "",
    description: project?.description ?? "",
    services: (project?.services ?? []).map((s) => ({
      service_name: s.service_name,
      price: s.price != null ? String(s.price) : "",
    })),
    workerIds: project?.workerIds ?? [],
  };
}

/** ServiceRows räknar i tal; formuläret och utkastet bär samma pris som text. */
function toServiceRows(services: ProjectFormValues["services"]) {
  return services.map((s) => {
    const price = Number(s.price);
    return {
      service_name: s.service_name,
      price: s.price.length > 0 && Number.isFinite(price) ? price : null,
    };
  });
}

export function LoggaProjectForm({
  project,
  workers,
  submitLabel = "Logga Project",
  newWorkerId,
}: {
  project?: ProjectWithDetails;
  workers: Worker[];
  /** "Logga Project" when creating, "Spara Detaljer" when editing. */
  submitLabel?: string;
  /** Arbetaren som just skapades via "+ Lägg Till": bockas i och rullas fram. */
  newWorkerId?: string;
}) {
  const pathname = usePathname();

  // sessionStorage finns inte på servern, så ett utkast kan först finnas efter
  // hydreringen. useSyncExternalStore renderar med serverns tomma svar först
  // och byter sedan till det lästa utkastet, utan att hydreringen krockar.
  const draft = useSyncExternalStore(
    subscribeProjectDraft,
    () => getProjectDraft(pathname),
    getServerProjectDraft
  );

  useEffect(() => () => forgetProjectDraft(pathname), [pathname]);

  return (
    <ProjectFields
      // Fälten är okontrollerade och tar bara upp nya defaultValue om de
      // monteras om, vilket nyckeln ser till att de gör när utkastet dyker upp.
      key={draft ? "utkast" : "sparat"}
      path={pathname}
      projectId={project?.id}
      values={draft ?? valuesFromProject(project)}
      workers={workers}
      submitLabel={submitLabel}
      newWorkerId={newWorkerId}
    />
  );
}

function ProjectFields({
  path,
  projectId,
  values,
  workers,
  submitLabel,
  newWorkerId,
}: {
  path: string;
  projectId?: string;
  values: ProjectFormValues;
  workers: Worker[];
  submitLabel: string;
  newWorkerId?: string;
}) {
  const router = useRouter();

  // Beställarens adress och org.nr hör till beställaren, så de visas först när
  // det finns en beställare att knyta dem till. Ett sparat project som redan
  // har dem öppnar direkt, annars vore de ifyllda men osynliga.
  const [hasBestallare, setHasBestallare] = useState(values.client_name.trim().length > 0);

  const newWorkerRef = useRef<HTMLLabelElement>(null);
  useEffect(() => {
    // Arbetarlistan ligger långt ner i ett långt formulär. Rulla fram raden som
    // just tillkom, så att avstickaren till Ny Arbetare syns ha gett resultat.
    newWorkerRef.current?.scrollIntoView({ block: "center" });
  }, [newWorkerId]);

  const checkedIds = new Set(values.workerIds);
  if (newWorkerId) checkedIds.add(newWorkerId);

  /**
   * Ny Arbetare öppnas mitt i en pågående loggning: spara undan fälten först
   * och tala om vart arbetaren ska lämna tillbaka, så att man kommer tillbaka
   * hit med allt kvar och den nya arbetaren ibockad.
   */
  function goToNyArbetare(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (form) saveProjectDraft(path, form);
    router.push(`/ny-arbetare?next=${encodeURIComponent(path)}`);
  }

  const submit = useNavigatingAction(saveProject);

  return (
    <form
      action={submit}
      // Formuläret är inskickat: utkastet har gjort sitt och ska inte dyka upp
      // igen nästa gång sidan öppnas.
      onSubmit={() => clearProjectDraft(path)}
      className="flex flex-col gap-3.5"
    >
      {projectId && <input type="hidden" name="id" value={projectId} />}

      {/* Fem grupper i stallet for tretton falt pa rad. Grupperna foljer vem
          uppgiften handlar om — projectet, bestallaren, vad som utfors, vilka
          som utfor det — vilket ocksa ar den ordning man far svaren i nar man
          tar emot ett jobb. */}
      <FormSection title="Project">
        <Field label="Project Namn" name="name" required defaultValue={values.name} />
        <ProjectStartDateField defaultValue={values.start_date} />
        <Field label="Project Adress" name="address" required defaultValue={values.address} />
      </FormSection>

      <FormSection
        title="Beställare"
        hint="Bolaget som beställt jobbet. Skrivs ut på Arbetsdagbokens försättsblad."
      >
        <Field
          label="Beställare"
          name="client_name"
          defaultValue={values.client_name}
          onValueChange={(value) => setHasBestallare(value.trim().length > 0)}
        />

        {hasBestallare && (
          /* Ett insjunket kort inuti gruppen: de tva falten hor till
             bestallaren och inte till projectet, och `glass-flat` ar den
             inre ytan — samma material utan egen oskarpa, eftersom det redan
             ligger pa en oskarp panel. */
          <div className="glass-flat flex flex-col gap-3.5 rounded-xl p-3">
            <Field
              label="Bolags Adress"
              name="client_address"
              textarea
              placeholder={"Gatuadress\nPostnr och ort"}
              defaultValue={values.client_address}
            />
            <Field
              label="Org Nummer"
              name="client_org_number"
              placeholder="XXXXXX-XXXX"
              defaultValue={values.client_org_number}
            />
          </div>
        )}

        <Field
          label="Telefon Nummer"
          name="client_phone"
          type="tel"
          defaultValue={values.client_phone}
        />
      </FormSection>

      <FormSection title="Tjänster">
        <ServiceRows initial={toServiceRows(values.services)} />
        <Field label="Beskrivning" name="description" textarea defaultValue={values.description} />
      </FormSection>

      <FormSection
        title="Arbetare"
        action={
          <Button type="button" variant="ghost" size="md" onClick={goToNyArbetare}>
            <Plus className="h-3.5 w-3.5" />
            Lägg Till
          </Button>
        }
      >
        {workers.length === 0 ? (
          <p className="text-sm text-white/55">Inga arbetare registrerade än.</p>
        ) : (
          <div className="glass-flat divide-y divide-night-line overflow-hidden rounded-xl">
            {workers.map((w) => {
              const isNew = w.id === newWorkerId;
              return (
                <label
                  key={w.id}
                  ref={isNew ? newWorkerRef : undefined}
                  /* min-h-12: en kryssruta med ett namn bredvid ar en trafftyta
                     som ska ga att traffa med tummen, inte bara med musen. */
                  className={`flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 text-[15px] transition-colors duration-200 ease-out active:bg-white/10 motion-reduce:transition-none ${
                    isNew ? "bg-night-accent/15 font-bold text-night-accent" : "text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="worker_id"
                    value={w.id}
                    defaultChecked={checkedIds.has(w.id)}
                    className="h-[18px] w-[18px] shrink-0 rounded"
                  />
                  <span className="min-w-0 truncate">{w.name}</span>
                  {/* Den nyss tillagda raden namnger sig sjalv i klartext:
                      accenten ensam sager inte VARFOR raden lyser. */}
                  {isNew && (
                    <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider">
                      Ny
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </FormSection>

      <Button type="submit" className="mt-1 w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
