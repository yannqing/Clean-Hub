import type { Database } from "@cleanhub/db";
import {
  selectedServiceItemGroups,
  serviceCatalogText,
} from "@cleanhub/domain/service-item-catalog";
import { findTenantItemCatalog } from "../../service-item-catalog/service-item-catalog.repository.js";
import { ServiceTicketError } from "./service-tickets.errors.js";

/** The server validates membership and supplies the names stored on the ticket. */
export async function resolveTicketArticle(
  db: Database,
  tenantId: string,
  itemType: string,
  catalogItemId: string | undefined,
  locale: string,
) {
  const catalog = await findTenantItemCatalog(db, tenantId);
  const group = selectedServiceItemGroups(catalog).find(
    (entry) => entry.itemType === itemType,
  );
  if (!group)
    throw new ServiceTicketError(
      "VALIDATION_ERROR",
      "This item type is not enabled for this tenant. Ask an administrator to update the item catalog.",
    );
  const article = group.items.find((entry) => entry.id === catalogItemId);
  if ((catalogItemId || catalog.selection) && !article)
    throw new ServiceTicketError(
      "VALIDATION_ERROR",
      "Choose an enabled article from the tenant item catalog. Update the POS app if the item selector is missing.",
    );
  return {
    itemTypeName: serviceCatalogText(group.names, locale),
    ...(article
      ? {
          catalogItemId: article.id,
          itemCategory: serviceCatalogText(article.names, locale),
        }
      : {}),
  };
}
