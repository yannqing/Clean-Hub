import { WEB_ADMIN_THEME_STORAGE_KEY } from "./theme-config";

const themeInitializerScript = `
  (() => {
    let theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

    try {
      const storedTheme = window.localStorage.getItem(${JSON.stringify(WEB_ADMIN_THEME_STORAGE_KEY)});
      if (storedTheme === "light" || storedTheme === "dark") {
        theme = storedTheme;
      }
    } catch {}

    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  })();
`;

export function ThemeInitializer() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitializerScript }} />;
}
