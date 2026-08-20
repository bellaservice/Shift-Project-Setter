import Image from "next/image";
import darkPhoto from "../../public/background-8653526_640.jpg";
import lightPhoto from "../../public/Background for light.jpg";

/* The two backdrop photographs are IMPORTED, not named by their URL.
   `src="/Background for light.jpg"` is a string the bundler never sees: the
   browser asks for that exact path every time, so replacing the file leaves the
   URL identical and any copy already sitting in an HTTP cache, a service worker
   or the back/forward cache stays valid. You change the picture, the app keeps
   showing the old one, and nothing in the project is wrong.

   An import makes the file a build input. Next emits it under a URL with a hash
   of its CONTENT in the name, so a new picture is a new URL and there is
   nothing for a stale copy to be stale against — the swap is atomic on every
   device that has ever loaded the app. It also hands `<Image>` the real
   dimensions, which is what lets it stop guessing at layout.

   The files stay in `public/` so replacing one is still drag-and-drop. */

/**
 * The layer every screen stands on.
 *
 * There is one backdrop in the app, not ten. What changes between screens is a
 * single word — the tone — and the tone is chosen by what the screen is *for*,
 * so the light in the room tells you where you are before you have read the
 * heading:
 *
 *   photo  Home. The full header photograph. The one screen that gets a picture,
 *          because it is the one screen that is a place rather than a task.
 *   veil   The two "Alla" lists. The same photograph, cut short and pushed far
 *          down, so the archive is recognisably the same room as Home with the
 *          lights off.
 *   amber  Everything you create or log — project, hours, worker. The brand's
 *          own colour, warm and near, for the screens where something is being
 *          made.
 *   steel  Profil and Inställningar. Cool and flat: these are about the app,
 *          not about the work, and they should not feel like the work.
 *   ember  Papperskorg. Amber shot through with red — something here is on a
 *          clock. It is the only screen that gets it: red is for a deadline
 *          running out, not for a form with blanks in it, and the Arbetsdagbok
 *          questionnaire is under `amber` for exactly that reason.
 *   none   The Arbetsdagbok preview. A white A4 sheet is the brightest thing
 *          the app ever shows; anything behind it competes with it.
 *
 * Fixed rather than in the flow, so the light stays put while the cards scroll
 * up over it. That is what makes the fade read as depth instead of as a banner
 * scrolling away.
 *
 * `aria-hidden` throughout: it is atmosphere, and a screen reader announcing it
 * would only get in the way of the content.
 */
export type BackdropTone =
  | "photo"
  | "veil"
  | "amber"
  | "steel"
  | "ember"
  | "none";

/**
 * The two colour stops of a glow, as `rgba` strings.
 *
 * Two layers, not one: a wide dim wash that lifts the whole top of the screen
 * off pure black, and a tighter, brighter core sitting slightly left of centre.
 * A single centred radial reads as a spotlight aimed at the phone; an off-centre
 * pair reads as a room with a light in it.
 */
const GLOW: Record<"amber" | "steel" | "ember", { wash: string; core: string }> = {
  amber: { wash: "rgba(255, 185, 46, 0.16)", core: "rgba(255, 185, 46, 0.22)" },
  steel: { wash: "rgba(148, 163, 184, 0.16)", core: "rgba(203, 213, 225, 0.14)" },
  ember: { wash: "rgba(248, 113, 113, 0.14)", core: "rgba(255, 185, 46, 0.18)" },
};

/**
 * The same three rooms at noon — see theme-light.css.
 *
 * Both sets are rendered and CSS picks one, because this is a server component:
 * the theme is only known in the browser, and a backdrop that repaints one
 * frame after hydration is a flash on every single navigation.
 *
 * The values are not the night ones lightened. A glow on black works by adding
 * light to nothing; on a page that is already light it can only work by tinting,
 * so each tone is carried by its own hue at roughly the strength that hue needs
 * to be seen on #eceff3 — and `amber` is not amber here at all, because amber on
 * white is invisible long before it is a light source.
 *
 * The alphas are roughly half what they were, and nothing about the light
 * changed — the colour did. These carry `--color-night-accent`, and the daylight
 * accent went from a near-grey slate to a cobalt with three times the chroma
 * (see theme-light.css). At the old strength that reads as a blue panel laid
 * over the top of the page rather than as light falling on it, which is the one
 * thing a glow may never look like. Tint follows chroma, not habit.
 */
const GLOW_LIGHT: Record<"amber" | "steel" | "ember", { wash: string; core: string }> = {
  amber: { wash: "rgba(11, 95, 214, 0.12)", core: "rgba(11, 95, 214, 0.15)" },
  steel: { wash: "rgba(11, 95, 214, 0.07)", core: "rgba(148, 163, 184, 0.2)" },
  ember: { wash: "rgba(192, 57, 47, 0.13)", core: "rgba(11, 95, 214, 0.11)" },
};

