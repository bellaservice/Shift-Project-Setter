import Link from "next/link";
import { ChevronLeft } from "@/components/Icons";

/**
 * Vagen tillbaka, som en glaspille i samma material som hamburgaren och kuggen
 * bredvid den — den ar en av tre knappar pa samma rad och ska darfor se ut som
 * de tva andra, inte som en lank i brodtext.
 *
 * 44px hog, precis som de: det ar golvet for en trafftyta, och den gamla
 * textlanken (~20px) lag under det.
 */
export function BackButton({
  /** Vart pilen gar. Standard ar Hem; listsidorna skickar in sin egen vag
   *  tillbaka sa att en detaljvy lamnar tillbaka dit man kom ifran. */
  href = "/",
  label = "Tillbaka",
}: {
  href?: string;
  label?: string;
} = {}) {
  return (
    <Link
      href={href}
      className="glass flex h-11 items-center gap-1.5 rounded-full pl-2.5 pr-4 text-sm font-semibold text-white transition-colors duration-200 ease-out active:bg-white/20 motion-reduce:transition-none"
    >
      <ChevronLeft className="h-4 w-4 shrink-0 text-white/70" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
