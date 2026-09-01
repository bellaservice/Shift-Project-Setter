"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Arbetsdagbok } from "@/components/Arbetsdagbok";
import { DokumentVy } from "@/components/DokumentVy";
import { Button, ButtonLink } from "@/components/Button";
import { Warning } from "@/components/Icons";
import { PanelSkeleton, Query } from "@/components/Query";
import { PanelList, RowLink } from "@/components/Panel";
import { projectLabel } from "@/lib/format";
import { EmptyState, Screen } from "@/components/Screen";
import {
  ArbetsdagbokSurvey,
  type SurveyQuestion,
} from "@/components/ArbetsdagbokSurvey";
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
import { PeriodVal } from "@/components/PeriodVal";
import {
  getArbetsdagbokData,
  getPassProblems,
  getProjectDagSpann,
  getProjects,
  getSenastePeriod,
  sparaPeriod,
} from "@/lib/queries";
import { addDays, stockholmToday } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { ArbetsdagbokData } from "@/lib/types";
import { useQuery } from "@/lib/useQuery";

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

/**
 * Lag pa /alla-project/[id]/arbetsdagbok; id:t ar numera `?id=`, se noteringen
 * i /alla-arbetare/redigera.
 */
export default function ArbetsdagbokPage() {
  return (
    <Suspense fallback={<Laddar />}>
      <ArbetsdagbokScreen />
    </Suspense>
  );
}

function Laddar() {
  return (
    <Screen
      tone="amber"
      eyebrow="Arbetsdagbok"
      title="Arbetsdagbok"
      back={{ href: "/alla-project", label: "Alla Project" }}
    >
      <PanelSkeleton />
    </Screen>
  );
}

