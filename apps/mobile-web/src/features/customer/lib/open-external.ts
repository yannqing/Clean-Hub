type CapacitorBrowserPlugin = {
  open(input: { url: string }): Promise<void>;
};

function getCapacitorPlugin<TPlugin>(name: string): TPlugin | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = window as Window & {
    Capacitor?: {
      Plugins?: Record<string, unknown>;
    };
  };

  const plugin = candidate.Capacitor?.Plugins?.[name];
  return plugin ? (plugin as TPlugin) : null;
}

export async function openExternalUrl(url: string): Promise<void> {
  const browser = getCapacitorPlugin<CapacitorBrowserPlugin>("Browser");

  if (browser) {
    await browser.open({ url });
    return;
  }

  // Passing "noopener" makes window.open always return null, which would make
  // the popup-blocked fallback fire even on success; detach opener manually.
  const opened = window.open(url, "_blank");

  if (opened) {
    opened.opener = null;
    return;
  }

  window.location.assign(url);
}
