import { supabase } from "@/lib/supabase/browser";
import { optionalString } from "@/lib/formData";

/**
 * Arbetaren fyller i sina egna uppgifter.
 *
 * Skilt fran saveWorker, som ar arbetsledarens formular och skriver hela raden
 * inklusive namn och e-post. Den har skriver EXAKT de kolumner arbetaren far
 * rora, och listan star utskriven nedan i stallet for att komma ur ett
 * formulars falt: ett falt som nagon lagger till i JSX:en ska inte tyst bli en
 * kolumn till som gar att skriva.
 *
 * ⚠️ Namn och e-post ar INTE med, och det ar tva sparrar och inte en. Den har
 * skickar dem aldrig, och kit.workers_guard_egna_uppgifter() avvisar dem om de
 * anda skulle komma — fran den har filen, fran ett annat anrop, eller fran
 * nagon som pratar med PostgREST direkt. Den forsta ar artighet; den andra ar
 * grinden. Se 20260901090000_egna_uppgifter.sql.
 *
 * E-posten ar dessutom inloggningen och star i bade auth.users och workers. Att
 * andra den pa ett stalle och inte det andra later kontot se helt normalt ut
 * anda tills nagon forsoker logga in.
 */
export async function sparaEgnaUppgifter(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Uppgifterna hor inte till nagon arbetare.");

  const patch = {
    phone: optionalString(formData.get("phone")),
    address: optionalString(formData.get("address")),
    personal_number: optionalString(formData.get("personal_number")),
    account_number: optionalString(formData.get("account_number")),
    emergency_contact_name: optionalString(formData.get("emergency_contact_name")),
    emergency_contact_phone: optionalString(formData.get("emergency_contact_phone")),
    emergency_contact_email: optionalString(formData.get("emergency_contact_email")),
  };

  /**
   * `.select()` ar inte till for datan. Den ar till for att MARKA att inget hande.
   *
   * En UPDATE som RLS filtrerar bort ar inte ett fel for PostgREST -- den
   * traffar noll rader och lyckas. Utan raden nedan svarade den har funktionen
   * "sparat" pa en skrivning som aldrig skedde, skarmen skrev "Sparat." och
   * arbetaren gick darifran i tron att kontonumret fanns. Det uppdagades i ett
   * test som laste tillbaka kolumnen efterat; skarmen sag felfri ut.
   *
   * Med `.select()` kommer de andrade raderna tillbaka, och noll rader gar att
   * skilja fran en rad.
   */
  const { data, error } = await supabase
    .from("workers")
    .update(patch)
    .eq("id", id)
    .select("id");

  if (error) {
    // Vaktens meddelanden ar redan skrivna pa svenska och riktade till
    // arbetaren -- "Du kan inte andra ditt namn", inte ett policynamn. Skicka
    // dem vidare orörda i stallet for att svepa in dem i ett eget.
    throw new Error(error.message, { cause: error });
  }

  if ((data ?? []).length === 0) {
    throw new Error(
      "Uppgifterna sparades inte — databasen slappte inte igenom skrivningen. " +
        "Sag till din arbetsledare; det ar troligen en rattighet som saknas."
    );
  }
}
