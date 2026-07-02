import type { TenantMessages } from "./types";

export const tenantMessagesEn: TenantMessages = {
  common: {
    statusLabels: {
      active: "Active",
      inactive: "Inactive",
    },
    languageLabels: {
      en: "English",
      fr: "French",
      "zh-CN": "Chinese",
    },

    allStatuses: "All statuses",
    search: "Search",
    status: "Status",
    refresh: "Refresh",
    saving: "Saving...",
    tryAgain: "Try again",
    cancel: "Cancel",
    backToList: "Back to list",
    enable: "Enable",
    disable: "Disable",
    open: "Open",
    actions: "Actions",

    notSet: "Not set",
    notUpdated: "Not updated",
    invalidDate: "Invalid date",
    requestFailed: "Branch request failed.",
    somethingWentWrong: "Something went wrong",
    loadErrorDescription: "We couldn't load this page. Please try again.",
    notFoundTitle: "Page not found",
    notFoundDescription:
      "The page you're looking for doesn't exist or may have moved.",
  },

  branches: {
    eyebrow: "Tenant branches",
    title: "Branches",
    listDescription:
      "Owner sees all tenant branches. Manager visibility is enforced by the tenant branches API through branch scope.",
    newBranch: "New branch",

    list: {
      searchPlaceholder: "Branch name or phone",
      empty: "No branches yet",
      limitedHint:
        "Only showing the first {limit} branches. Use search or filters to narrow the list.",
      statusUpdated: "Branch status updated.",
      columns: {
        branch: "Branch",
        contact: "Contact",
        defaults: "Defaults",
        status: "Status",
        updated: "Updated",
        actions: "Actions",
      },
    },

    create: {
      badge: "New branch",
      title: "Create branch",
      description:
        "Add an operating location for the current tenant. Tenant and Manager branch scope are enforced by the API.",
      created: "Branch created.",
      createButton: "Create branch",
      businessHoursPlaceholder: '{"mon":"08:00-18:00"}',
      fields: {
        name: "Name",
        phone: "Phone",
        currency: "Currency",
        defaultLanguage: "Default language",
        status: "Status",
        logoUrl: "Logo URL",
        receiptName: "Receipt name",
        receiptPhone: "Receipt phone",
        address: "Address",
        receiptAddress: "Receipt address",
        businessHoursJson: "Business hours JSON",
      },
    },

    detail: {
      badge: "Branch profile",
      description:
        "Edit store defaults, receipt identity, and operating metadata.",
      saveBranch: "Save branch",
      statusHint: "Use Enable or Disable to update status.",
      integrationChecks: "Integration checks",
      integrationChecksDesc:
        "Branch scope and tenant isolation are enforced by the API.",
      branchIdLabel: "Branch ID",
      updatedLabel: "Updated",
      updated: "Branch updated.",
      versionConflict:
        "Branch was updated by another request. Refresh and try again.",
    },
  },
};
