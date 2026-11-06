"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem", textAlign: "center" }}
      >
        <h1>Kinshift hit an unexpected error</h1>
        <p>Please reload the page. If this keeps happening, contact whoever runs this server.</p>
        <button onClick={reset} style={{ marginTop: "1rem", padding: "0.6rem 1.2rem" }}>
          Reload
        </button>
      </body>
    </html>
  );
}
