"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";

function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.warn("Service worker registration failed", err));
  }, []);
  return null;
}

export function Providers() {
  return (
    <>
      <ServiceWorker />
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ className: "!rounded-xl !font-sans" }}
      />
    </>
  );
}
