import React from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import App, { parseOverviewAppPayload } from "./App.tsx";
import ObserverView, { parseObserverViewPayload } from "./ObserverView.tsx";
import RunHealthView, { parseRunHealthViewPayload } from "./RunHealth.tsx";
import WeeklyView, { parseWeeklyViewPayload } from "./WeeklyView.tsx";

type MountedRoot = {
  container: Element;
  root: Root;
  clientOnly: boolean;
};

type ClientPayloadConfig = {
  scriptId: string;
  windowKey: string;
};

declare global {
  interface Window {
    __mountVisualConsoleApps?: () => void;
    __visualConsoleMountedRoots?: {
      overview?: MountedRoot;
      observer?: MountedRoot;
      runHealth?: MountedRoot;
      weekly?: MountedRoot;
    };
  }
}

async function ensureClientPayload(container: Element, payloadConfig: ClientPayloadConfig): Promise<boolean> {
  const existingScript = document.getElementById(payloadConfig.scriptId);
  if (existingScript?.textContent?.trim()) return true;

  const payloadUrl = container.getAttribute("data-react-payload-url");
  if (!payloadUrl) return false;

  try {
    const response = await fetch(payloadUrl, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!response.ok) return false;

    const payload = await response.json();
    (window as unknown as Record<string, unknown>)[payloadConfig.windowKey] = payload;

    const script =
      existingScript instanceof HTMLScriptElement
        ? existingScript
        : Object.assign(document.createElement("script"), {
            id: payloadConfig.scriptId,
            type: "application/json",
          });
    script.textContent = JSON.stringify(payload);
    if (!existingScript) document.head.appendChild(script);
    return true;
  } catch {
    return false;
  }
}

function mountIntoRoot(
  key: "overview" | "observer" | "runHealth" | "weekly",
  containerId: string,
  elementFactory: () => React.ReactElement,
  payloadConfig?: ClientPayloadConfig,
): void {
  const container = document.getElementById(containerId);
  const registry = (window.__visualConsoleMountedRoots ??= {});
  const existing = registry[key];

  if (!container) {
    if (existing) {
      existing.root.unmount();
      delete registry[key];
    }
    return;
  }

  const shouldClientRender =
    container.getAttribute("data-react-ssr") === "false" ||
    container.childNodes.length === 0;

  if (existing?.container === container) {
    if (existing.clientOnly) {
      existing.root.render(elementFactory());
    }
    return;
  }

  existing?.root.unmount();
  registry[key] = {
    container,
    clientOnly: shouldClientRender,
    root: shouldClientRender ? createRoot(container) : hydrateRoot(container, elementFactory()),
  };
  if (shouldClientRender) {
    const mountClientOnly = async () => {
      if (payloadConfig) {
        const payloadReady = await ensureClientPayload(container, payloadConfig);
        if (!payloadReady) return;
      }

      if (registry[key]?.container !== container) return;
      registry[key]?.root.render(elementFactory());
    };
    void mountClientOnly();
  }
}

export function mountVisualConsoleApps(): void {
  mountIntoRoot("overview", "overview-react-root", () => <App {...parseOverviewAppPayload()} />);
  mountIntoRoot("observer", "observer-react-root", () => <ObserverView {...parseObserverViewPayload()} />, {
    scriptId: "observer-react-payload",
    windowKey: "__OBSERVER_INITIAL_DATA__",
  });
  mountIntoRoot("runHealth", "run-health-react-root", () => <RunHealthView {...parseRunHealthViewPayload()} />, {
    scriptId: "run-health-react-payload",
    windowKey: "__RUN_HEALTH_INITIAL_DATA__",
  });
  mountIntoRoot("weekly", "weekly-react-root", () => <WeeklyView {...parseWeeklyViewPayload()} />);
}

window.__mountVisualConsoleApps = mountVisualConsoleApps;
mountVisualConsoleApps();
