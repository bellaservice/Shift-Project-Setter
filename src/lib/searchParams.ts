/**
 * En query-parameter som en strang. Next ger en array nar samma nyckel kommer
 * flera ganger (`?ny=a&ny=b`), och den formen har ingen av sidorna nagon mening
 * for -- da ar parametern lika gott som osatt.
 */
export function firstParam(value: string | string[] | null | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * En intern retursida ur `?next=`. Parametern kommer fran adressfaltet och far
 * darfor bara peka inom appen: en absolut adress (`https://...`) eller en
 * protokollrelativ (`//`) skulle gora bade Tillbaka-pilen och omdirigeringen
 * efter sparandet till en vag ut ur appen.
 *
 * Query och fragment skalas bort -- anroparen bygger sjalv den adress som ska
 * besokas, och slipper gissa om det redan sitter ett `?` pa slutet.
 */
export function internalPath(value: string | string[] | null | undefined): string | undefined {
  const path = firstParam(value);
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return undefined;
  }
  return path.split(/[?#]/)[0];
}
