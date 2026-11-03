import type {
  ServiceBusinessLine,
  ServiceStatus,
} from "../services/services.types.js";

export type ServiceCategoryListInput = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  limit: number;
  offset: number;
};

export type ServiceCategorySummary = {
  id: string;
  name: string;
  businessLine: ServiceBusinessLine;
  description: string | null;
  sortOrder: number;
  status: ServiceStatus;
};