export function Backdrop({ tone }: { tone: BackdropTone }) {
  return (
    <div
      aria-hidden
      /* `app-backdrop` is the print stylesheet's hook — see globals.css. A fixed,
         black, full-viewport layer is exactly what must NOT reach the paper:
         Chrome renders the Arbetsdagbok PDF out of a real page, with
         printBackground on, so this would come out as a black sheet. */
      className="app-backdrop pointer-events-none fixed inset-0 -z-10 bg-night"
    >
      {tone === "photo" && (
        <>
          <PhotoBand height={520} />
          {/* 370 is where the photo band's film has closed — see PhotoBand. The
              spill starts from the same number so the light picks up exactly
              where the picture leaves off rather than at a second, unrelated
              seam. Move one and move the other. */}
          <PhotoSpill closes={370} />
        </>
      )}
      {tone === "veil" && <PhotoBand height={300} veiled />}
      {tone !== "photo" && tone !== "veil" && tone !== "none" && (
        <>
          <Glow className="theme-dark-only" {...GLOW[tone]} />
          <Glow className="theme-light-only" {...GLOW_LIGHT[tone]} />
        </>
      )}
    </div>
  );
}

/**
 * The photograph and the black it dissolves into.
 *
 * The fade is a gradient laid over the photo rather than a mask on it, and its
 * stops are in **pixels, not percentages**. That is deliberate and it is the
 * whole trick: the content above it — bar, wordmark, stat card, first button —
 * is a fixed-height stack, so the seam between the two action buttons sits at
 * the same y on every phone, while as a *fraction* of the viewport that same
 * seam swings from 53% on a tall screen to 73% on a short one. A percentage
 * stop can therefore only ever land in the gap on one device. Pixels land there
 * on all of them. Change any spacing above and this number moves with it.
 *
 * Above the fade the photograph is left completely alone — no dimming wash of
 * any kind. Nothing borrows contrast from the picture: the wordmark carries its
 * own shadow, and every panel carries the black base built into `glass`. So the
 * only thing the gradient does is end the picture, and it does that in one
 * move — clean at full brightness through the wordmark and the stat card, still
 * clean behind "Logga Project" so the bokeh refracts through its glass, then
 * closed hard into black across the seam below it.
 *
 * The picture gets its own fixed-height box instead of filling the layer, so
 * `object-cover` frames it for the band that is actually visible rather than
 * scaling it to a viewport height that is mostly black anyway.
 *
 * `veiled` is the same photograph with the exposure pulled down and the fade
 * brought forward: enough texture left to recognise the room, not enough to
 * compete with a list of forty rows.
 */
function PhotoBand({ height, veiled }: { height: number; veiled?: boolean }) {
  return (
    <div className="absolute inset-x-0 top-0" style={{ height }}>
      {/* Both photographs are in the markup and CSS shows one — see the note on
          GLOW_LIGHT. The fade under the daylight one dissolves into #eceff3
          rather than into black: a photo that ends in black on a white page is
          a bar across the top, not a picture ending.

          The stops are the night theme's stops, to the percent. That is the
          point: the film over the picture is what decides how much photograph
          the screen actually has, and two themes with different films are two
          different screens wearing the same layout. The daylight film is the
          same film in the page's own colour.

          Which leaves the heading with a dark, undimmed photograph under it for
          the first 240px — see theme-light.css, where the two lines on the
          `photo` tone go white with a navy halo rather than the near-black they
          use everywhere else. The film is not asked to make the type legible;
          the type is. */}
      <div className="theme-dark-only absolute inset-0">
        <Image
          src={darkPhoto}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className={
            veiled
              ? "absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.78)_0px,rgba(0,0,0,0.72)_90px,rgba(0,0,0,0.8)_190px,#000_290px)]"
              : "absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0)_0px,rgba(0,0,0,0)_240px,rgba(0,0,0,0.24)_300px,rgba(0,0,0,0.62)_340px,#000_370px)]"
          }
        />
      </div>

      <div className="theme-light-only absolute inset-0">
        <Image
          src={lightPhoto}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* One film for both bands in daylight, and it is Home's.

            `veiled` still means something at night: black over a photograph
            takes light OUT of it, so 78% of it leaves enough texture to
            recognise the room and none to compete with forty rows. The same
            move in daylight is white over the picture, and white does not dim a
            photograph — it bleaches it. At 78% the archive's hero was a pale
            smear with no picture left in it, while Home three centimetres away
            was vivid: the same room, but only one of them lit.

            So the daylight archive uses Home's ramp — 0, 0, 0.24, 0.62, 1 — at
            Home's proportions rather than its pixels. The stops are the photo
            band's (240 / 300 / 340 / 370 of 520) scaled to whatever height this
            band is, so the picture is untouched through the heading, closes
            over the same fraction of its own band, and is finished well before
            the band ends. Percent stops would have said the same thing in fewer
            characters and are exactly what the note above forbids: the fade is
            still aimed at a fixed-height stack of content, and a fraction of
            the viewport is not a fraction of that. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to bottom,
              rgba(236, 239, 243, 0) 0px,
              rgba(236, 239, 243, 0) ${Math.round(height * (240 / 520))}px,
              rgba(236, 239, 243, 0.24) ${Math.round(height * (300 / 520))}px,
              rgba(236, 239, 243, 0.62) ${Math.round(height * (340 / 520))}px,
              #eceff3 ${Math.round(height * (370 / 520))}px)`,
          }}
        />
      </div>
    </div>
  );
}

