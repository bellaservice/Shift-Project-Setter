import Link from "next/link";
import { notFound } from "next/navigation";
import { Arbetsdagbok } from "@/components/Arbetsdagbok";
import { Warning } from "@/components/Icons";
import { Screen } from "@/components/Screen";
import {
  ArbetsdagbokSurvey,
  type SurveyQuestion,
} from "@/components/ArbetsdagbokSurvey";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { getArbetsdagbokData, getPassProblems } from "@/lib/queries";
import type { ArbetsdagbokData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Which of the optional project fields the document would otherwise print empty.
 *
 * Only the project’s own fields — one answer, one cover page. The passes are
 * asked about separately by `getPassProblems`, because there is one of those per
 * day worked and they are corrected row by row.
 */
function missingQuestions(data: ArbetsdagbokData): SurveyQuestion[] {
  const questions: SurveyQuestion[] = [];

  if (!data.hasName) {
    questions.push({
      name: "name",
      question: "Vad heter projectet?",
      hint: 'Skrivs ut på försättsbladets rad "Project".',
      placeholder: "Projectnamn",
    });
  }

  if (!data.bestallare.bolag) {
    questions.push({
      name: "client_name",
      question: "Vilket bolag är beställare?",
      hint: 'Skrivs ut som "Bolag" under Beställare.',
      placeholder: "Företagsnamn",
    });
  }

  if (!data.bestallare.adress) {
    questions.push({
      name: "client_address",
      question: "Vilken adress har beställaren?",
      hint: "Beställarens egen adress — inte arbetsplatsens.",
      placeholder: "Gatuadress\nPostnr och ort",
      textarea: true,
    });
  }

  if (!data.bestallare.orgnr) {
    questions.push({
      name: "client_org_number",
      question: "Vad är beställarens organisationsnummer?",
      hint: 'Skrivs ut som "Org nummer" under Beställare.',
      placeholder: "XXXXXX-XXXX",
    });
  }

  if (!data.tjanst) {
    questions.push({
      name: "service_name",
      question: "Vilken tjänst utfördes?",
      hint: 'Fyller kolumnen "Tjänst" på varje rad i dagtabellerna.',
      placeholder: "t.ex. Byggstädning",
    });
  }

  return questions;
}

export default async function ArbetsdagbokPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fortsatt?: string }>;
}) {
  const [{ id }, { fortsatt }] = await Promise.all([params, searchParams]);

  const [data, passProblems] = await Promise.all([
    getArbetsdagbokData(id),
    getPassProblems(id),
  ]);
  if (!data) notFound();

  const questions = missingQuestions(data);

  // `fortsatt` is what the survey sets on its way out, both when it saved
  // answers and when the user chose to generate without them. Without it the
  // survey would reappear forever for a field the client genuinely does not
  // have, or a pass whose span really is longer than its paid hours.
  if ((questions.length > 0 || passProblems.length > 0) && fortsatt !== "1") {
    return (
      // `amber` och inte `ember`. Skarmen ar en grind fore dokumentet, sa den
      // bar Arbetsdagboken i ogonbrynet men inte dess namn i rubriken — men
      // rott ljus over den sa fel, och det ar inte vad det har ar. Ingenting ar
      // trasigt; det ar bara nagra uppgifter kvar att fylla i, alltsa exakt
      // samma sorts skarm som Logga Project och Logga Timmar, och den ska sta
      // under samma gula lampa som de gor.
      <Screen
        tone="amber"
        eyebrow={`Arbetsdagbok · ${data.projectName}`}
        title="Innan dokumentet skapas"
        back={{ href: "/alla-project", label: "Alla Project" }}
      >
        <ArbetsdagbokSurvey
          projectId={id}
          questions={questions}
          passProblems={passProblems}
        />
      </Screen>
    );
  }

  return (
    /* `wide` och `tone="none"`: harifran och ner ar sidan ett vitt A4-ark, det
       ljusaste appen nagonsin visar. Ett glod bakom det skulle bara konkurrera
       med papperet, och forhandsvisningen behover hela skalets bredd for att
       inte klippas pa hojden av en sida den aldrig far se.

       `ad-noprint` pa allt utom dokumentet: knapparna ska inte folja med in i
       PDF:en som Chrome renderar ur precis den har sidan. */
    <Screen
      tone="none"
      eyebrow="Arbetsdagbok"
      title={data.projectName}
      back={{ href: "/alla-project", label: "Alla Project" }}
      wide
    >
      <div className="ad-noprint mx-auto flex w-full max-w-md flex-col gap-3">
        {/* Ett project utan pass ger ett dokument utan rader. Det är giltigt —
            försättsbladet och signaturblocket står där — men det ser ut som ett
            fel om ingen säger varför, så det sags här och inte bara i dokumentet. */}
        {data.days.length === 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-night-accent/40 bg-night-accent/10 p-4">
            <Warning className="mt-0.5 h-5 w-5 shrink-0 text-night-accent" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-night-accent">
                Det här projectet har inga loggade pass.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                Dagtabellerna blir tomma och Ordinarie tid blir 0h.{" "}
                <Link
                  href={`/logga-timmar?project=${id}`}
                  className="font-bold text-night-accent underline underline-offset-2"
                >
                  Logga timmar på projectet
                </Link>{" "}
                först om dokumentet ska innehålla rader.
              </p>
            </div>
          </div>
        )}

        <DownloadPdfButton projectId={id} />
        <p className="px-1 text-xs leading-relaxed text-white/55">
          Filen sparas i din nedladdningsmapp. Förhandsvisningen nedan är arken
          som hamnar i den, i samma ordning och med samma sidbrytning.
        </p>
      </div>

      <Arbetsdagbok data={data} />
    </Screen>
  );
}