function ArbetsdagbokScreen() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  // `fortsatt` is what the survey sets on its way out, both when it saved
  // answers and when the user chose to generate without them. Without it the
  // survey would reappear forever for a field the client genuinely does not
  // have, or a pass whose span really is longer than its paid hours.
  const fortsatt = params.get("fortsatt");

  const { session } = useAuth();

  /**
   * Ramen dokumentet ska tacka. Null tills utgangslaget rakats fram nedan --
   * dokumentet hamtas inte forran det ar gjort, eftersom en forsta hamtning
   * utan ram hade dragit hem hela projectets historik bara for att kastas.
   */
  const [ram, setRam] = useState<{ fran: string; till: string } | null>(null);
  /* Har utskriftsdialogen varit uppe? Sager inte att nagot sparades -- se
     ramkvittensen langre ned. */
  /**
   * Vilken halva som visas.
   *
   * Pa en telefon far bara en av dem plats: uppgifterna ar ett formular och
   * dokumentet ar ett A4, och staplade pa varandra hamnar papperet en
   * skarmlangd under kontrollerna som styr det -- man andrar ramen och ser inte
   * vad som hande. Fran 1100px och upp star de sida vid sida i stallet och
   * vaxeln goms, eftersom valet da inte finns att gora.
   */
  const [flik, setFlik] = useState<"detaljer" | "dokument">("detaljer");
  const [dialogenVarUppe, setDialogenVarUppe] = useState(false);
  const [ramSparad, setRamSparad] = useState(false);

  /* Vad forra dokumentet tackte, och vilka dagar projectet overhuvudtaget har.
     Bada behovs for att kunna foresla en ram, sa de hamtas tillsammans. */
  const utgangslage = useQuery(async () => {
    if (!id) return null;
    const [senaste, spann] = await Promise.all([
      getSenastePeriod(id),
      getProjectDagSpann(id),
    ]);
    return { senaste, spann };
  }, [id]);

  /**
   * Forslaget, en gang: dar forra dokumentet slutade fram till sista arbetade
   * dagen.
   *
   * Dagen EFTER forra ramens slut, inte samma dag: ett dokument som borjar dar
   * det forra slutade skulle ta med den dagen tva ganger, och en dubbelfakturerad
   * dag ar ett varre fel an en utelamnad -- den forsta upptacks av kunden.
   *
   * Har projectet aldrig skrivits ut borjar ramen pa dess forsta arbetade dag,
   * sa att ingenting ligger fore ramen fran allra forsta borjan.
   */
  useEffect(() => {
    if (ram !== null || utgangslage.data == null) return;
    const { senaste, spann } = utgangslage.data;
    const idag = stockholmToday();
    setRam({
      fran: senaste ? addDays(senaste.till, 1) : (spann?.forsta ?? idag),
      till: spann?.sista ?? idag,
    });
  }, [ram, utgangslage.data]);

  /* Projectlistan for valjaren nedan. Hamtas aven nar ett project redan ar
     valt: en krok far inte hoppas over, och listan ar en handfull rader. */
  const projectLista = useQuery(() => getProjects(), []);

  const bundle = useQuery(async () => {
    if (!id || ram === null) return null;
    const [data, passProblems] = await Promise.all([
      getArbetsdagbokData(id, ram),
      getPassProblems(id),
    ]);
    return data === null ? null : { data, passProblems };
  }, [id, ram?.fran, ram?.till]);

  // Obekraftade pass ar en HARD sparr, inte en fraga. Spec avsnitt 7 gor
  // dokumentet omojligt att skapa forran arbetsledaren bekraftat allt i
  // intervallet -- det ar hela dokumentets syfte som pATryckningsmedel. Darfor
  // star den utanfor `fortsatt`-undantaget: det finns for uppgifter kunden
  // genuint inte har (ett org-nummer ingen minns), och ett obekraftat pass ar
  // inte en sadan uppgift. Det loser sig, och tills dess far dokumentet vanta.
  const obekraftade = bundle.data?.data.obekraftade ?? 0;

  // Grinden avgors av det som lastes, sa den kan inte stallas forran svaret ar
  // har. Fore det ar `bundle.data` undefined och <Query> ritar skelettet.
  const gated =
    bundle.data != null &&
    (obekraftade > 0 ||
      ((missingQuestions(bundle.data.data).length > 0 ||
        bundle.data.passProblems.length > 0) &&
        fortsatt !== "1"));

  /**
   * Ingen ?id= — alltsa kom man hit via menyn och inte via ett project.
   *
   * Skarmen var fram till nu en atergrand fran Alla Project och kunde forutsatta
   * att den fick ett project med sig. Som egen destination maste den i stallet
   * FRAGA, annars mots den som trycker "Arbetsdagbok" i menyn av "Projectet
   * finns inte" — ett felmeddelande om ett project hen aldrig valt.
   */
  if (!id) {
    return (
      <Screen
        tone="amber"
        eyebrow="Arbetsdagbok"
        title="Vilket project?"
        back={{ href: "/", label: "Hem" }}
      >
        <p className="mb-3 px-1 text-sm leading-relaxed text-white/65">
          Dokumentet skrivs ut per project. Välj vilket, så ställs perioden in
          därefter.
        </p>
        <Query state={projectLista}>
          {(projects) =>
            projects.length === 0 ? (
              <EmptyState
                title="Inga project än."
                hint="Ett project är det arbetet loggas på. Lägg upp ett först."
                action={
                  <ButtonLink href="/logga-project" size="md">
                    Logga Project
                  </ButtonLink>
                }
              />
            ) : (
              <PanelList>
                {projects.map((p) => (
                  <RowLink
                    key={p.id}
                    href={`/arbetsdagbok?id=${p.id}`}
                    title={projectLabel(p)}
                    subtitle={p.name ? p.address : undefined}
                  />
                ))}
              </PanelList>
            )
          }
        </Query>
      </Screen>
    );
  }

  if (bundle.data == null || gated) {
    return (
      // `amber` och inte `ember`. Skarmen ar en grind fore dokumentet, sa den
      // bar Arbetsdagboken i ogonbrynet men inte dess namn i rubriken — men
      // rott ljus over den sa fel, och det ar inte vad det har ar. Ingenting ar
      // trasigt; det ar bara nagra uppgifter kvar att fylla i, alltsa exakt
      // samma sorts skarm som Logga Project och Logga Timmar, och den ska sta
      // under samma gula lampa som de gor.
      <Screen
        tone="amber"
        eyebrow={
          bundle.data
            ? `Arbetsdagbok · ${bundle.data.data.projectName}`
            : "Arbetsdagbok"
        }
        title="Innan dokumentet skapas"
        back={{ href: "/alla-project", label: "Alla Project" }}
      >
        <Query state={bundle}>
          {(loaded) =>
            loaded === null ? (
              <EmptyState
                title="Projectet finns inte."
                hint="Det kan ha tagits bort. Kolla i Papperskorgen om det ska tillbaka."
                action={
                  <ButtonLink href="/alla-project" size="md">
                    Alla Project
                  </ButtonLink>
                }
              />
            ) : loaded.data.obekraftade > 0 ? (
              /* Ingen enkat och ingen "skapa anda"-utvag: det finns ingenting
                 for anvandaren att fylla i har. Passen bekraftas i
                 bekraftelsekon, och dokumentet oppnar sig sjalvt nar de ar det. */
              <EmptyState
                title={
                  loaded.data.obekraftade === 1
                    ? "Ett pass ar inte bekraftat an."
                    : `${loaded.data.obekraftade} pass ar inte bekraftade an.`
                }
                hint="Arbetsdagboken ar det juridiska underlaget for arbetad tid, sa den skapas forst nar varje pass i projectet har ett bekraftat timtal. Bekrafta passen sa oppnar sig dokumentet har."
                action={
                  <ButtonLink href="/alla-project" size="md">
                    Alla Project
                  </ButtonLink>
                }
              />
            ) : (
              <ArbetsdagbokSurvey
                projectId={id}
                projectName={loaded.data.projectName}
                questions={missingQuestions(loaded.data)}
                passProblems={loaded.passProblems}
              />
            )
          }
        </Query>
      </Screen>
    );
  }

  const { data } = bundle.data;

  return (
    /* `wide` och `tone="none"`: harifran och ner ar sidan ett vitt A4-ark, det
       ljusaste appen nagonsin visar. Ett glod bakom det skulle bara konkurrera
       med papperet, och forhandsvisningen behover hela skalets bredd for att
       inte klippas pa hojden av en sida den aldrig far se.

       `ad-noprint` pa allt utom dokumentet: knapparna ska inte folja med in i
       PDF:en, och nu ar det webblasarens egen utskrift som laser den regeln —
       samma stilmall, samma resultat, utan server. */
    <Screen
      tone="none"
      eyebrow="Arbetsdagbok"
      title={data.projectName}
      back={{ href: "/arbetsdagbok", label: "Byt project" }}
      wide
    >
      {/* Vaxeln. `xl:hidden` -- fran 1100px ryms bada och da ar den bara i
          vagen. `ad-noprint` som allt annat som inte ar papper. */}
      <div className="ad-noprint mx-auto mb-3 w-full max-w-md xl:hidden">
        <div className="glass-flat flex gap-1 rounded-xl p-1">
          <FlikKnapp
            aktiv={flik === "detaljer"}
            onClick={() => setFlik("detaljer")}
            label="Detaljer"
          />
          <FlikKnapp
            aktiv={flik === "dokument"}
            onClick={() => setFlik("dokument")}
            label="Dokument"
          />
        </div>
      </div>

      {/* INGEN `items-start` i kolumnlaget.

          `items-start` far ett flexbarn att bli sa brett som dess INNEHALL i
          stallet for sa brett som raden. DokumentVy mater sin egen ruta -- och
          den rutan krympte da till det redan nedskalade arket, vilket gav en
          mindre bredd, som gav en mindre skala, som gav en mindre bredd. Det
          slutade omkring 150px pa en 390px-skarm: ett laslighetsproblem som
          uppstod ur en matning som atit sitt eget resultat.

          Utan den stracker sig kolumnen over hela bredden och matningen har
          nagot fast att utga fran. `items-start` finns kvar i radlaget, dar den
          gor det den ska: hindrar detaljkolumnen fran att bli lika hog som
          dokumentet bredvid. */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-center">
      <div
        className={`ad-noprint w-full max-w-md shrink-0 flex-col gap-3 xl:flex ${
          flik === "detaljer" ? "flex" : "hidden"
        }`}
      >
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
                  Lägg ett snabbpass på projectet
                </Link>{" "}
                först om dokumentet ska innehålla rader.
              </p>
            </div>
          </div>
        )}

        {/* Ramen star OVER knappen: vilka dagar som kommer med avgors innan
            dokumentet skrivs ut, inte efterat. */}
        {ram && (
          <PeriodVal
            fran={ram.fran}
            till={ram.till}
            onFran={(fran) => setRam({ fran, till: ram.till })}
            onTill={(till) => setRam({ fran: ram.fran, till })}
            senaste={utgangslage.data?.senaste ?? null}
          />
        )}

        {/* Ramen skrivs upp nar dokumentet faktiskt skapas, inte nar den valjs:
            en ram man provade sig fram till och andrade sig om ar ingen
            utskrift, och skulle annars lura nasta utskrift att hoppa over dagar
            som aldrig kom med nagonstans. */}
        <DownloadPdfButton onPrinted={() => setDialogenVarUppe(true)} />

        {/* Ramkvittensen.

            Den fragar i stallet for att gissa, och det ar avsiktligt.
            Webblasaren skiljer inte pa "sparade PDF:en" och "avbrot dialogen",
            sa en ram som bokfordes automatiskt hade kunnat markera dagar som
            utskrivna fast dokumentet aldrig blev till. Nasta utskrift hade da
            borjat efter dem, och de dagarna hade aldrig kommit med nagonstans
            -- exakt det fel hela ramminnet finns for att forhindra.

            Ett extra tryck ar ett lagt pris for att raden alltid ar sann. */}
        {dialogenVarUppe && ram && (
          <div className="rounded-2xl border border-night-accent/40 bg-night-accent/10 p-4">
            {ramSparad ? (
              <p className="text-sm font-bold text-night-accent">
                Ramen ar noterad. Nasta dokument foreslas borja dagen efter.
              </p>
            ) : (
              <>
                <p className="text-sm font-bold text-white">
                  Blev dokumentet sparat?
                </p>
                <p className="mt-1 text-xs leading-relaxed text-white/70">
                  Da skriver vi upp ramen, sa nasta Arbetsdagbok foreslas borja
                  dagen efter. Avbrot du utskriften ska du lamna den har.
                </p>
                <Button
                  type="button"
                  size="md"
                  className="mt-3 w-full"
                  onClick={async () => {
                    if (!id) return;
                    await sparaPeriod(id, ram.fran, ram.till, session?.user.id ?? null);
                    setRamSparad(true);
                  }}
                >
                  Ja, notera ramen
                </Button>
              </>
            )}
          </div>
        )}
        <p className="px-1 text-xs leading-relaxed text-white/55">
          Välj <strong className="font-bold">Spara som PDF</strong> som
          destination i dialogen. Förhandsvisningen nedan är arken som hamnar i
          filen, i samma ordning och med samma sidbrytning.
        </p>
      </div>

      {/* Dokumentet.

          `min-w-0` pa flexbarnet: utan den vagrar en flexkolumn krympa under
          sitt innehalls naturliga bredd, och arket ar 794px brett -- alltsa
          skulle DokumentVy mata en bredd som aldrig blev mindre an papperet och
          aldrig krympa det. */}
      <div
        className={`w-full min-w-0 xl:block ${flik === "dokument" ? "block" : "hidden"}`}
      >
        <DokumentVy>
          <Arbetsdagbok data={data} />
        </DokumentVy>
      </div>
      </div>
    </Screen>
  );
}

/**
 * En halva av vaxeln. Samma form som "Arbetare / Ej arbetare" i Tillverka
 * Konto -- tva lagen som utesluter varandra och bada ryms pa en rad.
 */
function FlikKnapp({
  aktiv,
  onClick,
  label,
}: {
  aktiv: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktiv}
      className={`h-11 flex-1 cursor-pointer rounded-lg text-sm font-bold transition-colors duration-200 ease-out motion-reduce:transition-none ${
        aktiv ? "bg-night-accent text-black" : "text-white/60 active:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
