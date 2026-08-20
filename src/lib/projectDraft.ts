/**
 * Ett halvifyllt Logga Project-formulär som överlever avstickaren till Ny
 * Arbetare. Trycker man "+ Lägg Till" bredvid Arbetare mitt i en loggning
 * sparas fälten här först, och när sidan öppnas igen läses de tillbaka — utan
 * det skulle vägen till en ny arbetare kosta allt man redan hunnit skriva in.
 *
 * sessionStorage och inte localStorage: utkastet hör till den här fliken och
 * det här ärendet, inte till webbläsaren i evighet.
 *
 * Utkastet läses genom useSyncExternalStore, så modulen håller en liten cache:
 * getProjectDraft måste ge tillbaka *samma* objekt varje gång React frågar,
 * annars ser React en ny snapshot vid varje rendering och renderar i evighet.
 * Cachen töms när formuläret lämnar sidan (forgetProjectDraft), så nästa
 * montering läser lagringen på nytt.
 */

/** Formulärets fält som text, i samma form som de skickas in. */
export type ProjectFormValues = {
  name: string;
  start_date: string;
  address: string;
  client_name: string;
  client_address: string;
  client_org_number: string;
  client_phone: string;
  description: string;
  /** Priset som råtext ("1200.50"), precis som det dolda pris-fältet skickar det. */
  services: { service_name: string; price: string }[];
  workerIds: string[];
};

type StoredDraft = ProjectFormValues & { savedAt: number };

const PREFIX = "shift-setter:project-draft:";

/** Utkastet är till för en avstickare, inte för att väcka ett formulär till liv en timme senare. */
const MAX_AGE_MS = 30 * 60 * 1000;

const cache = new Map<string, ProjectFormValues | null>();

function storageKey(path: string): string {
  return `${PREFIX}${path}`;
}

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Sparar undan formulärets nuvarande innehåll. Läses ur DOM:en i stället för ur
 * React-state eftersom fälten är okontrollerade — samma FormData som submit
 * hade skickat, så inget fält kan glömmas bort här utan att också saknas där.
 */
export function saveProjectDraft(path: string, form: HTMLFormElement): void {
  const data = new FormData(form);
  // service_name och price kommer parvis i samma ordning som raderna i
  // ServiceRows, precis som saveProject parar ihop dem på servern.
  const serviceNames = data.getAll("service_name").map(String);
  const prices = data.getAll("price").map(String);

  const draft: StoredDraft = {
    name: text(data, "name"),
    start_date: text(data, "start_date"),
    address: text(data, "address"),
    client_name: text(data, "client_name"),
    client_address: text(data, "client_address"),
    client_org_number: text(data, "client_org_number"),
    client_phone: text(data, "client_phone"),
    description: text(data, "description"),
    services: serviceNames.map((service_name, i) => ({
      service_name,
      price: prices[i] ?? "",
    })),
    workerIds: data.getAll("worker_id").map(String),
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(storageKey(path), JSON.stringify(draft));
  } catch {
    // Full eller avstängd lagring: då får utkastet gå förlorat i stället för
    // att knäcka knappen som skulle ta användaren till Ny Arbetare.
  }
}

function readProjectDraft(path: string): ProjectFormValues | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(storageKey(path));
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const draft = parsed as Partial<StoredDraft>;
  if (typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > MAX_AGE_MS) return null;
  if (!Array.isArray(draft.services) || !Array.isArray(draft.workerIds)) return null;

  return {
    name: draft.name ?? "",
    start_date: draft.start_date ?? "",
    address: draft.address ?? "",
    client_name: draft.client_name ?? "",
    client_address: draft.client_address ?? "",
    client_org_number: draft.client_org_number ?? "",
    client_phone: draft.client_phone ?? "",
    description: draft.description ?? "",
    services: draft.services.map((s) => ({
      service_name: String(s?.service_name ?? ""),
      price: String(s?.price ?? ""),
    })),
    workerIds: draft.workerIds.map(String),
  };
}

/** Utkastet för sidan, oförändrat så länge formuläret är monterat. */
export function getProjectDraft(path: string): ProjectFormValues | null {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;

  const draft = readProjectDraft(path);
  cache.set(path, draft);
  return draft;
}

/** På servern finns inget utkast — det är först efter hydreringen det kan dyka upp. */
export function getServerProjectDraft(): null {
  return null;
}

/**
 * Utkastet skrivs bara när sidan lämnas och läses bara när den öppnas, så det
 * kan aldrig ändras mitt under att formuläret står framme. Prenumerationen
 * finns för useSyncExternalStores skull och har därför inget att lyssna på.
 */
export function subscribeProjectDraft(): () => void {
  return () => {};
}

/** Glömmer den lästa kopian, så att nästa montering läser lagringen på nytt. */
export function forgetProjectDraft(path: string): void {
  cache.delete(path);
}

/** Slänger utkastet, t.ex. när formuläret väl har skickats in. */
export function clearProjectDraft(path: string): void {
  try {
    sessionStorage.removeItem(storageKey(path));
  } catch {
    // Se saveProjectDraft.
  }
}
