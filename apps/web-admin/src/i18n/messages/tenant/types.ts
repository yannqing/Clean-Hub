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

  navigationPlaceholders: {
    orders: {
      title: string;
      description: string;
    };
    customers: {
      title: string;
      description: string;
    };
    products: {
      title: string;
      description: string;
    };
  };

  orders: {
    title: string;
    description: string;
    metrics: {
      label: string;
      totalOrders: string;
      totalAmount: string;
      paidAmount: string;
      pendingPayment: string;
    };
    toolbar: {
      statusLabel: string;
      allStatusesOption: string;
      dateLabel: string;
      dateOptions: {
        today: string;
        last7Days: string;
        last30Days: string;
        last365Days: string;
        all: string;
      };
      searchLabel: string;
      searchPlaceholder: string;
      settingsLabel: string;
      sortTitle: string;
      columnsTitle: string;
      sortOptions: {
        createdDesc: string;
        createdAsc: string;
        amountDesc: string;
        amountAsc: string;
      };
    };
    listTitle: string;
    totalResults: string;
    columns: {
      order: string;
      customer: string;
      branch: string;
      type: string;
      items: string;
      amount: string;
      payment: string;
      status: string;
      createdAt: string;
    };
    typeLabels: {
      ticket: string;
      manual: string;
    };
    statusLabels: {
      draft: string;
      received: string;
      paid: string;
      delivered: string;
      cancelled: string;
    };
    paymentStatusLabels: {
      unpaid: string;
      paid: string;
      partial: string;
      refunded: string;
    };
    paidAmount: string;
    unknownCustomer: string;
    branchFallback: string;
    emptyTitle: string;
    emptyDescription: string;
    loadError: string;
    overviewError: string;
    pageSummary: string;
  };

  customers: {
    title: string;
    metrics: {
      label: string;
      totalCustomers: string;
      activeCustomers: string;
      disabledCustomers: string;
      linkedAccounts: string;
    };
    toolbar: {
      statusLabel: string;
      allStatusesOption: string;
      dateLabel: string;
      dateOptions: {
        today: string;
        last7Days: string;
        last30Days: string;
        last365Days: string;
        all: string;
      };
      searchLabel: string;
      searchPlaceholder: string;
      settingsLabel: string;
      sortTitle: string;
      columnsTitle: string;
      sortOptions: {
        createdDesc: string;
        createdAsc: string;
        nameAsc: string;
        nameDesc: string;
      };
    };
    columns: {
      customer: string;
      account: string;
      phone: string;
      email: string;
      status: string;
      createdAt: string;
    };
    statusLabels: {
      active: string;
      disabled: string;
    };
    notProvided: string;
    emptyTitle: string;
    emptyDescription: string;
    filteredEmptyTitle: string;
    filteredEmptyDescription: string;
    loadError: string;
    pageSummary: string;
  };

  products: {
    title: string;
    metrics: {
      label: string;
      totalProducts: string;
      activeProducts: string;
      totalSkus: string;
      lowStockSkus: string;
    };
    toolbar: {
      statusLabel: string;
      allStatusesOption: string;
      importAction: string;
      exportAction: string;
      addProductAction: string;
      dateLabel: string;
      dateOptions: {
        today: string;
        last7Days: string;
        last30Days: string;
        last365Days: string;
        all: string;
      };
      searchLabel: string;
      searchPlaceholder: string;
      settingsLabel: string;
      sortTitle: string;
      columnsTitle: string;
      sortOptions: {
        createdDesc: string;
        createdAsc: string;
        nameAsc: string;
        nameDesc: string;
        stockDesc: string;
        stockAsc: string;
      };
    };
    create: {
      title: string;
      breadcrumbLabel: string;
      requiredHint: string;
      saveProduct: string;
      created: string;
      createFailed: string;
      productConflict: string;
      mediaCreateConflict: string;
      checkForm: string;
      loadFailed: string;
      removeTag: string;
      removeImage: string;
      managePublishing: string;
      branchDialogDescription: string;
      branchSearchPlaceholder: string;
      noMatchingBranches: string;
      confirmBranchSelection: string;
      selectedBranchCount: string;
      addTags: string;
      addTag: string;
      tagSearchPlaceholder: string;
      tagEmpty: string;
      richText: {
        toolbarLabel: string;
        bold: string;
        italic: string;
        underline: string;
        bulletList: string;
        numberedList: string;
        clearFormatting: string;
      };
      addImages: string;
      mediaHelp: string;
      mediaTypeInvalid: string;
      mediaTooLarge: string;
      mediaLimitReached: string;
      mediaUploadFailed: string;
      unsavedChanges: string;
      showMoreSettings: string;
      hideMoreSettings: string;
      categoryMetafields: {
        uncategorized: string;
        loading: string;
        loadFailed: string;
        retry: string;
        noAttributes: string;
        recommended: string;
        textPlaceholder: string;
        chooseValue: string;
        chooseValues: string;
        noOptions: string;
        selectedValues: string;
        required: string;
        add: string;
        remove: string;
        added: string;
        removed: string;
        changeConfirm: string;
      };
      taxonomy: {
        categories: Record<string, string>;
        attributes: Record<string, string>;
        options: Record<string, string>;
      };
      validation: {
        nameRequired: string;
        nameTooLong: string;
        categoryInvalid: string;
        categoryAttributeValueRequired: string;
        categoryAttributesInvalid: string;
        tooManyCategoryAttributes: string;
        brandTooLong: string;
        descriptionTooLong: string;
        tooManyTags: string;
        tagTooLong: string;
        tooManyMedia: string;
        mediaInvalid: string;
        statusInvalid: string;
        skuCodeRequired: string;
        skuCodeTooLong: string;
        skuCodeDuplicate: string;
        barcodeTooLong: string;
        barcodeDuplicate: string;
        variantNameTooLong: string;
        unitOfMeasureRequired: string;
        unitOfMeasureTooLong: string;
        unitsPerSaleInvalid: string;
        salePriceInvalid: string;
        currencyInvalid: string;
        referenceCostInvalid: string;
        branchRequired: string;
        branchInvalid: string;
        branchDuplicate: string;
        branchInventoryInvalid: string;
        serverInvalid: string;
      };
      fields: {
        name: string;
        category: string;
        categoryMetafields: string;
        brand: string;
        status: string;
        publishBranches: string;
        tags: string;
        media: string;
        description: string;
        skuCode: string;
        barcode: string;
        variantName: string;
        unitOfMeasure: string;
        unitsPerSale: string;
        salePrice: string;
        currency: string;
        referenceCost: string;
        profit: string;
        profitMargin: string;
        trackInventory: string;
        openingStock: string;
        reorderPoint: string;
        branch: string;
        allowNegativeStock: string;
        allowOfflineSale: string;
      };
      placeholders: {
        name: string;
        category: string;
        brand: string;
        description: string;
        skuCode: string;
        barcode: string;
        variantName: string;
        currency: string;
        tags: string;
      };
      unitOptions: {
        piece: string;
        box: string;
        bottle: string;
        pack: string;
      };
    };
    columns: {
      product: string;
      category: string;
      sku: string;
      price: string;
      inventory: string;
      status: string;
      createdAt: string;
    };
    statusLabels: {
      active: string;
      inactive: string;
    };
    skuCount: string;
    stockOnHand: string;
    stockReserved: string;
    lowStock: string;
    noBrand: string;
    noCategory: string;
    noSku: string;
    noBarcode: string;
    noPrice: string;
    inventoryNotTracked: string;
    featureDisabledTitle: string;
    featureDisabledDescription: string;
    emptyTitle: string;
    emptyDescription: string;
    filteredEmptyTitle: string;
    filteredEmptyDescription: string;
    loadError: string;
    overviewError: string;
    pageSummary: string;
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

  services: {
    eyebrow: string;
    title: string;
    searchPlaceholder: string;
    metrics: {
      label: string;
      totalServices: string;
      activeServices: string;
      inactiveServices: string;
      businessLines: string;
    };
    toolbar: {
      filterLabel: string;
      dateLabel: string;
      dateOptions: {
        today: string;
        last7Days: string;
        last30Days: string;
        last365Days: string;
        all: string;
      };
      searchLabel: string;
      settingsLabel: string;
      sortTitle: string;
      columnsTitle: string;
      sortOptions: {
        createdDesc: string;
        createdAsc: string;
        nameAsc: string;
        nameDesc: string;
      };
    };
    formLabels: {
      search: string;
      businessLine: string;
      status: string;
      name: string;
      category: string;
      description: string;
      displayOrder: string;
      pricing: string;
      labelRule: string;
      standardPrice: string;
    };
    labelRuleLabels: {
      none: string;
      per_item: string;
      per_order_item: string;
      per_bag: string;
    };
    formButtons: {
      createService: string;
      updateService: string;
      cancelEdit: string;
      saving: string;
    };
    create: {
      title: string;
      breadcrumbLabel: string;
      namePlaceholder: string;
      categoryPlaceholder: string;
      descriptionPlaceholder: string;
      displayOrderHint: string;
      pricingHint: string;
      categoriesLoadFailed: string;
      currencyLoadFailed: string;
      noCategoriesForBusinessLine: string;
      created: string;
      createFailed: string;
      nameConflict: string;
      checkForm: string;
      unsavedChanges: string;
    };
    validation: {
      businessLineInvalid: string;
      nameRequired: string;
      nameTooLong: string;
      categoryRequired: string;
      categoryInvalid: string;
      descriptionTooLong: string;
      displayOrderInvalid: string;
      pricingUnitInvalid: string;
      labelRuleInvalid: string;
      standardPriceInvalid: string;
      statusInvalid: string;
      versionRequired: string;
    };
    columns: {
      service: string;
      category: string;
      businessLine: string;
      pricing: string;
      status: string;
      createdAt: string;
      actions: string;
    };
    actions: {
      add: string;
      menu: string;
      activate: string;
      deactivate: string;
      delete: string;
      edit: string;
      managePrice: string;
    };
    empty: string;
    emptyDescription: string;
    filteredEmptyTitle: string;
    filteredEmptyDescription: string;
    deletedToast: string;
    savedToast: string;
    statusUpdatedToast: string;
    formFallbackError: string;
    requestFailed: string;
    versionConflict: string;
    pageSummary: string;
    formDialog: {
      createTitle: string;
      createDescription: string;
      editTitle: string;
      editDescription: string;
      categoriesLoading: string;
      categoriesLoadFailed: string;
      priceManagedSeparately: string;
    };
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
    versionConflict: string;
    updatePrice: string;
  };

  hardware: {
    eyebrow: string;
    title: string;
    addDevice: string;
    noDevices: string;
    noBranches: string;
    typeReadonlyHint: string;
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
        branchId: string;
        connectionType: string;
        status: string;
      };
      savingChanges: string;
      saveChanges: string;
    };
    delete: {
      title: string;
      description: string;
      deleting: string;
      action: string;
    };
    actions: {
      edit: string;
      delete: string;
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
    allEventTypes: string;
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
    welcomeTitle: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchComposer: {
      addContextLabel: string;
      contextMenuLabel: string;
      sendLabel: string;
      recommendationsTitle: string;
      contextTypes: {
        file: {
          label: string;
          description: string;
        };
        mention: {
          label: string;
          description: string;
        };
        branch: {
          label: string;
          description: string;
        };
        user: {
          label: string;
          description: string;
        };
      };
      recommendations: string[];
    };
    quickEntries: {
      branches: {
        title: string;
        description: string;
      };
      services: {
        title: string;
        description: string;
      };
      prices: {
        title: string;
        description: string;
      };
      hardware: {
        title: string;
        description: string;
      };
      reports: {
        title: string;
        description: string;
      };
    };
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
    restoreStatusLabels: {
      pending: string;
      approved: string;
      rejected: string;
      completed: string;
      cancelled: string;
    };
    restoreList: {
      title: string;
      empty: string;
      requestFailed: string;
      columns: {
        created: string;
        status: string;
        reason: string;
      };
    };
  };
};
