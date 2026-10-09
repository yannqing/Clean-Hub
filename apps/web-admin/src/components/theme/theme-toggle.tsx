"use client";

import { Button, Icon } from "@cleanhub/ui";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useWebAdminLocale } from "@/i18n";

import {
  WEB_ADMIN_THEME_STORAGE_KEY,
  type WebAdminTheme,
} from "./theme-config";

const THEME_CHANGE_EVENT = "cleanhub-web-admin-theme-change";

function getThemeSnapshot(): WebAdminTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerThemeSnapshot(): WebAdminTheme {
  return "light";
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    observer.disconnect();
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function applyTheme(theme: WebAdminTheme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;

  try {
    window.localStorage.setItem(WEB_ADMIN_THEME_STORAGE_KEY, theme);
  } catch {}

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function ThemeToggle() {
  const { messages } = useWebAdminLocale();
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const isDark = theme === "dark";
  const label = isDark
    ? messages.common.switchToLightTheme
    : messages.common.switchToDarkTheme;

  return (
    <Button
      aria-label={label}
      aria-pressed={isDark}
      onClick={() => applyTheme(isDark ? "light" : "dark")}
      size="icon"
      title={label}
      type="button"
      variant="outline"
    >
      <Icon icon={isDark ? Sun : Moon} aria-hidden="true" />
    </Button>
  );
}
