import type { ZodIssue } from "zod";
import type { SupportedLocale } from "@cleanhub/i18n/locales";
import {
  listLocalizedErrorMessages,
  localizeErrorMessage,
} from "./error-messages.js";

const explicitMessages = new Set(listLocalizedErrorMessages());

/** Built-in schema failures need field guidance rather than a generic server error. */
export function localizeValidationMessage(
  issue: ZodIssue,
  locale: SupportedLocale,
): string {
  if (locale !== "fr") return localizeErrorMessage(issue.message, locale);
  if (explicitMessages.has(issue.message))
    return localizeErrorMessage(issue.message, locale);
  switch (issue.code) {
    case "invalid_format":
      if (issue.format === "email")
        return "Saisissez une adresse e-mail valide.";
      if (issue.format === "url") return "Saisissez une URL valide.";
      return "Le format de la valeur saisie est invalide.";
    case "invalid_type":
      return "La valeur est manquante ou son type est incorrect.";
    case "invalid_value":
      return "Sélectionnez une valeur autorisée.";
    case "too_small": {
      const minimum = String(issue.minimum);
      if (issue.origin === "string")
        return `Saisissez au moins ${minimum} caractères.`;
      if (issue.origin === "array" || issue.origin === "set")
        return `Sélectionnez au moins ${minimum} éléments.`;
      if (
        issue.origin === "number" ||
        issue.origin === "int" ||
        issue.origin === "bigint"
      )
        return `La valeur doit être ${issue.inclusive ? "supérieure ou égale à" : "supérieure à"} ${minimum}.`;
      return "La valeur est inférieure au minimum autorisé.";
    }
    case "too_big": {
      const maximum = String(issue.maximum);
      if (issue.origin === "string")
        return `Saisissez au plus ${maximum} caractères.`;
      if (issue.origin === "array" || issue.origin === "set")
        return `Sélectionnez au plus ${maximum} éléments.`;
      if (
        issue.origin === "number" ||
        issue.origin === "int" ||
        issue.origin === "bigint"
      )
        return `La valeur doit être ${issue.inclusive ? "inférieure ou égale à" : "inférieure à"} ${maximum}.`;
      return "La valeur dépasse le maximum autorisé.";
    }
    case "not_multiple_of":
      return `La valeur doit être un multiple de ${String(issue.divisor)}.`;
    case "unrecognized_keys":
      return "La requête contient des champs non autorisés.";
    case "invalid_union":
      return "Vérifiez la valeur saisie dans ce champ.";
    default:
      return localizeErrorMessage(issue.message, locale);
  }
}
