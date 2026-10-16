(function () {
  const accounts = [
    account("CA-01HZX91K", "Diop Family & Co.", "+221 77 000 0000", "family.diop@example.com", "正常", "POS", "今天 09:42", "2024年11月18日"),
    account("CA-01J11F3P", "Sarr Account", "+221 70 555 0198", "mamadou.sarr@example.com", "正常", "App", "昨天 16:20", "2025年3月4日"),
    account("CA-01J2ND8Q", "Ndiaye Family", "+221 76 220 1144", "ndiaye.family@example.com", "正常", "POS", "6月17日", "2025年4月12日"),
    account("CA-01J3K5RC", "Ba Corporate Benefits", "+221 78 330 1155", "hr@ba-group.example", "正常", "导入", "6月15日", "2025年8月20日"),
    account("CA-01J4P7MT", "Fall Household", "+221 75 881 2200", "fall.home@example.com", "正常", "POS", "6月12日", "2026年1月9日"),
    account("CA-01J5Q9NX", "Diallo Account", "+221 77 901 6677", "diallo@example.com", "停用", "App", "5月28日", "2025年10月6日"),
    account("CA-01J6R2VA", "Sow Family", "+221 76 442 1133", "sow.family@example.com", "正常", "POS", "5月19日", "2026年2月14日"),
    account("CA-01J7T4WB", "Kane Services", "+221 70 118 9900", "contact@kane.example", "正常", "导入", "4月30日", "2025年6月18日")
  ];

  const profiles = [
    profile("CU-01HZXA01", "CA-01HZX91K", "Aminata Diop", "+221 77 000 0000", "aminata@example.com", "本人", "VIP", "正常", 18, 8500),
    profile("CU-01HZXA02", "CA-01HZX91K", "Mamadou Diop", "+221 78 111 2200", "mamadou.diop@example.com", "家庭成员", "普通", "正常", 4, 0),
    profile("CU-01HZXA03", "CA-01HZX91K", "Awa Diop", "+221 76 333 0044", "awa.diop@example.com", "家庭成员", "普通", "正常", 7, 2000),
    profile("CU-01HZXA04", "CA-01HZX91K", "Ibrahima Diop", "", "ibrahima@example.com", "企业员工", "企业", "正常", 2, 0),
    profile("CU-01J11F4A", "CA-01J11F3P", "Mamadou Sarr", "+221 70 555 0198", "mamadou.sarr@example.com", "本人", "普通", "正常", 6, 0),
    profile("CU-01J2ND9R", "CA-01J2ND8Q", "Fatou Ndiaye", "+221 76 220 1144", "fatou.ndiaye@example.com", "本人", "普通", "正常", 9, 2000),
    profile("CU-01J2NDA2", "CA-01J2ND8Q", "Cheikh Ndiaye", "", "cheikh.ndiaye@example.com", "家庭成员", "普通", "正常", 3, 0),
    profile("CU-01J3K6SD", "CA-01J3K5RC", "Aissatou Ba", "+221 77 411 8822", "aissatou.ba@example.com", "企业员工", "企业", "正常", 12, 5000),
    profile("CU-01J3K6SE", "CA-01J3K5RC", "Omar Ba", "+221 70 338 7711", "omar.ba@example.com", "企业员工", "企业", "正常", 5, 0),
    profile("CU-01J4P8NU", "CA-01J4P7MT", "Mariama Fall", "+221 75 881 2200", "mariama.fall@example.com", "本人", "普通", "正常", 8, 1500),
    profile("CU-01J5QAOV", "CA-01J5Q9NX", "Amadou Diallo", "+221 77 901 6677", "amadou.diallo@example.com", "本人", "普通", "停用", 2, 0),
    profile("CU-01J6R3WB", "CA-01J6R2VA", "Ndeye Sow", "+221 76 442 1133", "ndeye.sow@example.com", "本人", "VIP", "正常", 11, 4200)
  ];

  const pageParams = new URLSearchParams(window.location.search);
  const initialAccountId = pageParams.get("account");
  const hasInitialAccount = accounts.some((item) => item.id === initialAccountId);

  const state = {
    resultType: hasInitialAccount ? "profile" : "all",
    query: "",
    draftQuery: "",
    page: 1,
    pageSize: 5,
    accountContext: hasInitialAccount ? { accountId: initialAccountId, previous: { resultType: "all", query: "", draftQuery: "", page: 1, pageSize: 5 } } : null,
    modal: null,
    toast: ""
  };

  function account(id, name, phone, email, status, source, lastVisit, createdAt) { return { id, name, phone, email, status, source, lastVisit, createdAt }; }
  function profile(id, accountId, name, phone, email, relationship, tier, status, orderCount, balance) { return { id, accountId, name, phone, email, relationship, tier, status, orderCount, balance }; }
  function App() { return React.createElement("div", { dangerouslySetInnerHTML: { __html: page() } }); }
  function render() { window.__cleanHubRoot.render(React.createElement(App)); }

  function page() {
    return `<div class="flex h-screen overflow-hidden bg-page">${sidebar()}<main class="flex min-w-0 flex-1 flex-col">${topbar()}<div class="scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">${header()}${workspace()}</div></main>${modal()}${toast()}</div>`;
  }

  function sidebar() {
    return `<aside class="flex w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white"><div class="border-b border-slate-100 px-5 py-5"><div class="flex items-center gap-3"><img src="./assets/cleanhub-logo-mark.jpg" class="h-11 w-11 rounded-xl object-cover" alt="CleanHub" /><div><div class="text-lg font-extrabold"><span class="text-slate-950">Clean</span><span class="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Hub</span></div><div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">POS</div></div></div><a href="./cleanhub-pos-new-intake.html" class="mt-5 flex h-11 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white">${icon("user-plus", "h-4 w-4")} 客户接待</a></div><nav class="scrollbar flex-1 overflow-y-auto px-3 py-4"><div class="space-y-6">${navGroup("业务操作", [["layout-dashboard", "工作台", false, "./cleanhub-pos-home.html"], ["user-plus", "客户接待", false, "./cleanhub-pos-new-intake.html"], ["search", "查询客户", false, "./cleanhub-pos-customers.html"], ["scan-line", "扫描标签", false, "#"], ["wallet-cards", "收款", false, "#"]])}${navGroup("业务记录", [["users", "客户管理", true, "./cleanhub-pos-customers.html"], ["clipboard-list", "工单管理", false, "./cleanhub-pos-tickets.html"], ["receipt", "订单管理", false, "./cleanhub-pos-orders.html"], ["chart", "统计数据", false, "./cleanhub-pos-statistics.html"], ["shirt", "衣物状态", false, "#"]])}${navGroup("门店管理", [["replace", "店员交接", false, "#"], ["bell", "通知中心", false, "./cleanhub-pos-notifications.html"], ["settings", "设置", false, "#"]])}</div></nav><div class="border-t border-slate-100 p-4"><div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><div class="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white">MC</div><div><div class="text-sm font-semibold">Maya C.</div><div class="text-xs text-slate-500">收银员</div></div></div></div></aside>`;
  }

  function topbar() { return `<header class="flex h-[68px] items-center border-b border-slate-200 bg-white px-6"><div class="flex h-10 w-full max-w-[520px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3">${icon("search", "mr-2.5 h-4 w-4 text-slate-400")}<input class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="查询客户、工单、订单或标签" /></div><div class="ml-auto flex items-center gap-2"><div class="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 lg:flex"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>已同步</div><button class="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold">中文</button><button class="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold">${icon("lock", "h-4 w-4")} 锁定</button><button class="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200">${icon("bell", "h-4 w-4")}<span class="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"></span></button></div></header>`; }

  function header() {
    const currentAccount = state.accountContext ? findAccount(state.accountContext.accountId) : null;
    const breadcrumb = currentAccount ? `<span>POS</span>${icon("chevron-right", "h-3.5 w-3.5")}<button onclick="CustomerAdmin.backToList()" class="hover:text-blue-700">客户管理</button>${icon("chevron-right", "h-3.5 w-3.5")}<span class="rounded-md bg-blue-50 px-2 py-1 text-blue-700">${esc(currentAccount.name)}</span>` : `<span>POS</span>${icon("chevron-right", "h-3.5 w-3.5")}<span class="text-slate-600">客户管理</span>`;
    const actions = currentAccount ? `<button onclick="CustomerAdmin.backToList()" class="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">${icon("chevron-right", "h-4 w-4 rotate-180")} 返回客户列表</button><button onclick="CustomerAdmin.openCreate('profile')" class="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">新增档案</button>` : `<button onclick="CustomerAdmin.openCreate('profile')" class="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">新增档案</button><button onclick="CustomerAdmin.openCreate('account')" class="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">新增账户</button>`;
    return `<div class="mb-5 flex items-end justify-between gap-5"><div><div class="flex items-center gap-1.5 text-xs font-semibold text-slate-400">${breadcrumb}</div><h1 class="mt-2 text-2xl font-semibold text-slate-950">${currentAccount ? `${esc(currentAccount.name)}的客户档案` : "客户管理"}</h1><p class="mt-1 text-sm text-slate-500">${currentAccount ? `正在查看该账户下的全部客户档案，共 ${profiles.filter((item) => item.accountId === currentAccount.id).length} 个。` : "一次查询同时匹配客户账户和客户档案，店员无需提前判断手机号属于哪种数据。"}</p></div><div class="flex gap-2">${actions}</div></div>`;
  }

  function workspace() {
    return `<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel">${filters()}${table()}</section>`;
  }

  function filters() {
    const typeFilter = state.accountContext ? "" : `<select id="filter-result-type" class="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"><option value="all" ${state.resultType === "all" ? "selected" : ""}>全部结果类型</option><option value="account" ${state.resultType === "account" ? "selected" : ""}>仅客户账户</option><option value="profile" ${state.resultType === "profile" ? "selected" : ""}>仅客户档案</option></select>`;
    return `<div class="border-b border-slate-200 bg-slate-50/60 p-4"><div class="flex flex-wrap items-center gap-2"><div class="flex h-10 min-w-[320px] flex-1 items-center rounded-lg border border-slate-200 bg-white px-3">${icon("search", "mr-2 h-4 w-4 text-slate-400")}<input id="customer-query" value="${esc(state.draftQuery)}" oninput="CustomerAdmin.setDraftQuery(this.value)" onkeydown="if(event.key==='Enter') CustomerAdmin.search()" class="h-full min-w-0 flex-1 text-sm outline-none" placeholder="${state.accountContext ? "查询当前账户下的档案姓名、手机号或邮箱" : "查询手机号、邮箱、账户名称或档案姓名"}" /></div>${typeFilter}<button onclick="CustomerAdmin.resetFilters()" class="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">重置</button><button onclick="CustomerAdmin.search()" class="h-10 rounded-lg bg-brand px-5 text-sm font-semibold text-white">查询</button></div><div class="mt-2 text-xs text-slate-500">${state.accountContext ? "当前仅查询该账户下的客户档案。" : "账户联系方式命中时，会同时展示该账户及其关联档案；档案联系方式命中时，直接展示对应档案。"}</div></div>`;
  }

  function table() {
    const rows = filteredRows();
    const pageCount = Math.max(1, Math.ceil(rows.length / state.pageSize));
    if (state.page > pageCount) state.page = pageCount;
    const start = (state.page - 1) * state.pageSize;
    const visible = rows.slice(start, start + state.pageSize);
    const accountCount = rows.filter((row) => row.kind === "account").length;
    const profileCount = rows.filter((row) => row.kind === "profile").length;
    return `<div class="flex items-center justify-between border-b border-slate-200 px-5 py-3"><div><span class="text-sm font-semibold text-slate-900">查询结果</span><span class="ml-2 text-xs text-slate-500">账户 ${accountCount} 条 · 档案 ${profileCount} 条</span></div><span class="text-xs text-slate-400">不同结果类型使用标签区分</span></div>${mixedTable(visible)}${pagination(rows.length, start, pageCount)}`;
  }

  function mixedTable(rows) {
    return `<div class="overflow-x-auto"><div class="min-w-[1040px]"><div class="grid grid-cols-[1.25fr_1.2fr_1.1fr_110px_100px_120px_190px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"><div>类型及名称</div><div>联系方式</div><div>关联信息</div><div>关系 / 来源</div><div>状态</div><div>最近记录</div><div class="text-right">操作</div></div>${rows.length ? rows.map((row) => row.kind === "account" ? mixedAccountRow(row.item) : mixedProfileRow(row.item)).join("") : emptyRow()}</div></div>`;
  }
  function mixedAccountRow(item) { const count = profiles.filter((profile) => profile.accountId === item.id).length; return `<div class="grid grid-cols-[1.25fr_1.2fr_1.1fr_110px_100px_120px_190px] items-center border-t border-slate-100 bg-blue-50/20 px-5 py-4 text-sm hover:bg-blue-50/50"><div class="min-w-0"><div class="flex items-center gap-2"><span class="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">账户</span><button onclick="CustomerAdmin.viewProfiles('${item.id}')" class="truncate font-semibold text-blue-700 hover:underline">${esc(item.name)}</button></div><div class="mt-1 font-mono text-[11px] text-slate-400">${item.id}</div></div><div class="min-w-0"><div class="truncate text-slate-700">${esc(item.phone || "未填写手机号")}</div><div class="truncate text-xs text-slate-500">${esc(item.email || "未填写邮箱")}</div></div><div><button onclick="CustomerAdmin.viewProfiles('${item.id}')" class="font-semibold text-blue-700">关联 ${count} 个档案</button></div><div class="text-slate-600">${item.source}</div><div>${statusSwitch("account", item)}</div><div class="text-slate-500">${item.lastVisit}</div><div class="flex justify-end gap-2"><button onclick="CustomerAdmin.viewProfiles('${item.id}')" class="text-xs font-semibold text-blue-700">查看档案</button><button onclick="CustomerAdmin.openEdit('account','${item.id}')" class="text-xs font-semibold text-slate-600">编辑</button><button onclick="CustomerAdmin.openDelete('account','${item.id}')" class="text-xs font-semibold text-red-600">删除</button></div></div>`; }
  function mixedProfileRow(item) { const owner = findAccount(item.accountId); const query = new URLSearchParams({ from: "customers", account: item.accountId, profile: item.id, accountName: owner ? owner.name : "", name: item.name, phone: item.phone, email: item.email, relationship: item.relationship, tier: item.tier, balance: String(item.balance) }); return `<div class="grid grid-cols-[1.25fr_1.2fr_1.1fr_110px_100px_120px_190px] items-center border-t border-slate-100 px-5 py-4 text-sm hover:bg-slate-50/70"><div class="min-w-0"><div class="flex items-center gap-2"><span class="rounded-md bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">档案</span><a href="./cleanhub-pos-customer-service.html?${query.toString()}" class="truncate font-semibold text-blue-700 hover:underline">${esc(item.name)}</a></div><div class="mt-1 text-xs text-slate-500">${item.tier} · 余额 ${money(item.balance)}</div></div><div class="min-w-0"><div class="truncate text-slate-700">${esc(item.phone || "未填写手机号")}</div><div class="truncate text-xs text-slate-500">${esc(item.email || "未填写邮箱")}</div></div><div class="truncate text-slate-700">所属账户：${owner ? esc(owner.name) : "-"}</div><div class="text-slate-600">${item.relationship}</div><div>${statusSwitch("profile", item)}</div><div class="text-slate-500">${item.orderCount} 个订单</div><div class="flex justify-end gap-3"><a href="./cleanhub-pos-customer-service.html?${query.toString()}" class="text-xs font-semibold text-blue-700">客户服务</a><button onclick="CustomerAdmin.openEdit('profile','${item.id}')" class="text-xs font-semibold text-slate-600">编辑</button><button onclick="CustomerAdmin.openDelete('profile','${item.id}')" class="text-xs font-semibold text-red-600">删除</button></div></div>`; }
  function emptyRow() { return `<div class="border-t border-slate-100 px-5 py-12 text-center text-sm text-slate-500">没有符合当前查询条件的数据。</div>`; }

  function pagination(total, start, pageCount) { return `<div class="flex items-center justify-between border-t border-slate-200 px-5 py-4"><div class="text-sm text-slate-500">正在显示第 ${total ? start + 1 : 0}-${Math.min(start + state.pageSize, total)} 条，共 ${total} 条</div><div class="flex items-center gap-1"><select onchange="CustomerAdmin.setPageSize(this.value)" class="mr-2 h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="5" ${state.pageSize === 5 ? "selected" : ""}>每页 5 条</option><option value="10" ${state.pageSize === 10 ? "selected" : ""}>每页 10 条</option></select><button onclick="CustomerAdmin.goPage(${state.page - 1})" ${state.page === 1 ? "disabled" : ""} class="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40">上一页</button>${Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => `<button onclick="CustomerAdmin.goPage(${page})" class="h-9 min-w-9 rounded-lg text-sm font-semibold ${page === state.page ? "bg-brand text-white" : "border border-slate-200 text-slate-600"}">${page}</button>`).join("")}<button onclick="CustomerAdmin.goPage(${state.page + 1})" ${state.page === pageCount ? "disabled" : ""} class="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40">下一页</button></div></div>`; }

  function filteredRows() {
    const q = norm(state.query);
    if (state.accountContext) {
      return profiles.filter((item) => item.accountId === state.accountContext.accountId && (!q || [item.name, item.phone, item.email, item.id].some((value) => norm(value).includes(q)))).map((item) => ({ kind: "profile", item }));
    }
    const matchingAccountIds = new Set(accounts.filter((item) => !q || [item.name, item.phone, item.email, item.id].some((value) => norm(value).includes(q))).map((item) => item.id));
    const accountRows = accounts.filter((item) => (state.resultType === "all" || state.resultType === "account") && matchingAccountIds.has(item.id)).map((item) => ({ kind: "account", item }));
    const profileRows = profiles.filter((item) => {
      const directMatch = !q || [item.name, item.phone, item.email, item.id].some((value) => norm(value).includes(q));
      const accountMatch = q && matchingAccountIds.has(item.accountId);
      return (state.resultType === "all" || state.resultType === "profile") && (directMatch || accountMatch);
    }).map((item) => ({ kind: "profile", item }));
    const accountRowMap = new Map(accountRows.map((row) => [row.item.id, row]));
    const profileRowsByAccount = new Map();
    profileRows.forEach((row) => {
      const group = profileRowsByAccount.get(row.item.accountId) || [];
      group.push(row);
      profileRowsByAccount.set(row.item.accountId, group);
    });
    const mixedRows = [];
    accounts.forEach((item) => {
      if (accountRowMap.has(item.id)) mixedRows.push(accountRowMap.get(item.id));
      mixedRows.push(...(profileRowsByAccount.get(item.id) || []));
      profileRowsByAccount.delete(item.id);
    });
    profileRowsByAccount.forEach((rows) => mixedRows.push(...rows));
    return mixedRows;
  }

  function modal() {
    if (!state.modal) return "";
    if (state.modal.mode === "delete") return deleteModal();
    return formModal();
  }

  function formModal() {
    const editing = state.modal.mode === "edit";
    const item = state.modal.type === "account" ? accounts.find((entry) => entry.id === state.modal.id) : profiles.find((entry) => entry.id === state.modal.id);
    const title = `${editing ? "编辑" : "新增"}${state.modal.type === "account" ? "客户账户" : "客户档案"}`;
    const accountFields = `${field("form-account-name", "账户名称", item?.name || "", "例如：Diop Family")}${field("form-account-phone", "账户手机号", item?.phone || "", "+221 ...")}${field("form-account-email", "账户邮箱", item?.email || "", "name@example.com", "email")}${select("form-account-source", "来源", ["POS", "App", "导入"], item?.source || "POS")}`;
    const profileTierField = editing ? "" : select("form-profile-tier", "客户等级", ["普通", "VIP", "企业"], item?.tier || "普通");
    const profileFields = `${select("form-profile-account", "所属客户账户", accounts.map((entry) => [entry.id, entry.name]), item?.accountId || state.accountContext?.accountId || accounts[0]?.id)}${field("form-profile-name", "档案姓名", item?.name || "", "客户姓名")}${field("form-profile-phone", "档案手机号", item?.phone || "", "+221 ...")}${field("form-profile-email", "档案邮箱", item?.email || "", "name@example.com", "email")}${select("form-profile-relationship", "账户关系", ["本人", "家庭成员", "企业员工"], item?.relationship || "本人")}${profileTierField}`;
    return modalShell(title, state.modal.type === "account" ? "账户保存共享联系方式，可关联多个客户档案。" : "档案代表实际接受服务的个人或成员。", `<div class="grid grid-cols-2 gap-4">${state.modal.type === "account" ? accountFields : profileFields}</div>`, `<button onclick="CustomerAdmin.closeModal()" class="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold">取消</button><button onclick="CustomerAdmin.save()" class="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">保存</button>`);
  }

  function deleteModal() {
    const isAccount = state.modal.type === "account";
    const item = isAccount ? accounts.find((entry) => entry.id === state.modal.id) : profiles.find((entry) => entry.id === state.modal.id);
    const linkedCount = isAccount ? profiles.filter((profile) => profile.accountId === item?.id).length : 0;
    const warning = isAccount && linkedCount ? `该账户关联 ${linkedCount} 个客户档案。删除账户会同时删除这些档案，本操作仅为原型演示。` : "删除后该数据将不再出现在查询结果中，本操作仅为原型演示。";
    return modalShell(`删除${isAccount ? "客户账户" : "客户档案"}`, `确认删除“${esc(item?.name || "")}”吗？`, `<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">${warning}</div>`, `<button onclick="CustomerAdmin.closeModal()" class="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold">取消</button><button onclick="CustomerAdmin.confirmDelete()" class="h-10 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white">确认删除</button>`);
  }
  function modalShell(title, description, body, footer) { return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"><div class="w-full max-w-2xl rounded-xl bg-white shadow-2xl"><div class="flex items-start justify-between border-b border-slate-200 p-5"><div><h2 class="text-lg font-semibold">${title}</h2><p class="mt-1 text-sm text-slate-500">${description}</p></div><button onclick="CustomerAdmin.closeModal()" class="h-9 w-9 rounded-lg text-xl text-slate-400 hover:bg-slate-100">×</button></div><div class="p-5">${body}</div><div class="flex justify-end gap-2 border-t border-slate-200 p-4">${footer}</div></div></div>`; }

  function field(id, label, value, placeholder, type) { return `<label><span class="mb-1.5 block text-xs font-semibold text-slate-600">${label}</span><input id="${id}" type="${type || "text"}" value="${esc(value)}" class="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400" placeholder="${placeholder}" /></label>`; }
  function select(id, label, options, selected) { return `<label><span class="mb-1.5 block text-xs font-semibold text-slate-600">${label}</span><select id="${id}" class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none">${options.map((option) => { const value = Array.isArray(option) ? option[0] : option; const text = Array.isArray(option) ? option[1] : option; return `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(text)}</option>`; }).join("")}</select></label>`; }
  function statusSwitch(type, item) { const enabled = item.status === "正常"; return `<div class="flex items-center gap-2"><button type="button" role="switch" aria-checked="${enabled}" aria-label="${enabled ? "停用" : "启用"}${type === "account" ? "客户账户" : "客户档案"}" title="点击${enabled ? "停用" : "启用"}" onclick="CustomerAdmin.toggleStatus('${type}','${item.id}')" class="relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-slate-300"}"><span class="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? "left-6" : "left-1"}"></span></button><span class="text-xs font-medium ${enabled ? "text-emerald-700" : "text-slate-500"}">${item.status}</span></div>`; }
  function toast() { return state.toast ? `<div class="fixed bottom-5 right-5 z-[60] rounded-xl border border-emerald-200 bg-white p-4 shadow-xl"><div class="text-sm font-semibold">${esc(state.toast)}</div><div class="mt-1 text-xs text-slate-500">当前数据仅保存在页面演示状态中。</div></div>` : ""; }
  function showToast(message) { state.toast = message; render(); setTimeout(() => { state.toast = ""; render(); }, 2400); }
  function value(id) { return document.getElementById(id)?.value.trim() || ""; }
  function findAccount(id) { return accounts.find((item) => item.id === id); }
  function norm(value) { return String(value || "").trim().toLowerCase(); }
  function initials(name) { return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
  function money(value) { return `XOF ${Number(value).toLocaleString("en-US")}`; }
  function esc(value) { return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char])); }

  window.CustomerAdmin = {
    setDraftQuery(query) { state.draftQuery = query; },
    search() { state.query = value("customer-query"); state.draftQuery = state.query; if (!state.accountContext) state.resultType = value("filter-result-type") || "all"; state.page = 1; render(); },
    resetFilters() { state.query = ""; state.draftQuery = ""; state.resultType = state.accountContext ? "profile" : "all"; state.page = 1; render(); },
    viewProfiles(accountId) {
      if (!state.accountContext) state.accountContext = { accountId, previous: { resultType: state.resultType, query: state.query, draftQuery: state.draftQuery, page: state.page, pageSize: state.pageSize } };
      state.resultType = "profile"; state.query = ""; state.draftQuery = ""; state.page = 1; render();
    },
    backToList() {
      if (!state.accountContext) return;
      const previous = state.accountContext.previous;
      state.accountContext = null;
      Object.assign(state, previous);
      render();
    },
    setPageSize(size) { state.pageSize = Number(size); state.page = 1; render(); },
    goPage(page) { const max = Math.max(1, Math.ceil(filteredRows().length / state.pageSize)); state.page = Math.min(max, Math.max(1, page)); render(); },
    openCreate(type) { state.modal = { mode: "create", type, id: null }; render(); },
    openEdit(type, id) { state.modal = { mode: "edit", type, id }; render(); },
    openDelete(type, id) { state.modal = { mode: "delete", type, id }; render(); },
    toggleStatus(type, id) { const list = type === "account" ? accounts : profiles; const item = list.find((entry) => entry.id === id); if (!item) return; item.status = item.status === "正常" ? "停用" : "正常"; render(); },
    closeModal() { state.modal = null; render(); },
    save() {
      const editing = state.modal.mode === "edit";
      if (state.modal.type === "account") {
        const name = value("form-account-name"); const phone = value("form-account-phone"); const email = value("form-account-email");
        if (!name || (!phone && !email)) { showToast("请填写账户名称，并至少填写手机号或邮箱"); return; }
        const item = editing ? accounts.find((entry) => entry.id === state.modal.id) : account(`CA-DEMO-${Date.now()}`, "", "", "", "正常", "POS", "尚无到店记录", "今天");
        Object.assign(item, { name, phone, email, source: value("form-account-source") });
        if (!editing) accounts.unshift(item);
      } else {
        const name = value("form-profile-name"); const accountId = value("form-profile-account");
        if (!name || !accountId) { showToast("请选择所属账户并填写档案姓名"); return; }
        const item = editing ? profiles.find((entry) => entry.id === state.modal.id) : profile(`CU-DEMO-${Date.now()}`, accountId, "", "", "", "本人", "普通", "正常", 0, 0);
        const updates = { accountId, name, phone: value("form-profile-phone"), email: value("form-profile-email"), relationship: value("form-profile-relationship") };
        if (!editing) updates.tier = value("form-profile-tier") || "普通";
        Object.assign(item, updates);
        if (!editing) profiles.unshift(item);
      }
      state.modal = null; state.page = 1; showToast(editing ? "修改已保存" : "新增数据已保存");
    },
    confirmDelete() {
      const { type, id } = state.modal;
      if (type === "account") { const index = accounts.findIndex((item) => item.id === id); if (index >= 0) accounts.splice(index, 1); for (let i = profiles.length - 1; i >= 0; i -= 1) if (profiles[i].accountId === id) profiles.splice(i, 1); }
      else { const index = profiles.findIndex((item) => item.id === id); if (index >= 0) profiles.splice(index, 1); }
      state.modal = null; state.page = 1; showToast("数据已删除");
    }
  };

  render();
})();
