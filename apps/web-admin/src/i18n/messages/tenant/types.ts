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
    guestCustomer: string;
    branchFallback: string;
    emptyTitle: string;
    emptyDescription: string;
    loadError: string;
    overviewError: string;
    pageSummary: string;
    transfer: {
      importAction: string;
      exportAction: string;
      exporting: string;
      importTitle: string;
      importDescription: string;
      templateAction: string;
      fileLabel: string;
      fileHint: string;
      readySummary: string;
      submitImport: string;
      importing: string;
      importSuccess: string;
      importPartial: string;
      importFailed: string;
      exportEmpty: string;
      exportFailed: string;
      fileTooLarge: string;
      errorsTitle: string;
      failuresTitle: string;
      parseErrors: {
        empty: string;
        malformed: string;
        missingHeaders: string;
        missingValues: string;
        invalidValue: string;
        conflictingOrder: string;
        tooManyRows: string;
        tooManyOrders: string;
      };
      columns: {
        orderNumber: string;
        orderId: string;
        customer: string;
        customerId: string;
        branch: string;
        branchId: string;
        type: string;
        itemCount: string;
        itemNames: string;
        subtotal: string;
        discount: string;
        total: string;
        currency: string;
        paid: string;
        paymentStatus: string;
        orderStatus: string;
        notes: string;
        createdAt: string;
        updatedAt: string;
      };
    };
    detail: {
      breadcrumbLabel: string;
      backToOrders: string;
      openOrder: string;
      summaryTitle: string;
      itemsTitle: string;
      itemName: string;
      itemCount: string;
      workflowTitle: string;
      paymentTitle: string;
      paymentTransactionsTitle: string;
      paymentTransactionsEmpty: string;
      paymentReference: string;
      paymentMethodLabels: {
        cash: string;
        card: string;
        app: string;
      };
      paymentProviderLabels: {
        wave: string;
        orange_money: string;
      };
      paymentTransactionStatusLabels: {
        pending: string;
        paid: string;
        refunded: string;
        failed: string;
      };
      customerTitle: string;
      orderDetailsTitle: string;
      createdMeta: string;
      printAction: string;
      itemColor: string;
      defectNotes: string;
      specialRequest: string;
      itemIdentifier: string;
      staffOnly: string;
      actions: {
        recordPayment: string;
        markReceived: string;
        markDelivered: string;
        cancelOrder: string;
        noteLabel: string;
        reasonLabel: string;
        notePlaceholder: string;
        confirm: string;
        submitting: string;
        statusSuccess: string;
        statusError: string;
        paymentTitle: string;
        paymentDescription: string;
        amountLabel: string;
        balanceHint: string;
        paymentSuccess: string;
        paymentError: string;
        dialogTitles: {
          received: string;
          delivered: string;
          cancelled: string;
        };
        dialogDescriptions: {
          received: string;
          delivered: string;
          cancelled: string;
        };
      };
      itemEditor: {
        addAction: string;
        editAction: string;
        deleteAction: string;
        addTitle: string;
        editTitle: string;
        description: string;
        noServices: string;
        serviceLabel: string;
        servicePlaceholder: string;
        quantityLabel: string;
        weightLabel: string;
        bagCountLabel: string;
        unitPriceLabel: string;
        overrideReasonLabel: string;
        overrideReasonPlaceholder: string;
        standardPriceHint: string;
        saveAction: string;
        createSuccess: string;
        updateSuccess: string;
        saveError: string;
        deleteTitle: string;
        deleteDescription: string;
        deleteReasonLabel: string;
        deleteReasonPlaceholder: string;
        deleteSuccess: string;
        deleteError: string;
      };
      paymentAdjustments: {
        refundAction: string;
        correctionAction: string;
        historyTitle: string;
        refundTitle: string;
        correctionTitle: string;
        description: string;
        directionLabel: string;
        directionLabels: {
          debit: string;
          credit: string;
        };
        amountLabel: string;
        maximumHint: string;
        reasonLabel: string;
        reasonPlaceholder: string;
        confirmAction: string;
        refundSuccess: string;
        correctionSuccess: string;
        saveError: string;
        typeLabels: {
          refund: string;
          correction: string;
        };
      };
      workflowStatusLabels: {
        draft: string;
        received: string;
        paid: string;
        delivered: string;
        cancelled: string;
      };
      totalsTitle: string;
      notesTitle: string;
      subtotal: string;
      discount: string;
      total: string;
      paid: string;
      balance: string;
      quantity: string;
      unitPrice: string;
      lineTotal: string;
      notProvided: string;
      timeline: {
        title: string;
        commentPlaceholder: string;
        postAction: string;
        posting: string;
        loadMore: string;
        loadingMore: string;
        empty: string;
        loadError: string;
        postError: string;
        editAction: string;
        deleteAction: string;
        saveAction: string;
        cancelAction: string;
        saving: string;
        deleting: string;
        editError: string;
        deleteError: string;
        deleteTitle: string;
        deleteDescription: string;
        deleteConfirm: string;
        emojiAction: string;
        mentionAction: string;
        referencePageAction: string;
        mentionSearchPlaceholder: string;
        noMentionResults: string;
        removeMention: string;
        attachAction: string;
        attachmentTypeInvalid: string;
        attachmentTooLarge: string;
        attachmentLimit: string;
        attachmentUploadFailed: string;
        removeAttachment: string;
        systemActor: string;
        edited: string;
        today: string;
        yesterday: string;
        events: {
          orderCreated: string;
          orderUpdated: string;
          orderDeleted: string;
          statusChanged: string;
          itemAdded: string;
          itemUpdated: string;
          itemDeleted: string;
          paymentCreated: string;
          paymentPending: string;
          paymentConfirmed: string;
          paymentFailed: string;
          paymentCorrected: string;
          paymentRefunded: string;
          discountApplied: string;
          discountRemoved: string;
          zeroTotalConfirmed: string;
          ticketCreated: string;
          ticketUpdated: string;
          ticketStatusChanged: string;
          ticketItemAdded: string;
          ticketItemUpdated: string;
          ticketItemStatusChanged: string;
          ticketItemRemoved: string;
          deliveryStatusChanged: string;
          unknown: string;
        };
        statusLabels: {
          draft: string;
          received: string;
          paid: string;
          delivered: string;
          cancelled: string;
          pending: string;
          in_progress: string;
          ready_to_pick: string;
          picked_up: string;
          exception: string;
          pending_wash: string;
          washing: string;
          done: string;
          pending_dispatch: string;
          en_route: string;
          arrived: string;
          delivering: string;
          signed: string;
          failed: string;
          refunded: string;
        };
      };
    };
  };

  customers: {
    title: string;
    tabs: {
      customers: string;
      accounts: string;
    };
    accounts: {
      title: string;
      description: string;
      searchLabel: string;
      searchPlaceholder: string;
      statusLabel: string;
      allStatuses: string;
      sortLabel: string;
      metrics: {
        label: string;
        totalAccounts: string;
        activeAccounts: string;
        disabledAccounts: string;
        linkedCustomers: string;
      };
      sortOptions: {
        createdDesc: string;
        createdAsc: string;
        nameAsc: string;
        nameDesc: string;
      };
      columns: {
        account: string;
        customers: string;
        phone: string;
        email: string;
        status: string;
        createdAt: string;
        actions: string;
      };
      emptyTitle: string;
      emptyDescription: string;
      filteredEmptyTitle: string;
      filteredEmptyDescription: string;
      loadError: string;
      pageSummary: string;
      detail: {
        breadcrumbLabel: string;
        backToAccounts: string;
        openAccount: string;
        editAction: string;
        summaryTitle: string;
        linkedCustomersTitle: string;
        linkedCustomersDescription: string;
        linkedCustomersEmpty: string;
        recordDetailsTitle: string;
        accountId: string;
        accountName: string;
        phone: string;
        email: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        version: string;
        editTitle: string;
        editDescription: string;
        saveAction: string;
        saveSuccess: string;
        saveError: string;
        versionConflict: string;
        contactRequired: string;
        accountNameRequired: string;
        phoneConflict: string;
        emailConflict: string;
      };
    };
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
      actions: string;
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
    detail: {
      breadcrumbLabel: string;
      backToCustomers: string;
      openCustomer: string;
      editAction: string;
      editDescription: string;
      fullName: string;
      status: string;
      saveAction: string;
      saveSuccess: string;
      saveError: string;
      versionConflict: string;
      fullNameRequired: string;
      profileTitle: string;
      contactTitle: string;
      accountTitle: string;
      recordDetailsTitle: string;
      recentOrdersTitle: string;
      recentOrdersDescription: string;
      recentOrdersEmpty: string;
      relationship: string;
      address: string;
      notes: string;
      customerId: string;
      accountId: string;
      createdAt: string;
      updatedAt: string;
      accountCreatedAt: string;
      accountStatus: string;
      timeline: {
        title: string;
        events: {
          profileCreated: string;
          profileUpdated: string;
          profileStatusChanged: string;
          profileDeleted: string;
          accountCreated: string;
          accountUpdated: string;
          accountStatusChanged: string;
          accountDeleted: string;
          unknown: string;
        };
      };
    };
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
      currencyFromSettings: string;
      existingCurrencyNotice: string;
      changeDefaultCurrency: string;
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
    edit: {
      title: string;
      saveProduct: string;
      updated: string;
      updateFailed: string;
      loadFailed: string;
      versionConflict: string;
      inventoryConflict: string;
      multipleSkuNotice: string;
      stockOnHand: string;
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

  discounts: {
    title: string;
    description: string;
    createAction: string;
    exportAction: string;
    exportCurrentPage: string;
    exportCurrentSearch: string;
    exportEmpty: string;
    created: string;
    updated: string;
    statusUpdated: string;
    deleted: string;
    loadError: string;
    optionsLoadError: string;
    permissionDescription: string;
    emptyTitle: string;
    emptyDescription: string;
    pageCount: string;
    statuses: {
      all: string;
      active: string;
      scheduled: string;
      expired: string;
      inactive: string;
    };
    methods: {
      all: string;
      code: string;
      automatic: string;
    };
    types: {
      all: string;
      amount_off_items: string;
      amount_off_order: string;
      buy_x_get_y: string;
      free_shipping: string;
    };
    valueTypes: {
      percentage: string;
      fixed_amount: string;
      free: string;
    };
    eligibility: {
      all_customers: string;
      specific_customers: string;
    };
    minimumRequirements: {
      none: string;
      minimum_amount: string;
      minimum_quantity: string;
    };
    purchaseRequirements: {
      minimum_amount: string;
      minimum_quantity: string;
    };
    targetTypes: {
      product: string;
      product_category: string;
      service: string;
      service_category: string;
    };
    targetRoles: {
      applies_to: string;
      customer_buys: string;
      customer_gets: string;
    };
    countryScopes: {
      all: string;
      selected: string;
    };
    list: {
      searchPlaceholder: string;
      filterStatus: string;
      filterMethod: string;
      filterType: string;
      filterBranch: string;
      allBranches: string;
      sortLabel: string;
      sortOptions: {
        createdDesc: string;
        createdAsc: string;
        updatedDesc: string;
        titleAsc: string;
        titleDesc: string;
        startsDesc: string;
        usageDesc: string;
      };
      columns: {
        discount: string;
        status: string;
        method: string;
        type: string;
        value: string;
        combinations: string;
        uses: string;
        startsAt: string;
        endsAt: string;
        actions: string;
      };
      noCode: string;
      unlimited: string;
      noEndDate: string;
      noCombinations: string;
      combinationItem: string;
      combinationOrder: string;
      combinationShipping: string;
      enabledValue: string;
      disabledValue: string;
      edit: string;
      enable: string;
      disable: string;
      delete: string;
      deleteTitle: string;
      deleteDescription: string;
      confirmDelete: string;
      exportTitle: string;
    };
    typePicker: {
      title: string;
      description: string;
      amountOffItemsDescription: string;
      amountOffOrderDescription: string;
      buyXGetYDescription: string;
      freeShippingDescription: string;
    };
    form: {
      createTitle: string;
      editTitle: string;
      breadcrumbLabel: string;
      requiredHint: string;
      sections: {
        identity: string;
        value: string;
        targets: string;
        minimum: string;
        eligibility: string;
        limits: string;
        combinations: string;
        dates: string;
        channels: string;
        branches: string;
        shipping: string;
        tags: string;
        summary: string;
      };
      fields: {
        title: string;
        method: string;
        code: string;
        enabled: string;
        valueType: string;
        valueAmount: string;
        currency: string;
        minimumRequirement: string;
        minimumPurchaseAmount: string;
        minimumQuantity: string;
        eligibility: string;
        usageLimit: string;
        oncePerCustomer: string;
        combinesWithItemDiscounts: string;
        combinesWithOrderDiscounts: string;
        combinesWithShippingDiscounts: string;
        startsAt: string;
        hasEndDate: string;
        endsAt: string;
        allBranches: string;
        selectedBranches: string;
        posEnabled: string;
        customerMobileEnabled: string;
        deliveryEnabled: string;
        buyRequirementType: string;
        buyRequirementValue: string;
        getQuantity: string;
        maxUsesPerOrder: string;
        countryScope: string;
        countryCodes: string;
        maximumShippingPrice: string;
        tags: string;
      };
      placeholders: {
        title: string;
        code: string;
        amount: string;
        quantity: string;
        usageLimit: string;
        countries: string;
        tags: string;
      };
      options: {
        allItems: string;
        specificTargets: string;
        unlimitedUsage: string;
        generateCode: string;
      };
      hints: {
        code: string;
        method: string;
        combinations: string;
        branches: string;
        channels: string;
        countries: string;
        tags: string;
        timezone: string;
        fixedCurrency: string;
      };
      buttons: {
        cancel: string;
        save: string;
        saving: string;
        addTargets: string;
        chooseCustomers: string;
        chooseBranches: string;
      };
      picker: {
        targetsTitle: string;
        targetsDescription: string;
        customersTitle: string;
        customersDescription: string;
        branchesTitle: string;
        branchesDescription: string;
        search: string;
        noMatches: string;
        selectedCount: string;
        confirm: string;
      };
      summary: {
        type: string;
        method: string;
        value: string;
        customers: string;
        branches: string;
        channels: string;
        schedule: string;
        noValue: string;
        selectedCount: string;
      };
      validation: {
        checkForm: string;
        titleRequired: string;
        titleTooLong: string;
        codeRequired: string;
        codeInvalid: string;
        valueInvalid: string;
        currencyRequired: string;
        minimumInvalid: string;
        usageLimitInvalid: string;
        customersRequired: string;
        targetsRequired: string;
        branchesRequired: string;
        buyRequirementInvalid: string;
        getQuantityInvalid: string;
        maxUsesPerOrderInvalid: string;
        datesInvalid: string;
        countriesRequired: string;
        shippingPriceInvalid: string;
        tagsInvalid: string;
        serverInvalid: string;
      };
      saveFailed: string;
      codeConflict: string;
      versionConflict: string;
      unsavedChanges: string;
    };
  };

  branches: {
    // 三页共享
    eyebrow: string;
    title: string;
    listDescription: string;
    newBranch: string;
    metrics: {
      total: string;
      active: string;
      inactive: string;
    };

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
      checkForm: string;
      businessHoursDescription: string;
      opensAt: string;
      closesAt: string;
      closed: string;
      weekdayLabels: {
        monday: string;
        tuesday: string;
        wednesday: string;
        thursday: string;
        friday: string;
        saturday: string;
        sunday: string;
      };
      uploadLogo: string;
      replaceLogo: string;
      removeLogo: string;
      logoHelp: string;
      logoPreviewAlt: string;
      logoTypeInvalid: string;
      logoTooLarge: string;
      logoUploadFailed: string;
      fields: {
        name: string;
        phone: string;
        currency: string;
        defaultLanguage: string;
        status: string;
        logo: string;
        receiptName: string;
        receiptPhone: string;
        address: string;
        receiptAddress: string;
        businessHours: string;
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
      posTerminals: {
        title: string;
        description: string;
        bind: string;
        manage: string;
        empty: string;
        loading: string;
        loadError: string;
        dialogTitle: string;
        dialogDescription: string;
        selectLabel: string;
        selectPlaceholder: string;
        currentBranch: string;
        binding: string;
        bound: string;
        bindHint: string;
      };
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
    sections: {
      basicInformation: string;
      basicInformationDescription: string;
      pricing: string;
      pricingDescription: string;
      operations: string;
      operationsDescription: string;
      locations: string;
      locationsDescription: string;
      catalogSettings: string;
      catalogSettingsDescription: string;
      status: string;
      organization: string;
      organizationDescription: string;
    };
    formLabels: {
      search: string;
      businessLine: string;
      status: string;
      name: string;
      shortName: string;
      code: string;
      category: string;
      description: string;
      internalNotes: string;
      turnaroundMinutes: string;
      locationScope: string;
      allBranches: string;
      selectedBranches: string;
      branchPriceOverride: string;
      branchTurnaroundOverride: string;
      displayOrder: string;
      pricing: string;
      labelRule: string;
      standardPrice: string;
      compareAtPrice: string;
      costPrice: string;
      currency: string;
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
      shortNamePlaceholder: string;
      codePlaceholder: string;
      generateCode: string;
      generatedCodeHint: string;
      categoryPlaceholder: string;
      descriptionPlaceholder: string;
      internalNotesPlaceholder: string;
      turnaroundHint: string;
      allBranchesHint: string;
      selectedBranchesHint: string;
      manageBranches: string;
      branchDialogDescription: string;
      branchSearchPlaceholder: string;
      noMatchingBranches: string;
      confirmBranchSelection: string;
      selectedBranchCount: string;
      branchDefaultPrice: string;
      branchDefaultTurnaround: string;
      inactiveBranch: string;
      noBranchesAvailable: string;
      branchesLoadFailed: string;
      compareAtPriceHint: string;
      costPriceHint: string;
      changeDefaultCurrency: string;
      displayOrderHint: string;
      pricingHint: string;
      existingCurrencyNotice: string;
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
      codeInvalid: string;
      codeDuplicate: string;
      shortNameTooLong: string;
      categoryRequired: string;
      categoryInvalid: string;
      descriptionTooLong: string;
      internalNotesTooLong: string;
      turnaroundMinutesInvalid: string;
      branchSettingsInvalid: string;
      branchRequired: string;
      displayOrderInvalid: string;
      pricingUnitInvalid: string;
      labelRuleInvalid: string;
      standardPriceInvalid: string;
      compareAtPriceInvalid: string;
      costPriceInvalid: string;
      currencyInvalid: string;
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
    };
    delete: {
      title: string;
      description: string;
      deleting: string;
      action: string;
    };
  };

  hardware: {
    eyebrow: string;
    title: string;
    description: string;
    addDevice: string;
    metrics: {
      total: string;
      active: string;
      inactive: string;
      printers: string;
    };
    noDevices: string;
    noTerminals: string;
    typeReadonlyHint: string;
    columns: {
      name: string;
      type: string;
      connection: string;
      terminal: string;
      status: string;
      created: string;
      actions: string;
    };
    create: {
      title: string;
      description: string;
      labels: {
        terminalId: string;
        terminalPlaceholder: string;
        deviceName: string;
        deviceType: string;
        connectionType: string;
      };
      adding: string;
      action: string;
      created: string;
    };
    edit: {
      title: string;
      labels: {
        deviceName: string;
        terminalId: string;
        connectionType: string;
        status: string;
      };
      savingChanges: string;
      saveChanges: string;
      updated: string;
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

  pointOfSale: {
    title: string;
    description: string;
    updatedAt: string;
    tabs: {
      overview: string;
      devices: string;
      hardware: string;
      registerSessions: string;
      settings: string;
    };
    filters: {
      dateRange: string;
      branch: string;
      allBranches: string;
      currency: string;
      status: string;
      allStatuses: string;
      search: string;
      clear: string;
    };
    presets: {
      today: string;
      last7Days: string;
      last30Days: string;
      last90Days: string;
      thisMonth: string;
      lastMonth: string;
    };
    overview: {
      noticeBadge: string;
      noticeTitle: string;
      noticeDescription: string;
      metricsLabel: string;
      metrics: {
        grossSales: string;
        grossProfit: string;
        orderCount: string;
        registeredDevices: string;
        openSessions: string;
        activeBranches: string;
      };
      grossProfitCoverage: string;
      branchPerformance: {
        title: string;
        description: string;
        branch: string;
        orders: string;
        grossSales: string;
        grossProfit: string;
        devices: string;
        empty: string;
      };
      devices: {
        title: string;
        description: string;
        active: string;
        inactive: string;
        online: string;
        offline: string;
        neverSeen: string;
        action: string;
      };
      cashTracking: {
        title: string;
        description: string;
        expectedCash: string;
        countedCash: string;
        variance: string;
        action: string;
      };
      staff: {
        title: string;
        description: string;
        onDuty: string;
        onBreak: string;
        offDuty: string;
      };
      quickLinks: {
        title: string;
        devices: string;
        devicesDescription: string;
        sessions: string;
        sessionsDescription: string;
        hardware: string;
        hardwareDescription: string;
        orders: string;
        ordersDescription: string;
        finance: string;
        financeDescription: string;
      };
      emptyTitle: string;
      emptyDescription: string;
      errorTitle: string;
      errorDescription: string;
    };
    devices: {
      title: string;
      description: string;
      setupGuide: string;
      setupNotice: string;
      metrics: {
        total: string;
        active: string;
        online: string;
        syncIssues: string;
      };
      searchPlaceholder: string;
      columns: {
        device: string;
        typePlatform: string;
        version: string;
        branch: string;
        enabledStatus: string;
        heartbeatStatus: string;
        lastSeen: string;
        syncStatus: string;
        currentSession: string;
      };
      deviceTypes: {
        desktop: string;
        tablet: string;
        phone: string;
        browser: string;
        unknown: string;
      };
      enabledStatuses: {
        active: string;
        inactive: string;
      };
      heartbeatStatuses: {
        online: string;
        offline: string;
        never: string;
      };
      syncStatuses: {
        synced: string;
        syncing: string;
        error: string;
        never: string;
      };
      noCurrentSession: string;
      neverSeen: string;
      empty: string;
      errorTitle: string;
      errorDescription: string;
      previous: string;
      next: string;
      count: string;
    };
    registerSessions: {
      title: string;
      description: string;
      exportCsv: string;
      metrics: {
        total: string;
        open: string;
        onBreak: string;
        closed: string;
        netSales: string;
        cashVariance: string;
      };
      searchPlaceholder: string;
      columns: {
        session: string;
        branch: string;
        terminal: string;
        staff: string;
        status: string;
        startedAt: string;
        endedAt: string;
        openingFloat: string;
        closingFloat: string;
        netSales: string;
        cashVariance: string;
      };
      statuses: {
        open: string;
        onBreak: string;
        closed: string;
      };
      roleLabels: {
        owner: string;
        manager: string;
        cashier: string;
      };
      notClosed: string;
      unavailable: string;
      empty: string;
      errorTitle: string;
      errorDescription: string;
      previous: string;
      next: string;
      count: string;
      exportHeaders: {
        id: string;
        branch: string;
        terminal: string;
        staff: string;
        status: string;
        startedAt: string;
        endedAt: string;
        openingFloat: string;
        closingFloat: string;
        netSales: string;
        cashVariance: string;
        currency: string;
      };
    };
    settings: {
      title: string;
      description: string;
      ownerOnlyTitle: string;
      ownerOnlyDescription: string;
      sections: {
        cashTracking: string;
        cashTrackingDescription: string;
        operations: string;
        operationsDescription: string;
        offline: string;
        offlineDescription: string;
        deviceDefaults: string;
        deviceDefaultsDescription: string;
      };
      fields: {
        cashTrackingEnabled: string;
        openingFloatRequired: string;
        closingCountRequired: string;
        returnReasonRequired: string;
        recentCartRetentionHours: string;
        offlineModeEnabled: string;
        syncIntervalSeconds: string;
        deviceOfflineAfterSeconds: string;
        defaultPaymentMethod: string;
        roundingRule: string;
        autoPrintReceipt: string;
        printCopies: string;
        lockTimeoutSeconds: string;
      };
      hints: {
        cashTrackingEnabled: string;
        openingFloatRequired: string;
        closingCountRequired: string;
        returnReasonRequired: string;
        recentCartRetentionHours: string;
        offlineModeEnabled: string;
        syncIntervalSeconds: string;
        deviceOfflineAfterSeconds: string;
        autoPrintReceipt: string;
      };
      paymentMethods: {
        cash: string;
        card: string;
        app: string;
      };
      roundingRules: {
        none: string;
        roundYuan: string;
        roundJiao: string;
      };
      seconds: string;
      minutes: string;
      hours: string;
      copies: string;
      validation: {
        offlineThresholdMinimum: string;
      };
      save: string;
      saving: string;
      saved: string;
      noChanges: string;
      loadError: string;
      saveError: string;
    };
  };

  reports: {
    title: string;
    generatedAt: string;
    hero: {
      badge: string;
      title: string;
      description: string;
      viewOrders: string;
      viewBranches: string;
    };
    performance: {
      title: string;
      description: string;
      dateRange: string;
      branch: string;
      allBranches: string;
      currency: string;
    };
    presets: {
      custom: string;
      today: string;
      last7Days: string;
      last30Days: string;
      last90Days: string;
      thisMonth: string;
      lastMonth: string;
    };
    customRange: {
      title: string;
      description: string;
      from: string;
      to: string;
      cancel: string;
      apply: string;
    };
    metrics: {
      grossSales: string;
      orders: string;
      averageOrderValue: string;
      customers: string;
    };
    salesTrend: {
      title: string;
      description: string;
      empty: string;
    };
    orderStatus: {
      title: string;
      description: string;
      empty: string;
      labels: {
        draft: string;
        received: string;
        paid: string;
        delivered: string;
        cancelled: string;
      };
    };
    payments: {
      title: string;
      description: string;
      empty: string;
    };
    paymentMethods: {
      cash: string;
      mobile: string;
      card: string;
      other: string;
    };
    operations: {
      title: string;
      description: string;
      pendingPickup: string;
      inProgress: string;
      overdue: string;
      snapshotHint: string;
    };
    insight: {
      badge: string;
      overdueTitle: string;
      overdueDescription: string;
      pickupTitle: string;
      pickupDescription: string;
      topBranchTitle: string;
      topBranchDescription: string;
      healthyTitle: string;
      healthyDescription: string;
      action: string;
    };
    branches: {
      title: string;
      description: string;
      branch: string;
      orders: string;
      sales: string;
      share: string;
      emptyTitle: string;
      emptyDescription: string;
    };
    errorTitle: string;
    errorDescription: string;
  };

  finance: {
    title: string;
    description: string;
    generatedAt: string;
    documentation: string;
    exportCsv: string;
    exporting: string;
    notice: {
      badge: string;
      title: string;
      description: string;
    };
    filters: {
      dateRange: string;
      branch: string;
      allBranches: string;
      currency: string;
    };
    presets: {
      today: string;
      last7Days: string;
      last30Days: string;
      last90Days: string;
      thisMonth: string;
      lastMonth: string;
      custom: string;
    };
    customRange: {
      title: string;
      description: string;
      from: string;
      to: string;
      cancel: string;
      apply: string;
    };
    overview: {
      title: string;
      description: string;
      netCollected: string;
      netCollectedHint: string;
      grossCollected: string;
      refunds: string;
      corrections: string;
      transactions: string;
      paidOrders: string;
    };
    trend: {
      title: string;
      description: string;
      grossCollected: string;
      netCollected: string;
      empty: string;
    };
    position: {
      title: string;
      description: string;
      pendingRefunds: string;
      pendingRefundCount: string;
      outstandingOrders: string;
      outstandingOrderCount: string;
    };
    tools: {
      title: string;
      reports: string;
      reportsDescription: string;
      orders: string;
      ordersDescription: string;
    };
    paymentMethods: {
      title: string;
      description: string;
      gross: string;
      refunds: string;
      net: string;
      transactions: string;
      labels: {
        cash: string;
        card: string;
        app: string;
        unknown: string;
      };
      empty: string;
    };
    branches: {
      title: string;
      description: string;
      branch: string;
      gross: string;
      refunds: string;
      net: string;
      transactions: string;
      empty: string;
    };
    activity: {
      title: string;
      description: string;
      date: string;
      transaction: string;
      branch: string;
      method: string;
      status: string;
      amount: string;
      order: string;
      kinds: {
        payment: string;
        refund: string;
        correction: string;
      };
      directions: {
        credit: string;
        debit: string;
      };
      statuses: {
        paid: string;
        refunded: string;
        completed: string;
      };
      empty: string;
    };
    exportHeaders: {
      id: string;
      date: string;
      type: string;
      direction: string;
      status: string;
      amount: string;
      currency: string;
      method: string;
      branch: string;
      order: string;
    };
    errorTitle: string;
    errorDescription: string;
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
      resultsTitle: string;
      resultCount: string;
      emptyTitle: string;
      emptyDescription: string;
      dataResultsTitle: string;
      navigationResultsTitle: string;
      loadingLabel: string;
      loadError: string;
      groupLabels: {
        orders: string;
        customers: string;
        products: string;
        services: string;
        branches: string;
        users: string;
      };
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
      reports: string;
    };
    unavailable: string;
    requestFailed: string;
  };

  settings: {
    eyebrow: string;
    description: string;
    navigation: {
      ariaLabel: string;
      searchLabel: string;
      searchPlaceholder: string;
      workspaceSubtitle: string;
      closeLabel: string;
      noResults: string;
      accountFallback: string;
      roleLabels: {
        super_admin: string;
        support: string;
        owner: string;
        manager: string;
        cashier: string;
      };
      items: {
        general: string;
        locations: string;
        pricing: string;
        pointOfSale: string;
        hardware: string;
        activityLog: string;
      };
    };
    general: {
      title: string;
      businessDetailsTitle: string;
      businessDetailsDescription: string;
      entityLabel: string;
      businessDetailsHint: string;
      readOnlyTitle: string;
      storeDefaultsTitle: string;
      storeDefaultsDescription: string;
      languageHint: string;
      timezoneHint: string;
      featureAccessTitle: string;
      featureAccessDescription: string;
      resourcesTitle: string;
      resourcesDescription: string;
      resourceDescriptions: {
        general: string;
        locations: string;
        pricing: string;
        pointOfSale: string;
        hardware: string;
        activityLog: string;
      };
    };
    pricingHub: {
      title: string;
      description: string;
      defaultCurrencyTitle: string;
      defaultCurrencyDescription: string;
      defaultCurrencyHint: string;
      saveDefaultCurrency: string;
      productsTitle: string;
      productsDescription: string;
      servicesTitle: string;
      servicesDescription: string;
      openProducts: string;
      openServices: string;
      noteTitle: string;
      noteDescription: string;
    };
    pilotStatusLabels: {
      pilot: string;
      live: string;
      paused: string;
    };
    languageLabels: {
      en: string;
      fr: string;
      "zh-CN": string;
    };
    featureFlagLabels: {
      laundryEnabled: string;
      carWashEnabled: string;
      retailProductsEnabled: string;
      deliveryEnabled: string;
      notificationsEnabled: string;
    };
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

  notificationCenter: {
    eyebrow: string;
    title: string;
    description: string;
    stats: {
      total: string;
      unread: string;
      urgent: string;
    };
    toolbar: {
      searchPlaceholder: string;
      searchLabel: string;
      filters: string;
      refresh: string;
      readStatus: string;
      noticeType: string;
      priority: string;
      all: string;
      unread: string;
      read: string;
      business: string;
      system: string;
      low: string;
      normal: string;
      high: string;
      critical: string;
    };
    table: {
      notification: string;
      type: string;
      priority: string;
      status: string;
      time: string;
      actions: string;
      markRead: string;
      archive: string;
      openOrder: string;
    };
    status: {
      unread: string;
      read: string;
      archived: string;
    };
    empty: string;
    loadError: string;
    retry: string;
    previous: string;
    next: string;
    pageSummary: string;
    updated: string;
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

  profile: {
    title: string;
    description: string;
    tenantCode: string;
    branchCount: string;
    notProvided: string;
    never: string;
    saveProfile: string;
    saving: string;
    retry: string;
    loadErrorTitle: string;
    loadErrorDescription: string;
    personal: {
      title: string;
      description: string;
      displayName: string;
      displayNameHint: string;
      email: string;
      emailHint: string;
      phone: string;
      phoneHint: string;
    };
    account: {
      title: string;
      email: string;
      phone: string;
      lastLogin: string;
      createdAt: string;
    };
    access: {
      title: string;
      description: string;
      roles: string;
      branches: string;
      allBranches: string;
      unknownBranch: string;
      noRoles: string;
      noBranches: string;
    };
    security: {
      title: string;
      description: string;
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
      showPassword: string;
      hidePassword: string;
      requirementsTitle: string;
      minimumLength: string;
      requiresNumber: string;
      requiresSymbol: string;
      signOutNotice: string;
      changePassword: string;
      changingPassword: string;
    };
    devices: {
      title: string;
      description: string;
      currentDevice: string;
      unknownBrowser: string;
      unknownOperatingSystem: string;
      ipAddress: string;
      unknownIp: string;
      lastActive: string;
      signedInAt: string;
      expiresAt: string;
      showAll: string;
      showLess: string;
      revoke: string;
      revoking: string;
      revokeDialogTitle: string;
      revokeDialogDescription: string;
      cancel: string;
      confirmRevoke: string;
      revokeSuccess: string;
      revokeFailed: string;
      sessionNotFound: string;
      currentSessionForbidden: string;
      loadErrorTitle: string;
      loadErrorDescription: string;
      emptyTitle: string;
      emptyDescription: string;
    };
    statusLabels: {
      invited: string;
      active: string;
      disabled: string;
      suspended: string;
    };
    branchStatusLabels: {
      active: string;
      inactive: string;
    };
    validation: {
      displayNameRequired: string;
      displayNameTooLong: string;
      emailRequired: string;
      emailInvalid: string;
      emailTooLong: string;
      phoneTooLong: string;
      currentPasswordRequired: string;
      newPasswordRequired: string;
      passwordTooShort: string;
      passwordNumberRequired: string;
      passwordSymbolRequired: string;
      passwordConfirmationMismatch: string;
    };
    feedback: {
      profileSaved: string;
      upToDate: string;
      checkForm: string;
      checkPassword: string;
      passwordChanged: string;
      currentPasswordIncorrect: string;
      passwordUnchanged: string;
      passwordPolicyViolation: string;
      emailConflict: string;
      conflict: string;
      notFound: string;
      requestFailed: string;
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
