/**
 * TenantMessages — 租户域（/tenant/**）的文案结构。
 *
 * 设计约定：
 * - `common` 放跨模块复用的枚举 label（status / language / business line 等）和共用按钮/状态词，
 *   避免在 branches、services、users 等多个模块里重复定义。
 * - 每个业务模块（branches / services / ...）独占一个子树，按 view 拆 list / create / detail。
 * - 新增模块时在此类型追加子树，类型强约束会强制 en.ts / zh-CN.ts 同步补齐。
 */
export type TenantMessages = {
  common: {
    // 跨模块共享的枚举 label（多模块复用）
    statusLabels: {
      active: string;
      inactive: string;
    };
    businessLineLabels: {
      laundry: string;
      car_wash: string;
      retail: string;
      delivery: string;
    };
    pricingUnitLabels: {
      per_item: string;
      per_kg: string;
    };
    languageLabels: {
      en: string;
      fr: string;
      "zh-CN": string;
    };

    // 共用按钮 / 状态词
    allStatuses: string;
    allLines: string;
    allCategories: string;
    allResults: string;
    allRoles: string;
    allBranches: string;
    search: string;
    status: string;
    refresh: string;
    retry: string;
    tryAgain: string;
    cancel: string;
    cancelEdit: string;
    backToList: string;
    enable: string;
    disable: string;
    open: string;
    edit: string;
    details: string;
    delete: string;
    select: string;
    actions: string;
    name: string;
    description: string;

    // 共用加载 / 空 / 错误态
    loading: string;
    saving: string;
    creating: string;
    submitting: string;
    notSet: string;
    notUpdated: string;
    never: string;
    invalidDate: string;
    requestFailed: string;
    unexpectedError: string;
    page: string;
    next: string;
    previous: string;

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

  users: {
    eyebrow: string;
    title: string;
    addMember: string;
    searchPlaceholder: string;
    noMembers: string;
    columns: {
      name: string;
      email: string;
      role: string;
      branches: string;
      status: string;
      lastLogin: string;
      created: string;
      actions: string;
    };
    roleLabels: {
      owner: string;
      manager: string;
      cashier: string;
    };
    actions: {
      resetPin: string;
      edit: string;
    };
    detail: {
      title: string;
      labels: {
        email: string;
        phone: string;
        role: string;
        branches: string;
        status: string;
        language: string;
        lastLogin: string;
        updated: string;
      };
    };
    create: {
      title: string;
      description: string;
      labels: {
        displayName: string;
        email: string;
        phone: string;
        role: string;
        branches: string;
        initialPin: string;
      };
      creatingMember: string;
      createMember: string;
    };
    edit: {
      title: string;
      description: string;
      loadingCurrent: string;
      labels: {
        displayName: string;
        phone: string;
        role: string;
        branches: string;
      };
      keepCurrentRole: string;
    };
    disable: {
      title: string;
      description: string;
      disabling: string;
      action: string;
    };
    enable: {
      title: string;
      description: string;
      enabling: string;
      action: string;
    };
    resetPin: {
      title: string;
      description: string;
      reason: string;
      reasonPlaceholder: string;
      resetting: string;
      action: string;
    };
    temporaryPin: {
      title: string;
      description: string;
      done: string;
    };
  };

  services: {
    eyebrow: string;
    title: string;
    searchPlaceholder: string;
    formLabels: {
      search: string;
      businessLine: string;
      status: string;
      name: string;
      pricing: string;
    };
    formButtons: {
      createService: string;
      updateService: string;
      cancelEdit: string;
    };
    columns: {
      service: string;
      businessLine: string;
      pricing: string;
      status: string;
      actions: string;
    };
    actions: {
      activate: string;
      deactivate: string;
      delete: string;
      edit: string;
    };
    empty: string;
    deletedToast: string;
    formFallbackError: string;
    requestFailed: string;
    delete: {
      title: string;
      description: string;
      deleting: string;
      action: string;
    };
  };

  prices: {
    eyebrow: string;
    title: string;
    searchPlaceholder: string;
    formLabels: {
      search: string;
      businessLine: string;
      status: string;
      amount: string;
      currency: string;
    };
    columns: {
      service: string;
      businessLine: string;
      amount: string;
      status: string;
      actions: string;
    };
    actions: {
      activate: string;
      deactivate: string;
      edit: string;
    };
    empty: string;
    requestFailed: string;
    formFallbackError: string;
    updatePrice: string;
  };

  hardware: {
    eyebrow: string;
    title: string;
    addDevice: string;
    noDevices: string;
    columns: {
      name: string;
      type: string;
      connection: string;
      branch: string;
      status: string;
      created: string;
      actions: string;
    };
    create: {
      title: string;
      description: string;
      labels: {
        branchId: string;
        branchPlaceholder: string;
        deviceName: string;
        deviceType: string;
        connectionType: string;
      };
      adding: string;
      action: string;
    };
    edit: {
      title: string;
      labels: {
        deviceName: string;
        connectionType: string;
        status: string;
      };
      savingChanges: string;
      saveChanges: string;
    };
    requestFailed: string;
  };

  reports: {
    eyebrow: string;
    title: string;
    description: string;
    formLabels: {
      from: string;
      to: string;
      branchId: string;
      branchPlaceholder: string;
      preset: string;
    };
    presets: {
      none: string;
      today: string;
      yesterday: string;
      thisWeek: string;
      lastWeek: string;
      thisMonth: string;
      lastMonth: string;
    };
    applyFilters: string;
    cards: {
      grossSales: string;
      orders: string;
      pendingPickup: string;
      inProgress: string;
    };
    paymentBreakdown: string;
    paymentMethodLabels: {
      cash: string;
      mobile: string;
      card: string;
      other: string;
    };
    exports: string;
    exportButtons: {
      export: string;
      zReport: string;
    };
    exportToasts: {
      exported: string;
      zReportExported: string;
      failed: string;
      noData: string;
    };
    csv: {
      metricHeader: string;
      valueHeader: string;
      generatedAt: string;
    };
    zReport: {
      title: string;
      storeName: string;
      period: string;
      generatedAt: string;
      totals: string;
    };
  };

  auditLogs: {
    eyebrow: string;
    title: string;
    formLabels: {
      category: string;
      eventType: string;
      branchId: string;
      result: string;
      from: string;
      to: string;
    };
    allCategories: string;
    allResults: string;
    successLabel: string;
    failedLabel: string;
    categoryLabels: {
      branches: string;
      users: string;
      services: string;
      prices: string;
      hardware: string;
      notifications: string;
      settings: string;
      backups: string;
    };
    columns: {
      time: string;
      category: string;
      event: string;
      entity: string;
      actor: string;
      result: string;
      actions: string;
    };
    placeholders: {
      unknownEntity: string;
      noEntity: string;
      systemActor: string;
      noIp: string;
    };
    selectedDetail: string;
    detailLabels: {
      event: string;
      branch: string;
      userAgent: string;
      tenantScope: string;
      notCaptured: string;
      noJson: string;
    };
    selectLogHint: string;
    empty: string;
    requestFailed: string;
  };

  overview: {
    eyebrow: string;
    description: string;
    metrics: {
      visibleBranches: string;
      shown: string;
      unavailable: string;
      todayOrders: string;
      todayRevenue: string;
      pendingPickup: string;
      inProgress: string;
      pendingTasks: string;
    };
    featuresEnabled: string;
    placeholderNotice: string;
    quickActions: string;
    quickLinks: {
      createBranch: string;
      settings: string;
      branches: string;
      users: string;
      services: string;
      prices: string;
      reports: string;
    };
    unavailable: string;
    requestFailed: string;
  };

  settings: {
    eyebrow: string;
    description: string;
    labels: {
      pilotStatus: string;
      defaultLanguage: string;
      defaultCurrency: string;
      timezone: string;
    };
    featuresCount: string;
    featureFlags: string;
    featureFlagsDesc: string;
    flagStates: {
      enabled: string;
      disabled: string;
    };
    saveSettings: string;
    updatedLabel: string;
    permissionUnavailable: string;
    readOnly: string;
    checkingPermissions: string;
    unavailable: string;
    settingsUpdated: string;
    settingsUpToDate: string;
    onlyOwners: string;
    onlyOwnersReadonly: string;
    permissionDenied: string;
    requestFailed: string;
    invalidDate: string;
    notUpdated: string;
  };

  notifications: {
    eyebrow: string;
    title: string;
    description: string;
    updatedBadge: string;
    warningTitle: string;
    warningBody: string;
    labels: {
      defaultLanguage: string;
      channels: string;
      templates: string;
      event: string;
      enabled: string;
      templateKey: string;
    };
    templatesDesc: string;
    sendingHistory: string;
    sendingHistoryEmpty: string;
    saveSettings: string;
    settingsUpdated: string;
    unavailable: string;
    requestFailed: string;

    credentials: {
      title: string;
      description: string;
      statusConnected: string;
      statusNotConnected: string;
      saveButton: string;
      saving: string;
      testConnection: string;
      testing: string;
      testSuccess: string;
      testFailed: string;
      testResultOk: string;
      testRecipientLabel: string;
      testRecipientPlaceholder: string;
      tokenMasked: string;
      tokenPlaceholder: string;
      tokenHidden: string;
      saveSuccess: string;
      requestFailed: string;
      fields: {
        wabaId: string;
        wabaIdPlaceholder: string;
        phoneNumberId: string;
        phoneNumberIdPlaceholder: string;
        accessToken: string;
        accessTokenPlaceholder: string;
        templateNamespace: string;
        templateNamespacePlaceholder: string;
      };
    };

    templateVariables: {
      title: string;
      availableVars: string;
    };

    log: {
      title: string;
      empty: string;
      requestFailed: string;
      statusFilter: string;
      channelFilter: string;
      allStatuses: string;
      allChannels: string;
      columns: {
        sentAt: string;
        event: string;
        channel: string;
        recipient: string;
        status: string;
        externalId: string;
        failedReason: string;
      };
      statusLabels: {
        pending: string;
        sent: string;
        failed: string;
      };
    };
  };

  backups: {
    eyebrow: string;
    title: string;
    description: string;
    statusFilter: string;
    backupTasks: string;
    emptyTitle: string;
    emptyBody: string;
    scopeLabel: string;
    columns: {
      created: string;
      taskId: string;
      scope: string;
      status: string;
      requestedBy: string;
      started: string;
      finished: string;
      failure: string;
      action: string;
    };
    placeholders: {
      system: string;
      none: string;
    };
    selectHint: string;
    selectAction: string;
    manualBackup: {
      title: string;
      description: string;
      reason: string;
      reasonPlaceholder: string;
      creating: string;
      action: string;
      createdToast: string;
    };
    restoreRequest: {
      title: string;
      description: string;
      reason: string;
      reasonPlaceholder: string;
      submitting: string;
      action: string;
      submittedToast: string;
    };
  };
};
