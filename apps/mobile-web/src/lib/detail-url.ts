export type MobileDetailView = "order" | "ticket" | "task";

export type MobileDetailUrlState<TView extends MobileDetailView = MobileDetailView> = {
  view: TView;
  id: string;
};

type HistoryMode = "push" | "replace";

function canUseHistory(): boolean {
  return typeof window !== "undefined" && typeof window.history !== "undefined";
}

export function readMobileDetailUrlState<TView extends MobileDetailView>(
  allowedViews: readonly TView[],
): MobileDetailUrlState<TView> | null {
  if (!canUseHistory()) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const id = params.get("id")?.trim();

  if (!view || !id || !allowedViews.includes(view as TView)) {
    return null;
  }

  return {
    view: view as TView,
    id,
  };
}

export function writeMobileDetailUrlState(
  state: MobileDetailUrlState | null,
  mode: HistoryMode = "push",
): void {
  if (!canUseHistory()) {
    return;
  }

  const url = new URL(window.location.href);

  if (state) {
    url.searchParams.set("view", state.view);
    url.searchParams.set("id", state.id);
  } else {
    url.searchParams.delete("view");
    url.searchParams.delete("id");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl === currentUrl) {
    return;
  }

  const historyState = state ? { mobileDetail: state } : { mobileDetail: null };

  if (mode === "replace") {
    window.history.replaceState(historyState, "", nextUrl);
    return;
  }

  window.history.pushState(historyState, "", nextUrl);
}
