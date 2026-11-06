"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/client";
import { Alert } from "@/components/ui/misc";
import { removePushSubscription, savePushSubscription, sendTestPush } from "./actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

export function PushManager({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    const check = async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }));
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Re-save in case the server lost it (for example after a restore).
        await savePushSubscription(sub.toJSON(), navigator.userAgent);
      }
      setStatus(sub ? "on" : "off");
    };
    check().catch(() => setStatus("unsupported"));
  }, []);

  const enable = () =>
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));
        const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (!res.ok) throw new Error(res.error);
        setStatus("on");
        toast.success("Notifications are on for this device.");
      } catch (err) {
        console.error(err);
        toast.error("Couldn’t turn on notifications on this device.");
      }
    });

  const disable = () =>
    start(async () => {
      const reg =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }));
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      toast.success("Notifications turned off for this device.");
    });

  const test = () =>
    start(async () => {
      const res = await sendTestPush();
      if (res.ok) toast.success("Test notification sent.");
      else toast.error("The test notification could not be delivered.");
    });

  if (status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="size-4" /> Checking this device…
      </p>
    );
  }
  if (status === "ios-install") {
    return (
      <Alert tone="info" title="Add Kinshift to your Home Screen first">
        On iPhone and iPad, notifications work once Kinshift is installed: tap the Share button in
        Safari, choose “Add to Home Screen”, then open Kinshift from there and come back to this
        page.
      </Alert>
    );
  }
  if (status === "unsupported") {
    return (
      <Alert tone="warning" title="Notifications aren’t available here">
        This browser doesn’t support web push, or the site isn’t served over HTTPS.
      </Alert>
    );
  }
  if (status === "denied") {
    return (
      <Alert tone="warning" title="Notifications are blocked">
        You blocked notifications for this site. Allow them in your browser’s site settings, then
        reload this page.
      </Alert>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-subtle p-3">
      <p className="flex items-center gap-2 text-sm">
        <Smartphone className="size-4 text-muted" aria-hidden />
        {status === "on"
          ? "Notifications are on for this device."
          : "Notifications are off for this device."}
      </p>
      <div className="flex gap-2">
        {status === "on" ? (
          <>
            <Button variant="outline" size="sm" onClick={test} disabled={pending}>
              <Send aria-hidden /> Send test
            </Button>
            <Button variant="ghost" size="sm" onClick={disable} disabled={pending}>
              <BellOff aria-hidden /> Turn off
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={enable} disabled={pending}>
            {pending ? <Spinner /> : <BellRing aria-hidden />} Turn on notifications
          </Button>
        )}
      </div>
    </div>
  );
}
