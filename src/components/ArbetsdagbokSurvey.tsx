"use client";

import Link from "next/link";
import { FormError } from "@/components/FormError";
import { useState } from "react";
import { saveArbetsdagbokDetaljer } from "@/app/arbetsdagbok/actions";
import { Button } from "@/components/Button";
import { FIELD_BOX } from "@/components/Field";
import {
  PassTiderRows,
  usePassProblemRows,
} from "@/components/PassTiderRows";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import type { PassProblem } from "@/lib/types";

/** En fråga i enkäten: vad som saknas, hur den frågas, och vilket fält svaret hamnar i. */
export type SurveyQuestion = {
  /** Fältnamnet `saveArbetsdagbokDetaljer` läser svaret från. */
  name:
    | "name"
    | "client_name"
    | "client_address"
    | "client_org_number"
    | "service_name";
  question: string;
  hint: string;
  placeholder?: string;
  textarea?: boolean;
};

/**
 * Frågas bara när något faktiskt saknas, och bara om det som saknas. Det här är
 * sista chansen att fylla i det innan dokumentet skrivs ut — svaren sparas på
 * projectet respektive passet, så samma fråga ställs inte igen nästa gång.
 *
 * Två sorters fråga, i den ordning dokumentet läses: först försättsbladets
 * uppgifter om projectet, sedan de pass vars Pass Tider-cell skulle bli tom.
 *
 * Varje fråga är ett eget kort med sitt nummer i en accentskiva. Det är den
 * enda skärmen i appen som räknar ner ("2 av 4"), och den räknar för att en
 * enkät utan slut är en enkät man överger.
 *
 * Skärmen kvitterar med EN sak: när sista fältet fått sitt svar och inget pass
 * är olöst tänds knappen längst ner. Inga kort som slår om till grönt på
 * vägen dit — de slocknar bara, ett i taget, tills det enda som lyser på sidan
 * är det man ska trycka på.
 */
export function ArbetsdagbokSurvey({
  projectId,
  projectName,
  questions,
  passProblems,
}: {
  projectId: string;
  /** Projectets namn, som passfrågorna nämner det. */
  projectName: string;
  questions: SurveyQuestion[];
  passProblems: PassProblem[];
}) {
  const { halvifyllda, obesvarade, ...pass } = usePassProblemRows(passProblems);

  // Vilka frågor som fått ett svar. Frågorna spärrar inte submit — ett org.nr
  // som inte finns ska gå att lämna tomt — så det här styr bara om knappen
  // tänds. Därför räcker en mängd med namn i, utan värdena.
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const ready =
    halvifyllda === 0 && obesvarade === 0 && answered.size === questions.length;

  function onAnswer(name: string, value: string) {
    setAnswered((prev) => {
      const has = prev.has(name);
      const filled = value.trim() !== "";
      if (has === filled) return prev;

      const next = new Set(prev);
      if (filled) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  const { submit, error, pending } = useNavigatingAction(saveArbetsdagbokDetaljer);

  return (
    <div className="flex flex-col gap-4">
      <form action={submit} className="flex flex-col gap-3.5">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="pass_count" value={passProblems.length} />

        {questions.map((q, i) => (
          <div key={q.name} className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-night-accent text-xs font-extrabold tabular-nums text-black"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold leading-snug text-white">
                  {/* Numret ar dekor for den som ser det; den som lyssnar far
                      det i klartext i stallet for en losryckt siffra. */}
                  <span className="sr-only">
                    Fråga {i + 1} av {questions.length}:{" "}
                  </span>
                  {q.question}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-white/60">
                  {q.hint}
                </p>
              </div>
            </div>

            {q.textarea ? (
              <textarea
                name={q.name}
                rows={3}
                placeholder={q.placeholder}
                aria-label={q.question}
                onInput={(event) => onAnswer(q.name, event.currentTarget.value)}
                className={`${FIELD_BOX} resize-y leading-relaxed`}
              />
            ) : (
              <input
                name={q.name}
                placeholder={q.placeholder}
                aria-label={q.question}
                onInput={(event) => onAnswer(q.name, event.currentTarget.value)}
                className={FIELD_BOX}
              />
            )}
          </div>
        ))}

        {passProblems.length > 0 && (
          <>
            <div className="px-1 pt-1">
              <h2 className="text-[15px] font-bold text-white">
                {passProblems.length === 1
                  ? "Ett pass saknar Pass Tider"
                  : `${passProblems.length} pass saknar Pass Tider`}
              </h2>
            </div>
            <PassTiderRows
              problems={passProblems}
              projectName={projectName}
              {...pass}
            />
          </>
        )}

        {/* `glow` och inte `disabled`: ett fält som inte går att fylla i får inte
            låsa vägen ut, och det gäller numera passen också — tider som ingen
            minns ska gå att lämna tomma, precis som ett org.nr som inte finns.
            Det ENDA som fortfarande spärrar är ett halvt spann, och det spärrar
            för att databasen avvisar det: shifts_pass_times_paired tar antingen
            båda klockslagen eller inget. Allt annat skärmen har att säga om hur
            långt man kommit säger den med ljus. */}
        <FormError message={error} />

        <Button
          type="submit"
          disabled={halvifyllda > 0 || pending}
          glow={ready}
          className="mt-1 w-full"
        >
          {pending ? "Sparar…" : "Spara och generera"}
        </Button>
      </form>

      {/* Utvägen för uppgifter som helt enkelt inte finns — beställaren kanske
          saknar org.nr, och ett pass kanske är loggat precis som det ska.
          Dokumentet utelämnar då raden, precis som DocMaker gör när dess
          kryssruta är av. Ingenting av det som fyllts i ovan sparas.

          En riktig 44px-knapp och inte en understruken rad text: den ar den
          enda vagen forbi en enkat som inte gar att svara pa, och den ska ga
          att traffa med tummen. Tyst yta, dock — den hoppar over ett steg. */}
      <Link
        href={`/arbetsdagbok?id=${projectId}&fortsatt=1`}
        className="flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-white/70 underline decoration-white/30 underline-offset-4 transition-colors duration-200 ease-out active:text-white motion-reduce:transition-none"
      >
        Generera utan dessa uppgifter
      </Link>
    </div>
  );
}
