"use client";

import { KontoList } from "@/components/KontoList";
import { Query } from "@/components/Query";
import { getKonton } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";

/**
 * Hamtningen, bruten ut ur sidan.
 *
 * Sidan bredvid ar medvetet kvar som en serverkomponent, eftersom den ar det
 * enda stallet dar `export const metadata` far sta -- en klientkomponent kan
 * inte exportera den, och sidans titel ar varken data eller interaktion. Den
 * ratta uppdelningen ar darfor inte "sidan blir klient" utan "det som laser ur
 * databasen blir klient", och det ar precis den gransen som gar har.
 *
 * Vad Next gor med det: ramen ovanfor skrivs ut till HTML vid bygget, den har
 * filen skickas som JavaScript, och listan fylls i nar svaret kommer.
 */
export function KontoLista() {
  const konton = useQuery(() => getKonton(), []);

  return (
    <Query state={konton}>{(data) => <KontoList konton={data} />}</Query>
  );
}
