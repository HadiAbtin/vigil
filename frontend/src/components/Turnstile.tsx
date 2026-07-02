import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback: (token: string) => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

// Cloudflare's own script (loaded in index.html) exposes window.turnstile
// asynchronously, so this polls briefly until it's ready rather than
// assuming it's already there on mount.
export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
}: {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | undefined;

    function render() {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "dark",
        callback: (token) => onVerifyRef.current(token),
        "expired-callback": () => onExpireRef.current?.(),
      });
    }

    if (window.turnstile) {
      render();
    } else {
      pollId = setInterval(() => {
        if (window.turnstile) {
          clearInterval(pollId);
          render();
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
