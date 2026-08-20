import { BackButton } from "@/components/BackButton";
import { NavMenu } from "@/components/NavMenu";
import { SettingsMenu } from "@/components/SettingsMenu";

/**
 * Wireframe row 1: the menu box on the left, and the cog on the right. The row
 * keeps its own height so both sit the same distance below the top edge on
 * every screen. The split is by subject, not by convenience — the hamburger
 * goes to the screens the work happens on, the cog to the app itself.
 *
 * `back` puts the way out on this same row rather than on a line of its own
 * underneath. Two reasons: it costs a deep screen no vertical space it could
 * have spent on content, and it keeps the hamburger present everywhere. A back
 * arrow that replaced the menu would strand you one level down with only one
 * way out — the app's three destinations have to stay reachable from every
 * screen, not just from the two lists.
 *
 * There is no light variant any more. The app is one dark surface, so the
 * triggers are glass everywhere and the `tone` fork that used to pick between
 * two looks is gone with it.
 */
export function TopBar({ back }: { back?: { href: string; label?: string } }) {
  return (
    <div className="flex h-11 items-stretch gap-2">
      <NavMenu />
      {back && <BackButton href={back.href} label={back.label} />}
      <div className="ml-auto flex">
        <SettingsMenu />
      </div>
    </div>
  );
}
