import type { TenantMessages } from "./types";

export const tenantMessagesZhCN: TenantMessages = {
  common: {
    statusLabels: {
      active: "活跃",
      inactive: "未激活",
    },
    languageLabels: {
      en: "英语",
      fr: "法语",
      "zh-CN": "中文",
    },

    allStatuses: "全部状态",
    search: "搜索",
    status: "状态",
    refresh: "刷新",
    saving: "保存中...",
    tryAgain: "重试",
    cancel: "取消",
    backToList: "返回列表",
    enable: "启用",
    disable: "停用",
    open: "打开",
    actions: "操作",

    notSet: "未设置",
    notUpdated: "未更新",
    invalidDate: "无效日期",
    requestFailed: "门店请求失败。",
  },

  branches: {
    eyebrow: "租户门店",
    title: "门店",
    listDescription:
      "Owner 可见租户下的全部门店。Manager 的可见范围由门店 API 按门店作用域强制限制。",
    newBranch: "新建门店",

    list: {
      searchPlaceholder: "门店名称或电话",
      empty: "暂无门店",
      limitedHint:
        "仅显示前 {limit} 家门店。请使用搜索或筛选缩小范围。",
      statusUpdated: "门店状态已更新。",
      columns: {
        branch: "门店",
        contact: "联系方式",
        defaults: "默认设置",
        status: "状态",
        updated: "更新时间",
        actions: "操作",
      },
    },

    create: {
      badge: "新建门店",
      title: "创建门店",
      description:
        "为当前租户新增一个营业地点。租户与 Manager 的门店作用域由 API 强制限制。",
      created: "门店已创建。",
      createButton: "创建门店",
      businessHoursPlaceholder: '{"mon":"08:00-18:00"}',
      fields: {
        name: "名称",
        phone: "电话",
        currency: "币种",
        defaultLanguage: "默认语言",
        status: "状态",
        logoUrl: "Logo URL",
        receiptName: "小票名称",
        receiptPhone: "小票电话",
        address: "地址",
        receiptAddress: "小票地址",
        businessHoursJson: "营业时间 JSON",
      },
    },

    detail: {
      badge: "门店资料",
      description: "编辑门店默认设置、小票身份与运营元数据。",
      saveBranch: "保存门店",
      statusHint: "使用启用或停用按钮来更新状态。",
      integrationChecks: "集成检查",
      integrationChecksDesc: "门店作用域与租户隔离由 API 强制执行。",
      branchIdLabel: "门店 ID",
      updatedLabel: "更新时间",
      updated: "门店已更新。",
      versionConflict: "门店已被其它请求更新，请刷新后重试。",
    },
  },
};
