export function optionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requiredString(value: FormDataEntryValue | null, fieldLabel: string): string {
  const s = optionalString(value);
  if (!s) throw new Error(`${fieldLabel} kravs`);
  return s;
}