/** A lit top edge on the plain page — the photo's stand-in on the screens that
 *  do not get a picture. Same job: give the glass panels something to refract.
 *  `className` is the theme switch, not a styling hook: the caller renders this
 *  twice, once per theme, and CSS hides the one that is not in use. */
function Glow({
  wash,
  core,
  className,
}: {
  wash: string;
  core: string;
  className: string;
}) {
  return (
    <div
      className={`${className} absolute inset-x-0 top-0 h-[460px]`}
      style={{
        backgroundImage: [
          `radial-gradient(120% 90% at 50% -10%, ${wash} 0%, rgba(0,0,0,0) 62%)`,
          `radial-gradient(48% 42% at 22% 4%, ${core} 0%, rgba(0,0,0,0) 70%)`,
        ].join(","),
      }}
    />
  );
}

/**
 * The light the photograph throws down the rest of Home — daylight only.
 *
 * The night theme gets this for free. Its picture is a wall of amber bokeh on
 * black, so the cards below the wordmark still have lit pixels behind them: the
 * "Logga Project" slab catches a warm bloom in its top-left corner, "Logga
 * Timmar" keeps a warm hairline along its top edge, and the whole lower half of
 * the screen reads as a room with a lamp in it rather than as a list on black.
 * That warmth is not painted onto the cards — it is behind them, and the glass
 * is doing what glass does.
 *
 * In daylight the same screen fell apart, and the film is why. `#eceff3` at
 * 370px is opaque, so from the second action row down there is nothing behind
 * the panes but flat page grey — and a pane of glass over flat grey has nothing
 * to refract, so it can only render as white. That is the whole reason the
 * lower half of the daylight Home read as three sheets of paper while the top
 * bar two centimetres above it read as glass: same material, one of them with a
 * picture behind it and two of them without.
 *
 * So the picture keeps throwing light after it has stopped being a picture.
 * Two layers, and they are deliberately the same two `Glow` uses on the tones
 * that have no photograph at all — a wide wash plus an off-centre core — because
 * this is the same object: a light source in the room, placed where the room's
 * actual light is. The difference is only that here it hangs off the bottom of
 * a photograph instead of off the top of the viewport.
 *
 * The blue is the photograph's own. Sampled down the light backdrop, its
 * saturated stops sit around rgb(0,68,131) and rgb(5,57,125) and its mid-tones
 * around rgb(125,152,190); #5885be is the middle of that, which is what makes
 * the spill read as the picture continuing rather than as a coloured panel
 * someone slid under the content. It is deliberately not `--color-night-accent`
 * (#0b5fd6, the same hue at full chroma) — the accent is the app's voice and
 * belongs on controls, this is the room's light and belongs behind them. Same
 * blue, one at speaking volume and one at the volume of a wall.
 *
 * Stops in pixels for the same reason every stop in this file is: what has to
 * be lit is a fixed-height stack of cards, and a percentage of the viewport is
 * not a fixed height. `closes` is the one number that ties the two together.
 */
function PhotoSpill({ closes }: { closes: number }) {
  return (
    <div
      className="theme-light-only absolute inset-x-0 top-0 h-[1100px]"
      style={{
        backgroundImage: [
          /* The core. Wide and shallow — 130% across, 26% down — because it is
             standing in for the bottom edge of a picture rather than for a bulb:
             a round hotspot here would read as a spotlight aimed at the second
             button. Left of centre at 30%, which is where the photograph's own
             brightest ribbon runs, so the light appears to fall out of the
             image instead of arriving from somewhere new. */
          `radial-gradient(110% 28% at 28% ${closes + 20}px, rgba(88, 133, 190, 0.24) 0%, rgba(88, 133, 190, 0) 74%)`,
          /* The wash. It has to be up to strength BEFORE the film is opaque or
             the two meet at a visible seam, so it opens 70px above `closes` and
             peaks 60px below it — the overlap is what makes one continuous
             light out of a picture and a gradient. Then a long fall: still
             clearly there under "Logga Timmar" and the Pågående Project row,
             gone by the time the empty page below them starts, so the screen
             ends in its own grey rather than in a blue that stops. */
          `linear-gradient(to bottom,
             rgba(88, 133, 190, 0) ${closes - 70}px,
             rgba(88, 133, 190, 0.17) ${closes + 60}px,
             rgba(88, 133, 190, 0.11) ${closes + 250}px,
             rgba(88, 133, 190, 0.045) ${closes + 400}px,
             rgba(88, 133, 190, 0) ${closes + 540}px)`,
        ].join(","),
      }}
    />
  );
}
