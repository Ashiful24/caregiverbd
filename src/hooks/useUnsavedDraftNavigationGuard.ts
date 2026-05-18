import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

export type PendingNavigation = string | "__back__" | null;

/**
 * Warns before in-app navigation or tab close when unsaved draft data exists.
 * Works with BrowserRouter (no data router / useBlocker required).
 */
export function useUnsavedDraftNavigationGuard(enabled: boolean) {
  const location = useLocation();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);
  const historyGuardPushedRef = useRef(false);

  const cancelLeave = useCallback(() => {
    setDialogOpen(false);
    setPendingNavigation(null);
  }, []);

  const confirmLeave = useCallback(
    (onDiscard?: () => void) => {
      const target = pendingNavigation;
      setDialogOpen(false);
      setPendingNavigation(null);
      onDiscard?.();
      if (target === "__back__") {
        navigate(-1);
      } else if (target) {
        navigate(target);
      }
    },
    [pendingNavigation, navigate]
  );

  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      historyGuardPushedRef.current = false;
      return;
    }

    if (!historyGuardPushedRef.current) {
      window.history.pushState({ scheduleDraftGuard: true }, "");
      historyGuardPushedRef.current = true;
    }

    const onPopState = () => {
      window.history.pushState({ scheduleDraftGuard: true }, "");
      setPendingNavigation("__back__");
      setDialogOpen(true);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let path: string;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        path = url.pathname + url.search + url.hash;
      } catch {
        return;
      }

      const current = location.pathname + location.search + location.hash;
      if (path === current) return;

      e.preventDefault();
      e.stopPropagation();
      setPendingNavigation(path);
      setDialogOpen(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, location.pathname, location.search, location.hash]);

  return {
    dialogOpen,
    pendingNavigation,
    cancelLeave,
    confirmLeave,
  };
}
