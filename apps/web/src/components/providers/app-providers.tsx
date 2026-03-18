"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { createQueryClient } from "@/lib/query-client";
import { MuiThemeProvider } from "./mui-theme-provider";

const CHUNK_RELOAD_KEY = "pncp-chunk-reload";

function isChunkLoadError(reason: unknown) {
  if (!(reason instanceof Error)) {
    return false;
  }

  return (
    reason.name === "ChunkLoadError" ||
    reason.message.includes("Loading chunk") ||
    reason.message.includes("Cannot find module './vendor-chunks/")
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    const reloadOnce = () => {
      if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === "true") {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return;
      }

      window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");
      window.location.reload();
    };

    const handleError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error)) {
        reloadOnce();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadOnce();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      storageKey="pncp-theme-mode"
      enableSystem
      defaultTheme="light"
    >
      <MuiThemeProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MuiThemeProvider>
    </ThemeProvider>
  );
}
