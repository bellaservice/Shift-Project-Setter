import { getArbetsdagbokData } from "@/lib/queries";
import { ChromeMissingError, renderPageToPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
// Launching a browser is not something the Edge runtime can do.
export const runtime = "nodejs";

/** Filnamnssäker variant av en fritextsträng: 'Kv. Björken 3' -> 'Kv_Bjorken_3'. */
function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      // Kombinerande diakriter — å/ä/ö blir a/a/o, som Windows och macOS båda
      // klarar oavsett teckenkodning i nedladdningsmappen.
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "Project"
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const data = await getArbetsdagbokData(id);
  if (!data) {
    return new Response("Projectet finns inte", { status: 404 });
  }

  // Chrome renders the very same page the preview shows, fetched over HTTP from
  // this server — so the file can never drift from what was on screen.
  // `fortsatt=1` because the survey has already had its turn by the time this
  // route is reachable; without it Chrome would print the questionnaire.
  const origin = new URL(request.url).origin;
  const pageUrl = `${origin}/alla-project/${id}/arbetsdagbok?fortsatt=1`;

  let pdf: Uint8Array;
  try {
    pdf = await renderPageToPdf(pageUrl);
  } catch (error) {
    const status = error instanceof ChromeMissingError ? 501 : 500;
    const message =
      error instanceof Error ? error.message : "Okänt fel vid PDF-skapande";
    return new Response(message, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Same shape as DocMaker's suggested name, with the project in it because
  // these are generated per project rather than per sitting.
  const firstDay = data.days[0]?.date;
  const stamp =
    firstDay ??
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(
      new Date()
    );
  const filename = `Arbetsdagbok_${slugify(data.projectName)}_${stamp}.pdf`;

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      // `attachment` is what makes the browser download it rather than open a
      // viewer. filename* carries the UTF-8 form for browsers that read it;
      // filename is the ASCII fallback for those that do not.
      "Content-Disposition":
        `attachment; filename="${filename}"; ` +
        `filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
