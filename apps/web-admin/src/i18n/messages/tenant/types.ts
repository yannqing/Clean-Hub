/**
 * TenantMessages — 租户域（/tenant/**）的文案结构。
 *
 * 设计约定：
 * - `common` 放跨模块复用的枚举 label（status / language / business line 等）和共用按钮/状态词，
 *   避免在 branches、services、users 等多个模块里重复定义。
 * - 每个业务模块（branches / services / ...）独占一个子树，按 view 拆 list / create / detail。
 * - 新增模块时在此类型追加子树，类型强约束会强制 en.ts / zh-CN.ts 同步补齐。
 *
 * 当前覆盖：branches（首个迁移模块）。其余模块（services/users/prices/...）后续按需扩展。
 */
export type TenantMessages = {
  common: {
    // 跨模块共享的枚举 label（多模块复用）
    statusLabels: {
      active: string;
      inactive: string;
    };
    languageLabels: {
      en: string;
      fr: string;
      "zh-CN": string;
    };

    // 共用按钮 / 状态词
    allStatuses: string;
    search: string;
    status: string;
    refresh: string;
    saving: string;
    tryAgain: string;
    cancel: string;
    backToList: string;
    enable: string;
    disable: string;
    open: string;
    actions: string;

    // 共用兜底文案
    notSet: string;
    notUpdated: string;
    invalidDate: string;
    requestFailed: string;
    // 全局错误/未找到兜底文案（app/error.tsx、app/not-found.tsx 使用）
    somethingWentWrong: string;
    loadErrorDescription: string;
    notFoundTitle: string;
    notFoundDescription: string;
  };

  branches: {
    // 三页共享
    eyebrow: string;
    title: string;
    listDescription: string;
    newBranch: string;

    // 列表页（branch-management-view）
    list: {
      searchPlaceholder: string;
      empty: string;
      limitedHint: string;
      statusUpdated: string;
      columns: {
        branch: string;
        contact: string;
        defaults: string;
        status: string;
        updated: string;
        actions: string;
      };
    };

    // 新建页（branch-create-view）
    create: {
      badge: string;
      title: string;
      description: string;
      created: string;
      createButton: string;
      businessHoursPlaceholder: string;
      fields: {
        name: string;
        phone: string;
        currency: string;
        defaultLanguage: string;
        status: string;
        logoUrl: string;
        receiptName: string;
        receiptPhone: string;
        address: string;
        receiptAddress: string;
        businessHoursJson: string;
      };
    };

    // 详情页（branch-detail-view）
    detail: {
      badge: string;
      description: string;
      saveBranch: string;
      statusHint: string;
      integrationChecks: string;
      integrationChecksDesc: string;
      branchIdLabel: string;
      updatedLabel: string;
      updated: string;
      versionConflict: string;
    };
  };
};
