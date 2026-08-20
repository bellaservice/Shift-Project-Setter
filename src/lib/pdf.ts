import "server-only";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

/**
 * Renders one of the app's own pages to a PDF, server side, so pressing the
 * button downloads a file instead of opening a print dialog.
 *
 * `puppeteer-core`, not `puppeteer`: the full package downloads its own ~300MB
 * Chromium at install time. This one drives a Chrome that is already on the
 * machine, which is the same engine the layout was designed against — the
 * document's own `@page` rules decide the paper, so the file is byte-for-byte
 * what the browser's own "Spara som PDF" would have produced.
 */

/** Set CHROME_PATH in .env.local to override the search below. */
const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
];

export class ChromeMissingError extends Error {
  constructor() {
    super(
      "Hittade ingen Chrome eller Edge att skapa PDF:en med. " +
        "Installera Chrome, eller peka ut den med CHROME_PATH i .env.local."
    );
    this.name = "ChromeMissingError";
  }
}

function findChrome(): string {
  const configured = process.env.CHROME_PATH;
  if (configured) {
    if (!existsSync(configured)) throw new ChromeMissingError();
    return configured;
  }

  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new ChromeMissingError();
  return found;
}

export async function renderPageToPdf(url: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    // The app can run as a service account or in a container; without this,
    // Chrome refuses to start as root and the download fails with a stack
    // trace instead of a document.
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    const response = await page.goto(url, {
      // The page is a Server Component with no client data fetching, but the
      // logo still has to land before the paper is measured.
      waitUntil: "networkidle0",
      timeout: 30_000,
    });

    if (!response || !response.ok()) {
      throw new Error(
        `Kunde inte ladda dokumentsidan (${response?.status() ?? "inget svar"})`
      );
    }

    return await page.pdf({
      printBackground: true,
      // The document's own @page rule owns the paper size and every margin.
      // Without this puppeteer silently applies its own 1cm margins on top,
      // and the footer that the tfoot places in the bottom margin gets pushed
      // off the sheet.
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}
