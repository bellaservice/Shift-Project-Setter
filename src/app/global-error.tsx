"use client";

/**
 * Samma sak som error.tsx, men for felet som traffar sjalva rotlayouten — dar
 * finns varken <html> eller appens stilar, sa den har filen far rita bada
 * sjalv. Den ar med av en enda anledning: utan den ar Nexts tomma vita sida
 * kvar for just det fallet, och da hade halva poangen med error.tsx varit
 * borta. Stilen ar inline eftersom globals.css inte garanterat har laddats nar
 * det ar layouten som brunnit.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="sv">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>
            Något gick fel
          </h1>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.7)",
              margin: "0 0 20px",
            }}
          >
            {error.message || "Appen kunde inte starta."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 16,
              border: "none",
              background: "#ffb92e",
              color: "#000",
              fontSize: 16,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Försök igen
          </button>
        </div>
      </body>
    </html>
  );
}
