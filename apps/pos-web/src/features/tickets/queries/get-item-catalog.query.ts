import { posApi } from "@/lib/api-client";

/** Browser query: auth and the current terminal credential use HttpOnly cookies. */
export const getTicketItemCatalogQuery = () => posApi.pos.catalog.itemCatalog();
