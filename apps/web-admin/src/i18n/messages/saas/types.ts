export type SaasMessages = {
  common: {
    refresh: string;
    clear: string;
    clearFilters: string;
    search: string;
    status: string;
    allStatuses: string;
    allLevels: string;
    allCategories: string;
    allResults: string;
    allScopes: string;
    allPriorities: string;
    tryAgain: string;
    cancel: string;
    saving: string;
    creating: string;
    submitting: string;
    updating: string;
    saveChanges: string;
    actions: string;
    created: string;
    from: string;
    to: string;
    platform: string;
    system: string;
    unknown: string;
    never: string;
    notSet: string;
    invalidDate: string;
    previousPage: string;
    nextPage: string;
    optionalUlid: string;
    optionalTenantUlid: string;
    modulePlaceholder: string;
    badge: string;
    // 全局错误/未找到兜底文案（app/error.tsx、app/not-found.tsx 使用）
    somethingWentWrong: string;
    loadErrorDescription: string;
    notFoundTitle: string;
    notFoundDescription: string;
    statusLabels: {
      active: string;
      suspended: string;
      disabled: string;
      invited: string;
      open: string;
      inProgress: string;
      resolved: string;
      closed: string;
    };
    priorityLabels: {
      low: string;
      medium: string;
      high: string;
      urgent: string;
    };
    levelLabels: {
      debug: string;
      info: string;
      warn: string;
      error: string;
    };
    severityLabels: {
      low: string;
      medium: string;
      high: string;
      critical: string;
    };
    backupScopeLabels: {
      platform: string;
      tenant: string;
    };
    backupStatusLabels: {
      pending: string;
      running: string;
      succeeded: string;
      failed: string;
    };
    restoreStatusLabels: {
      pending: string;
      approved: string;
      rejected: string;
      completed: string;
      cancelled: string;
    };
    roleLabels: {
      support: string;
      superAdmin: string;
      unassigned: string;
    };
    languageLabels: {
      en: string;
      fr: string;
      zhCN: string;
      platformDefault: string;
    };
    resultLabels: {
      success: string;
      failed: string;
    };
  };
  overview: {
    badge: string;
    title: string;
    welcomeTitle: string;
    searchLabel: string;
    searchPlaceholder: string;
    quickActionsLabel: string;
    sendLabel: string;
    searchNoResults: string;
    searchLoading: string;
    loadError: string;
    quickEntries: {
      tenants: {
        title: string;
        description: string;
      };
      users: {
        title: string;
        description: string;
      };
      feedback: {
        title: string;
        description: string;
      };
      security: {
        title: string;
        description: string;
      };
    };
    metrics: {
      tenants: string;
      activeTenants: string;
      suspendedTenants: string;
      branches: string;
      todayOrders: string;
      todayRevenue: string;
      pendingFeedback: string;
    };
  };
  tenants: {
    identity: { systemId: string; systemIdHint: string; tenantCodeHint: string };
    list: {
      badge: string;
      title: string;
      newTenant: string;
      searchPlaceholder: string;
      metrics: {
        total: string;
        active: string;
        suspended: string;
        disabled: string;
      };
      emptyFiltered: string;
      emptyDefault: string;
      emptyTitle: string;
      loadError: string;
      columns: {
        name: string;
        pressingCode: string;
        status: string;
        country: string;
        city: string;
        createdAt: string;
      };
      detail: string;
      settings: string;
    };
    detail: {
      badge: string;
      title: string;
      settings: string;
      backToTenants: string;
      loadError: string;
      sessionError: string;
      notFoundTitle: string;
      notFoundDescription: string;
      statusSection: string;
      statusReasonHint: string;
      statusPermissionHint: string;
      reason: string;
      reasonPlaceholder: string;
      activate: string;
      suspend: string;
      disable: string;
      statusUpdated: string;
      statusUpdateFailed: string;
      statusPermissionError: string;
      readOnlyHint: string;
      offboardSection: string;
      offboardHint: string;
      offboardPermissionHint: string;
      offboardAction: string;
      offboardConfirm: string;
      offboardSucceeded: string;
      offboardFailed: string;
      offboardedBanner: string;
      purgeAfterLabel: string;
      restoreAction: string;
      restoreSucceeded: string;
      restoreFailed: string;
      exportAction: string;
      exportHint: string;
      exportSucceeded: string;
      exportFailed: string;
      tenantUsersTitle: string;
      tenantUsersHint: string;
      tenantUsersEmpty: string;
      tenantUsersLoading: string;
      tenantUsersLoadError: string;
      fields: {
        pressingCode: string;
        status: string;
        defaultLanguage: string;
        users: string;
        country: string;
        city: string;
        defaultCurrency: string;
        contactName: string;
        contactPhone: string;
        contactEmail: string;
        createdAt: string;
        updatedAt: string;
      };
    };
    new: {
      badge: string;
      title: string;
      backToTenants: string;
      sessionError: string;
      permissionHint: string;
    };
    settings: {
      badge: string;
      title: string;
      backToDetail: string;
      refresh: string;
      loadError: string;
      sessionError: string;
      notFoundTitle: string;
      notFoundDescription: string;
      defaultsSection: string;
      featureFlagsSection: string;
      featureFlagOptions: {
        laundryEnabled: { label: string; description: string };
        carWashEnabled: { label: string; description: string };
        retailProductsEnabled: { label: string; description: string };
        deliveryEnabled: { label: string; description: string };
        notificationsEnabled: { label: string; description: string };
        emailEnabled: { label: string; description: string };
        customerOtpEnabled: { label: string; description: string };
      };
      pilotSection: string;
      saveDefaults: string;
      saveFeatureFlags: string;
      defaultsSaved: string;
      defaultsSaveFailed: string;
      flagsSaved: string;
      flagsLoading: string;
      flagsLoadFailed: string;
      flagsSaveFailed: string;
      pilotStatus: string;
      enabledFeatures: string;
      readOnlyHint: string;
      statusPermissionHint: string;
      tenantUpdated: string;
      settingsUpdated: string;
      flagsUpdated: string;
    };
    form: {
      profileSection: string;
      defaultsSection: string;
      ownerSection: string;
      contactSection: string;
      createdToast: string;
      updatedToast: string;
      createTenant: string;
      autoGeneratedCode: string;
      initialCredentialHint: string;
      fields: {
        name: string;
        pressingCode: string;
        country: string;
        city: string;
        defaultLanguage: string;
        defaultCurrency: string;
        ownerName: string;
        ownerEmail: string;
        ownerPhone: string;
        ownerPin: string;
        ownerPassword: string;
        contactName: string;
        contactPhone: string;
        contactEmail: string;
      };
      featureFlags: {
        laundry: { label: string; description: string };
        carWash: { label: string; description: string };
        retail: { label: string; description: string };
        delivery: { label: string; description: string };
        notifications: { label: string; description: string };
      };
    };
  };
  users: {
    badge: string;
    title: string;
    accountTypeLabel: string;
    allAccounts: string;
    platformAccount: string;
    tenantAccount: string;
    directoryHint: string;
    tenantColumn: string;
    ownerRole: string;
    managerRole: string;
    inviteMember: string;
    readOnlyHint: string;
    sessionReadOnlyHint: string;
    roleRefreshError: string;
    loadError: string;
    emptyTitle: string;
    searchPlaceholder: string;
    metrics: {
      total: string;
      active: string;
      invited: string;
      disabled: string;
      suspended: string;
    };
    columns: {
      member: string;
      roles: string;
      language: string;
      lastLogin: string;
      created: string;
    };
    actions: {
      edit: string;
      roles: string;
      enable: string;
      disable: string;
      resetPassword: string;
      resetPin: string;
      view: string;
    };
    invite: {
      title: string;
      description: string;
      displayName: string;
      email: string;
      phone: string;
      temporaryPassword: string;
      role: string;
      language: string;
      sending: string;
      submit: string;
      success: string;
      failed: string;
    };
    edit: {
      title: string;
      description: string;
      timezone: string;
      success: string;
      failed: string;
    };
    detail: {
      title: string;
      account: string;
      activity: string;
      userId: string;
      userIdHint: string;
      selfCredentialHint: string;
      profileLink: string;
      notProvided: string;
    };
    roles: {
      title: string;
      description: string;
      fallbackHint: string;
      success: string;
      failed: string;
      submit: string;
    };
    status: {
      disableTitle: string;
      enableTitle: string;
      disableConfirm: string;
      enableConfirm: string;
      reason: string;
      reasonRequired: string;
      disableSuccess: string;
      enableSuccess: string;
      noAction: string;
    };
    resetPin: {
      title: string;
      description: string;
      reason: string;
      reasonRequired: string;
      submit: string;
      success: string;
      resultTitle: string;
      resultWarning: string;
      done: string;
    };
    resetPassword: {
      actionTitle: string;
      title: string;
      description: string;
      reason: string;
      reasonRequired: string;
      submit: string;
      success: string;
      resultTitle: string;
      resultWarning: string;
      done: string;
    };
  };
  auditLogs: {
    badge: string;
    title: string;
    centerTitle: string;
    activityDescription: string;
    securityDescription: string;
    loadError: string;
    emptyTitle: string;
    category: string;
    eventType: string;
    allEventTypes: string;
    result: string;
    actorUserId: string;
    detail: {
      title: string;
      description: string;
      id: string;
      entityType: string;
      entityId: string;
      tenant: string;
      reason: string;
      ipAddress: string;
      before: string;
      after: string;
    };
    columns: {
      created: string;
      event: string;
      entity: string;
      actor: string;
    };
  };
  systemLogs: {
    badge: string;
    title: string;
    loadError: string;
    emptyTitle: string;
    level: string;
    service: string;
    servicePlaceholder: string;
    tenantId: string;
    columns: {
      created: string;
      message: string;
      tenant: string;
      actor: string;
      request: string;
      none: string;
    };
    detail: {
      title: string;
      id: string;
      eventType: string;
      branch: string;
      metadata: string;
      noMetadata: string;
    };
  };
  backups: {
    badge: string;
    title: string;
    loadError: string;
    restoreLoadError: string;
    emptyBackups: string;
    emptyRestores: string;
    restoreSection: string;
    selectBackupHint: string;
    manualBackup: string;
    backupPhysicalScopeHint: string;
    scope: string;
    reason: string;
    backupReasonPlaceholder: string;
    createBackupTask: string;
    backupCreated: string;
    restoreReason: string;
    restoreReasonPlaceholder: string;
    submitRestore: string;
    restoreSubmitted: string;
    restoreRequiresSuccess: string;
    columns: {
      created: string;
      requestedBy: string;
      finished: string;
      review: string;
    };
    detail: {
      backupTask: string;
      scope: string;
      status: string;
      tenant: string;
      started: string;
      finished: string;
      failure: string;
    };
    review: {
      approve: string;
      reject: string;
      complete: string;
      cancel: string;
      reviewNote: string;
      reviewNotePlaceholder: string;
      applyNote: string;
    };
    reviewToasts: {
      approved: string;
      rejected: string;
      completed: string;
      cancelled: string;
      failed: string;
    };
    restoreColumns: {
      reviewer: string;
      reviewedAt: string;
      reviewNote: string;
      actions: string;
    };
    storageMetadata: {
      title: string;
      dumpUrl: string;
      dumpKey: string;
      sizeBytes: string;
      checksum: string;
      storageType: string;
      notCaptured: string;
    };
  };
  platformSettings: {
    badge: string;
    title: string;
    loadError: string;
    saveSuccess: string;
    defaultConfig: string;
    defaultLanguage: string;
    defaultCurrency: string;
    timezone: string;
    maintenanceMode: string;
    lastUpdated: string;
    saveSettings: string;
    workspace: {
      subtitle: string;
      searchLabel: string;
      searchPlaceholder: string;
      noResults: string;
      closeLabel: string;
      sections: {
        defaults: { title: string; description: string };
        taxTemplates: { title: string; description: string };
        security: { title: string; description: string };
        maintenance: { title: string; description: string };
      };
      maintenanceHint: string;
      securityEvents: string;
    };
  };
  security: {
    page: {
      badge: string;
      title: string;
      refreshSettings: string;
      loadError: string;
    };
    settings: {
      title: string;
      saveSuccess: string;
      passwordMinLength: string;
      loginMaxAttempts: string;
      lockoutMinutes: string;
      refreshTokenDays: string;
      requireNumber: string;
      requireSymbol: string;
      saveSettings: string;
    };
    events: {
      title: string;
      refreshEvents: string;
      loadError: string;
      emptyTitle: string;
      severity: string;
      eventType: string;
      eventTypePlaceholder: string;
      tenantId: string;
      noDescription: string;
      detailTitle: string;
      eventId: string;
      branch: string;
      userAgent: string;
      metadata: string;
      notCaptured: string;
      noMetadata: string;
      columns: {
        created: string;
        description: string;
        tenant: string;
        actor: string;
        ip: string;
      };
    };
  };
  feedbackTickets: {
    badge: string;
    title: string;
    loadError: string;
    emptyTitle: string;
    priority: string;
    tenantId: string;
    assigneeId: string;
    assigneePlaceholder: string;
    columns: {
      ticket: string;
      tenant: string;
      assignee: string;
      created: string;
      sla: string;
    };
    detail: string;
    detailTitle: string;
    selectHint: string;
    fields: {
      title: string;
      description: string;
      noDescription: string;
      reporter: string;
      source: string;
      updated: string;
    };
    status: {
      updated: string;
      label: string;
      reason: string;
      reasonPlaceholder: string;
      submit: string;
    };
    assignee: {
      updated: string;
      label: string;
      placeholder: string;
      submit: string;
    };
    batch: {
      ariaLabel: string;
      selected: string;
      selectAll: string;
      clear: string;
      applyStatus: string;
      reassign: string;
      close: string;
      noneSelected: string;
      statusLabel: string;
      assigneeLabel: string;
      submitStatus: string;
      submitAssignee: string;
      reason: string;
      reasonPlaceholder: string;
      closeReason: string;
      closeReasonPlaceholder: string;
      statusApplied: string;
      statusPartial: string;
      statusFailed: string;
      assigneeApplied: string;
      assigneePartial: string;
      assigneeFailed: string;
      closed: string;
      closedPartial: string;
      closedFailed: string;
    };
    sla: {
      label: string;
      met: string;
      onTrack: string;
      left: string;
      overdue: string;
      lessThanHourLeft: string;
      overDueAria: string;
      dueSoonAria: string;
    };
    timeline: {
      title: string;
      empty: string;
      created: string;
      updated: string;
    };
  };
  profile: {
    intro: string;
    identityTitle: string;
    identityDescription: string;
    preferencesTitle: string;
    preferencesDescription: string;
    securityTitle: string;
    securityDescription: string;
    displayName: string;
    email: string;
    phone: string;
    language: string;
    timezone: string;
    timezoneHint: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordHint: string;
    numberRequirement: string;
    symbolRequirement: string;
    passwordReauth: string;
    showPassword: string;
    hidePassword: string;
    changePassword: string;
    discard: string;
    saved: string;
    passwordChanged: string;
    saveFailed: string;
    passwordFailed: string;
    required: string;
    invalidEmail: string;
    invalidPhone: string;
    invalidTimezone: string;
    passwordMismatch: string;
    passwordSame: string;
    currentPasswordIncorrect: string;
    emailConflict: string;
    phoneConflict: string;
  };
  placeholders: {
    profile: {
      title: string;
      description: string;
      items: string[];
    };
    featureFlags: {
      title: string;
      description: string;
      items: string[];
    };
    localization: {
      title: string;
      description: string;
      items: string[];
    };
  };
  todoCenter: {
    /** Header bell icon accessible label. */
    openTodoCenter: string;
    /** Tooltip/label shown when there is nothing actionable. */
    emptyTitle: string;
    emptyBody: string;
    badge: string;
    title: string;
    description: string;
    loadError: string;
    total: string;
    /** Singular fallback for a queue sample when it has no title. */
    untitled: string;
    feedbackQueue: {
      title: string;
      description: string;
      empty: string;
      viewAll: string;
    };
    restoreQueue: {
      title: string;
      description: string;
      empty: string;
      viewAll: string;
    };
    securityQueue: {
      title: string;
      description: string;
      empty: string;
      viewAll: string;
    };
  };
};
