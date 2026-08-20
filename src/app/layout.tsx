import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bella Service",
  description: "Internal tool for logging projects, workers, and worked hours.",
};

/**
 * `themeColor` is the browser chrome above the page — the status-bar strip on
 * a phone. Left unset it stays white, which puts a bright band directly above a
 * black app; black is what makes the page start at the top edge of the screen
 * instead of below a seam.
 */
export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sv"
      /* The theme is written onto this element by the script below before React
         ever runs, so the server's markup and the browser's first render differ
         by exactly one attribute. That is the intended difference, not a bug in
         a component, and this is the only way to tell React so. */
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* The whole app is the night surface now — there is no light half left to
          flip to, so the black lives here rather than in a per-page opt-in.

          `app-shell` is the hook the Arbetsdagbok print stylesheet uses to strip
          this wrapper's width cap and padding, so the A4 page it renders is not
          printed inside the phone-width column. */}
      {/* No background on <body> on purpose — see globals.css. The black is on
          <html>; painting it here too would bury the fixed Backdrop, which sits
          at a negative z-index. */}
      <body className="flex min-h-full flex-col text-white">
        {/* The theme, restored before the first pixel.

            It has to be a blocking inline script and it has to run before the
            page paints: the alternative — setting the attribute in an effect —
            paints the night theme first and swaps a frame later, so a user who
            chose daylight sees a black flash on every single navigation. This
            is the one place in the app where a raw <script> earns its keep.

            Anything that throws here (Safari private mode denies localStorage)
            leaves the app on its default night theme, which is the right
            fallback and the reason the whole thing sits in a try. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("bella:tema")==="ljus")' +
              'document.documentElement.setAttribute("data-theme","light")}catch(e){}',
          }}
        />
        <div className="app-shell mx-auto w-full max-w-2xl flex-1 px-4 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
