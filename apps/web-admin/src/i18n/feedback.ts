import type { WebAdminLocale } from "./locale";
import type { WebAdminMessages } from "./messages-types";
import { enMessages } from "./messages/en";
import { saasFeedbackFr } from "./messages/saas/feedback-fr";
import { tenantFeedbackFr } from "./messages/tenant/feedback-fr";
import { getErrorMessageTranslations } from "@cleanhub/i18n/error-messages";

export type FeedbackTranslator = (message: string | null | undefined) => string;

function flatten(
  value: unknown,
  prefix = "",
  output = new Map<string, string>(),
): Map<string, string> {
  if (typeof value === "string") output.set(prefix, value);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value))
      flatten(child, `${prefix}.${key}`, output);
  }
  return output;
}

function templatePattern(template: string): {
  pattern: RegExp;
  names: string[];
} {
  const names: string[] = [];
  const source = template
    .split(/(\{\w+\})/)
    .map((part) => {
      if (/^\{\w+\}$/.test(part)) {
        names.push(part.slice(1, -1));
        return "([\\s\\S]*?)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return { pattern: new RegExp(`^${source}$`), names };
}

const english = flatten(enMessages);
const cachedTranslators = new WeakMap<
  WebAdminMessages,
  Map<"saas" | "tenant", FeedbackTranslator>
>();
const unchangedFeedback: FeedbackTranslator = (message) => message ?? "";

/** Translate UI feedback only. Business names, log messages and stored content must never pass here. */
export function getWebAdminFeedbackTranslator(
  locale: WebAdminLocale,
  messages: WebAdminMessages,
  scope: "saas" | "tenant",
): FeedbackTranslator {
  if (locale !== "fr") return unchangedFeedback;
  const cache =
    cachedTranslators.get(messages) ??
    new Map<"saas" | "tenant", FeedbackTranslator>();
  const cached = cache.get(scope);
  if (cached) return cached;
  const french = flatten(messages);
  const translated = new Map<string, string>([
    ...getErrorMessageTranslations("fr"),
    ...Object.entries(saasFeedbackFr),
    ...Object.entries(tenantFeedbackFr),
  ]);
  const frenchValues = new Set([...french.values(), ...translated.values()]);
  const templates: Array<{
    pattern: RegExp;
    names: string[];
    translated: string;
  }> = [];
  const frenchTemplates: RegExp[] = [];
  for (const [key, source] of english) {
    const target = french.get(key);
    if (!target) continue;
    if (!translated.has(source)) translated.set(source, target);
  }
  for (const [source, target] of translated) {
    if (
      /\{\w+\}/.test(source) &&
      source.replace(/\{\w+\}/g, "").trim().length >= 4
    ) {
      templates.push({ ...templatePattern(source), translated: target });
      frenchTemplates.push(templatePattern(target).pattern);
    }
  }
  const fallback = messages[scope].common.somethingWentWrong;
  const translate: FeedbackTranslator = (message) => {
    if (!message) return "";
    const reference = message.match(/ Request ID: (\S+)$/);
    const source = reference ? message.slice(0, reference.index) : message;
    let target = translated.get(source);
    if (!target && frenchValues.has(source)) target = source;
    if (!target) {
      for (const template of templates) {
        const match = source.match(template.pattern);
        if (!match) continue;
        const values = new Map(
          template.names.map((name, index) => {
            const value = match[index + 1] ?? "";
            return [
              name,
              name === "methods"
                ? value
                    .split(", ")
                    .map(
                      (method) =>
                        ({
                          cash: "Espèces",
                          card: "Carte",
                          app: "Paiement mobile",
                        })[method] ?? method,
                    )
                    .join(", ")
                : name === "error"
                  ? (translated.get(value) ??
                    (frenchValues.has(value) ? value : fallback))
                  : value,
            ];
          }),
        );
        target = template.translated.replace(
          /\{(\w+)\}/g,
          (_, name: string) => values.get(name) ?? "",
        );
        break;
      }
    }
    if (!target && frenchTemplates.some((pattern) => pattern.test(source)))
      target = source;
    const minimum = source.match(
      /^Password must be at least (\d+) characters\.$/,
    );
    if (!target && minimum)
      target = `Le mot de passe doit comporter au moins ${minimum[1]} caractères.`;
    target ??= fallback;
    return reference ? `${target} Référence : ${reference[1]}` : target;
  };
  cache.set(scope, translate);
  cachedTranslators.set(messages, cache);
  return translate;
}
