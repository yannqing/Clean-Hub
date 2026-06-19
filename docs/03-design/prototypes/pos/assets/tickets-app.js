(function () {
  const statusOptions = ["已开启", "待付款", "已付款", "处理中", "待取件", "已取件", "已完成"];
  const typeOptions = ["洗衣护理", "干洗", "鞋类护理", "地毯清洗", "车辆清洗", "综合服务"];
  const priorityOptions = ["普通", "加急", "最紧急"];
  const sourceOptions = ["POS", "App", "Phone", "WhatsApp"];
  const assistantOptions = ["Maya C.", "Omar N.", "Fatou B.", "Ibrahima S."];
  const itemStatusOptions = ["清洗中", "已完成", "待取件"];
  const currentAssistant = "Maya C.";

  const tickets = [
    makeTicket("CH-8F2A", "Aminata Diop", "+221 77 000 0000", "综合服务", "处理中", "加急", "2026-06-18T17:30", "Maya C.", "POS", 18000, [
      makeItem("CH-8F2A-01", "衣物", "白色衬衫", "上衣", "洗衣", "清洗中", "白色", "Uniqlo", "棉质", 2, 2500, "左袖口有轻微污渍", "使用无香型洗涤剂", "分开清洗"),
      makeItem("CH-8F2A-02", "衣物", "藏青色西装", "外套", "干洗", "清洗中", "藏青色", "Hugo Boss", "羊毛混纺", 1, 8000, "右侧纽扣松动", "保留原有裤线", ""),
      makeItem("CH-8F2A-03", "鞋", "运动鞋", "运动鞋", "鞋类护理", "已完成", "白色", "Nike", "皮革与网面", 1, 5000, "鞋底轻微磨损", "只做轻度鞋底清洁", "")
    ]),
    makeTicket("CH-91B4", "Mamadou Sarr", "+221 76 118 2040", "干洗", "待取件", "普通", "2026-06-18T15:00", "Omar N.", "Phone", 12500, [
      makeItem("CH-91B4-01", "衣物", "商务西装", "外套", "干洗", "待取件", "黑色", "Zara", "羊毛", 1, 8500, "无明显瑕疵", "熨烫定型", "电话通知取件"),
      makeItem("CH-91B4-02", "衣物", "西装裤", "裤子", "干洗", "待取件", "黑色", "Zara", "羊毛", 1, 4000, "裤脚轻微磨损", "保留裤线", "")
    ]),
    makeTicket("CH-7C20", "Diop Family", "+221 78 340 1188", "地毯清洗", "待付款", "最紧急", "2026-06-17T18:00", "Fatou B.", "WhatsApp", 32000, [
      makeItem("CH-7C20-01", "地毯", "客厅地毯", "长绒地毯", "地毯深度清洗", "清洗中", "米色", "IKEA", "羊毛", 1, 32000, "边角有咖啡渍", "重点除渍并除味", "尺寸 2m × 3m")
    ]),
    makeTicket("CH-6AF1", "Fatou Ndiaye", "+221 77 831 9022", "洗衣护理", "已开启", "普通", "2026-06-19T12:00", "Maya C.", "App", 7500, [
      makeItem("CH-6AF1-01", "衣物", "连衣裙", "裙装", "精洗", "清洗中", "绿色", "Mango", "真丝", 1, 7500, "腰部轻微污渍", "低温处理", "")
    ]),
    makeTicket("CH-5D77", "Cheikh Fall", "+221 70 911 5520", "车辆清洗", "已付款", "普通", "2026-06-18T16:30", "Ibrahima S.", "POS", 15000, [
      makeItem("CH-5D77-01", "车", "Toyota RAV4", "SUV", "内外精洗", "清洗中", "银色", "Toyota", "", 1, 15000, "右后门有划痕", "后备箱重点吸尘", "车牌 DK-2048-AB")
    ]),
    makeTicket("CH-4E39", "Mariama Ba", "+221 76 004 7712", "鞋类护理", "已完成", "普通", "2026-06-16T11:30", "Omar N.", "Phone", 6000, [
      makeItem("CH-4E39-01", "鞋", "皮鞋", "正装鞋", "皮革护理", "已完成", "棕色", "Clarks", "牛皮", 1, 6000, "鞋头轻微划痕", "同色补色", "")
    ]),
    makeTicket("CH-3A12", "Ousmane Kane", "+221 77 290 4180", "洗衣护理", "已取件", "普通", "2026-06-15T14:00", "Fatou B.", "POS", 10000, [
      makeItem("CH-3A12-01", "衣物", "床单套装", "家纺", "洗衣", "已完成", "白色", "", "棉质", 2, 5000, "无明显瑕疵", "高温消毒", "")
    ]),
    makeTicket("CH-2B88", "Sokhna Gueye", "+221 78 560 4431", "干洗", "已完成", "加急", "2026-06-14T10:00", "Maya C.", "WhatsApp", 9500, [
      makeItem("CH-2B88-01", "衣物", "晚礼服", "裙装", "干洗", "已完成", "红色", "", "丝绸", 1, 9500, "裙摆有酒渍", "去渍后轻柔熨烫", "")
    ])
  ];

  const state = { scope: "mine", query: "", status: "全部状态", type: "全部类型", priority: "全部优先级", date: "全部日期", selectedId: null, editing: false, editingItem: null, draft: null, toast: "" };

  function makeTicket(no, customer, phone, type, status, priority, pickup, assistant, source, amount, items) {
    return { id: "01JY" + no.replace(/\W/g, "") + "7K9Q4P6X1C8V7B2D".slice(0, 14), no, customer, phone, customerId: "CU-" + no.slice(3), type, status, priority, pickup, assistant, source, amount, items, remark: priority === "最紧急" ? "客户要求优先处理并及时通知进度。" : "请按标准流程检查后处理。", createdAt: "2026-06-17 09:46", updatedAt: "2026-06-18 10:12", completedAt: status === "已完成" ? "2026-06-18 10:08" : "—", cancelledAt: "—" };
  }

  function makeItem(label, itemType, name, category, service, status, color, brand, material, quantity, unitAmount, defect, request, remark) {
    return { id: "TI-" + label, label, itemType, name, category, service, serviceId: "SV-" + service.replace(/\s/g, ""), status, color, brand, material, quantity, unitAmount, lineAmount: quantity * unitAmount, defect, request, remark };
  }

  function App() { return React.createElement("div", { dangerouslySetInnerHTML: { __html: page() } }); }
  function render() { window.__cleanHubRoot.render(React.createElement(App)); setTimeout(() => window.lucide && lucide.createIcons({ attrs: { "stroke-width": 2 } }), 0); }

  function page() {
    return `<div class="flex h-screen overflow-hidden bg-page">${sidebar()}<main class="flex min-w-0 flex-1 flex-col">${topbar()}<div class="scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 lg:px-6">${heading()}${metrics()}${filters()}${table()}</div></main>${drawer()}${toast()}</div>`;
  }

  function sidebar() {
    return `<aside class="hidden w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white xl:flex"><div class="border-b border-slate-100 px-5 py-5"><div class="flex items-center gap-3"><img src="./assets/cleanhub-logo-mark.jpg" class="h-11 w-11 rounded-xl object-cover" alt="CleanHub" /><div><div class="text-lg font-extrabold"><span>Clean</span><span class="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Hub</span></div><div class="text-[10px] font-semibold uppercase tracking-[.22em] text-slate-400">POS</div></div></div><a href="./cleanhub-pos-new-intake.html" class="mt-5 flex h-11 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brandDark">${ico("user-round-plus")} 客户接待</a></div><nav class="scrollbar flex-1 overflow-y-auto px-3 py-4"><div class="space-y-6">${navGroup("业务操作", [["layout-dashboard","工作台","./cleanhub-pos-home.html"],["user-round-plus","客户接待","./cleanhub-pos-new-intake.html"],["search","查询客户","./cleanhub-pos-customers.html"],["scan-line","扫描标签","#"],["wallet-cards","收款","#"]])}${navGroup("业务记录", [["users","客户管理","./cleanhub-pos-customers.html"],["clipboard-list","工单管理","./cleanhub-pos-tickets.html",true],["receipt","订单管理","./cleanhub-pos-orders.html"],["chart-no-axes-column-increasing","统计数据","./cleanhub-pos-statistics.html"],["shirt","衣物状态","#"]])}${navGroup("门店管理", [["arrow-left-right","店员交接","#"],["bell","通知中心","#"],["settings","设置","#"]])}</div></nav><div class="border-t border-slate-100 p-4"><div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><div class="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white">MC</div><div><div class="text-sm font-semibold">Maya C.</div><div class="text-xs text-slate-500">收银员</div></div></div></div></aside>`;
  }

  function navGroup(title, items) { return `<div><div class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">${title}</div><div class="space-y-1">${items.map(([i,l,h,a]) => `<a href="${h}" class="relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm ${a ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}">${a ? '<span class="absolute left-0 h-5 w-1 rounded-r-full bg-blue-600"></span>' : ""}<span class="flex h-7 w-7 items-center justify-center">${ico(i)}</span><span class="font-medium">${l}</span></a>`).join("")}</div></div>`; }

  function topbar() {
    return `<header class="flex h-[68px] items-center border-b border-slate-200 bg-white px-6"><div class="flex h-10 w-full max-w-[520px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-focus">${ico("search","mr-2.5 text-slate-400")}<input id="global-ticket-search" oninput="Tickets.quickSearch(this.value)" value="${esc(state.query)}" class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="查询客户、工单、订单或标签" /></div><div class="ml-auto flex items-center gap-2"><div class="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 lg:flex"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>已同步</div><button class="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold">中文</button><button class="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold">${ico("lock")} 锁定</button><button class="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200">${ico("bell")}<span class="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"></span></button></div></header>`;
  }

  function heading() { return `<div class="flex flex-wrap items-end justify-between gap-4"><div><div class="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><span>POS</span>${ico("chevron-right","h-3 w-3")}<span class="text-slate-600">工单管理</span></div><h1 class="mt-2 text-2xl font-semibold tracking-tight">工单管理</h1><p class="mt-1 text-sm text-slate-500">查询工单、跟进服务进度并维护工单信息。</p></div><div class="flex items-center gap-2 text-xs text-slate-500">${ico("circle-help","text-slate-400")} 本页面仅支持查询和修改，不提供新增或删除</div></div>`; }

  function metrics() {
    const visible = filteredTickets();
    const open = visible.filter(x => !["已取件","已完成"].includes(x.status)).length;
    const ready = visible.filter(x => x.status === "待取件").length;
    const urgent = visible.filter(x => ["加急","最紧急"].includes(x.priority) && !["已取件","已完成"].includes(x.status)).length;
    const overdue = visible.filter(x => isOverdue(x)).length;
    return `<div class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">${metric("进行中工单", open, "clipboard-list", "text-blue-700 bg-blue-50", "需持续跟进")}${metric("待取件", ready, "package-check", "text-violet-700 bg-violet-50", "等待客户到店")}${metric("加急处理", urgent, "zap", "text-amber-700 bg-amber-50", "含最紧急工单")}${metric("已逾期", overdue, "clock-alert", "text-red-700 bg-red-50", "已超过预计取件时间")}</div>`;
  }
  function metric(label, value, icon, tone, note) { return `<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-panel"><div class="flex items-center justify-between"><div class="text-sm font-medium text-slate-500">${label}</div><span class="flex h-9 w-9 items-center justify-center rounded-lg ${tone}">${ico(icon)}</span></div><div class="mt-2 text-2xl font-semibold">${value}</div><div class="mt-1 text-xs text-slate-400">${note}</div></section>`; }

  function filters() {
    const mineCount = tickets.filter(t => t.assistant === currentAssistant).length;
    return `<section class="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-panel"><div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div class="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="工单范围"><button onclick="Tickets.setScope('mine')" aria-pressed="${state.scope === "mine"}" class="flex h-8 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${state.scope === "mine" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}">${ico("user-round","h-3.5 w-3.5")} 我的工单 <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] ${state.scope === "mine" ? "text-blue-600" : "text-slate-400"}">${mineCount}</span></button><button onclick="Tickets.setScope('all')" aria-pressed="${state.scope === "all"}" class="flex h-8 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${state.scope === "all" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}">${ico("users-round","h-3.5 w-3.5")} 全部工单 <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] ${state.scope === "all" ? "text-blue-600" : "text-slate-400"}">${tickets.length}</span></button></div><div class="flex items-center gap-2 text-xs text-slate-500"><span class="brand-gradient flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold text-white">MC</span> 当前店员：<span class="font-semibold text-slate-700">${currentAssistant}</span></div></div><div class="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4"><div class="flex h-10 min-w-[250px] flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:bg-white">${ico("search","mr-2 text-slate-400")}<input id="ticket-search" oninput="Tickets.setQuery(this.value)" value="${esc(state.query)}" class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="工单号、客户、电话、标签码或物品名称" /></div>${select("status-filter", state.status, ["全部状态", ...statusOptions], "Tickets.setFilter('status', this.value)")}${select("type-filter", state.type, ["全部类型", ...typeOptions], "Tickets.setFilter('type', this.value)")}${select("priority-filter", state.priority, ["全部优先级", ...priorityOptions], "Tickets.setFilter('priority', this.value)")}${select("date-filter", state.date, ["全部日期", "今天取件", "已逾期", "近7天"], "Tickets.setFilter('date', this.value)")}<button onclick="Tickets.resetFilters()" class="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">${ico("rotate-ccw")} 重置</button></div></section>`;
  }

  function filteredTickets() {
    const q = norm(state.query);
    return tickets.filter(t => {
      const haystack = [t.no,t.customer,t.phone,t.type,t.status,t.priority,t.source,t.assistant,t.remark,...t.items.flatMap(i => [i.label,i.name,i.service,i.color,i.brand])].join(" ").toLowerCase();
      return (state.scope === "all" || t.assistant === currentAssistant) && (!q || haystack.includes(q)) && (state.status === "全部状态" || t.status === state.status) && (state.type === "全部类型" || t.type === state.type) && (state.priority === "全部优先级" || t.priority === state.priority) && dateMatches(t);
    });
  }

  function table() {
    const rows = filteredTickets();
    return `<section class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel"><div class="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 class="font-semibold">工单列表</h2><p class="mt-1 text-xs text-slate-500">${state.scope === "mine" ? `我的工单 · ${currentAssistant}` : "全部工单"} · 共 ${rows.length} 条结果 · 点击工单号或“查看”打开详情</p></div><div class="text-xs text-slate-400">最后同步：10:18</div></div><div class="scrollbar overflow-x-auto"><div class="min-w-[1120px]"><div class="grid grid-cols-[130px_minmax(190px,1.2fr)_100px_110px_110px_150px_110px_90px] bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[.1em] text-slate-400"><div>工单 / 来源</div><div>客户 / 服务项目</div><div>类型</div><div>状态</div><div>优先级</div><div>预计取件</div><div>接待店员</div><div class="text-right">操作</div></div>${rows.length ? rows.map(ticketRow).join("") : emptyState()}</div></div></section>`;
  }

  function ticketRow(t) {
    const overdue = isOverdue(t);
    const detailHref = `./cleanhub-pos-ticket-detail.html?ticket=${encodeURIComponent(t.no)}&customer=${encodeURIComponent(t.customer)}`;
    return `<div class="grid grid-cols-[130px_minmax(190px,1.2fr)_100px_110px_110px_150px_110px_90px] items-center border-t border-slate-100 px-5 py-4 text-sm hover:bg-slate-50/70"><div><a href="${detailHref}" class="font-mono text-xs font-semibold text-blue-700 hover:underline">${t.no}</a><div class="mt-1 flex items-center gap-1 text-[11px] text-slate-400">${sourceIcon(t.source)} ${t.source}</div></div><div class="min-w-0"><div class="truncate font-semibold text-slate-800">${esc(t.customer)} <span class="ml-1 font-normal text-slate-400">${esc(t.phone)}</span></div><div class="mt-1 truncate text-xs text-slate-500">${t.items.length} 个项目 · ${t.items.map(x => x.name).join("、")}</div></div><div class="text-xs font-medium text-slate-600">${t.type}</div><div>${badge(t.status)}</div><div>${priorityBadge(t.priority)}</div><div><div class="text-xs font-medium ${overdue ? "text-red-700" : "text-slate-700"}">${formatPickup(t.pickup)}</div>${overdue ? '<div class="mt-1 text-[11px] font-semibold text-red-600">已逾期</div>' : '<div class="mt-1 text-[11px] text-slate-400">预计完成</div>'}</div><div class="text-xs text-slate-600">${t.assistant}</div><div class="flex justify-end gap-1"><a title="查看详情" aria-label="查看详情" href="${detailHref}" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700">${ico("eye")}</a><button title="修改" aria-label="修改工单" onclick="Tickets.edit('${t.no}')" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700">${ico("square-pen")}</button></div></div>`;
  }

  function emptyState() { return `<div class="border-t border-slate-100 px-5 py-14 text-center"><span class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">${ico("search-x","h-5 w-5")}</span><div class="mt-3 font-semibold text-slate-700">${state.scope === "mine" ? "我的工单中没有匹配结果" : "没有匹配的工单"}</div><div class="mt-1 text-sm text-slate-400">请调整关键词、筛选条件或工单范围后重试。</div><button onclick="Tickets.resetFilters()" class="mt-4 text-sm font-semibold text-blue-700">恢复默认筛选</button></div>`; }

  function drawer() {
    const source = tickets.find(t => t.no === state.selectedId);
    if (!source) return "";
    const t = state.editing ? state.draft : source;
    return `<div class="fixed inset-0 z-40 flex justify-end bg-slate-950/30" onclick="Tickets.closeFromBackdrop(event)"><aside data-drawer class="flex h-full w-full max-w-[760px] flex-col bg-white shadow-drawer"><div class="flex items-start gap-3 border-b border-slate-200 px-6 py-5"><span class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">${ico("clipboard-list","h-5 w-5")}</span><div class="min-w-0 flex-1"><div class="flex items-center gap-2"><h2 class="font-mono text-lg font-semibold">${t.no}</h2>${badge(t.status)}${priorityBadge(t.priority)}</div><div class="mt-1 text-xs text-slate-500">工单 ID：${t.id}</div></div><div class="flex gap-2">${state.editing ? `<button onclick="Tickets.cancelEdit()" class="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600">取消</button><button onclick="Tickets.save()" class="flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white">${ico("save")} 保存修改</button>` : `<button onclick="Tickets.startEdit()" class="flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white">${ico("square-pen")} 修改工单</button>`}<button aria-label="关闭" onclick="Tickets.close()" class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">${ico("x")}</button></div></div><div class="scrollbar min-h-0 flex-1 overflow-y-auto">${state.editing ? editView(t) : detailView(t)}</div></aside></div>`;
  }

  function detailView(t) {
    return `<div class="space-y-5 p-6"><section class="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 p-5 lg:grid-cols-4">${summary("客户", t.customer, t.phone)}${summary("工单类型", t.type, t.source)}${summary("预计取件", formatPickup(t.pickup), isOverdue(t) ? "已逾期" : "按时处理中", isOverdue(t))}${summary("工单金额", money(t.amount), "金额快照")}</section><section class="rounded-xl border border-slate-200"><div class="border-b border-slate-200 p-5"><h3 class="font-semibold">工单信息</h3></div><div class="grid grid-cols-2 gap-x-8 gap-y-4 p-5">${detail("客户档案", `${t.customer} · ${t.customerId}`)}${detail("接待店员", t.assistant)}${detail("优先级", t.priority)}${detail("来源渠道", t.source)}${detail("完成时间", t.completedAt)}${detail("取消时间", t.cancelledAt)}${detail("备注", t.remark, true)}</div></section>${itemsSection(t, false)}<section class="rounded-xl border border-slate-200 bg-slate-50 p-4"><div class="flex items-start gap-3">${ico("history","mt-0.5 text-slate-400")}<div class="text-xs leading-5 text-slate-500"><div>创建：${t.createdAt} · Maya C.</div><div>最后修改：${t.updatedAt} · ${t.assistant}</div></div></div></section></div>`;
  }

  function editView(t) {
    return `<div class="space-y-5 p-6"><section class="rounded-xl border border-slate-200"><div class="border-b border-slate-200 p-5"><h3 class="font-semibold">基本信息</h3><p class="mt-1 text-xs text-slate-500">客户档案与工单号不可在此修改。</p></div><div class="grid grid-cols-2 gap-4 p-5">${readonlyField("工单号", t.no)}${readonlyField("客户", `${t.customer} · ${t.customerId}`)}${fieldSelect("ticket-type","工单类型",t.type,typeOptions,"Tickets.updateDraft('type', this.value)")}${fieldSelect("ticket-status","工单状态",t.status,statusOptions,"Tickets.updateDraft('status', this.value)")}${fieldSelect("ticket-priority","优先级",t.priority,priorityOptions,"Tickets.updateDraft('priority', this.value)")}${fieldSelect("ticket-source","来源渠道",t.source,sourceOptions,"Tickets.updateDraft('source', this.value)")}${fieldSelect("ticket-assistant","接待店员",t.assistant,assistantOptions,"Tickets.updateDraft('assistant', this.value)")}${fieldInput("ticket-pickup","预计取件时间",t.pickup,"datetime-local","Tickets.updateDraft('pickup', this.value)")}<label class="col-span-2"><span class="mb-1.5 block text-xs font-semibold text-slate-600">备注</span><textarea oninput="Tickets.updateDraft('remark', this.value)" class="min-h-[88px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-400">${esc(t.remark)}</textarea></label></div></section>${itemsSection(t, true)}<div class="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-800"><div class="flex gap-2">${ico("info","mt-0.5 shrink-0")}<p>工单项目中的单价和行金额是服务定价快照。创建订单时会直接复制这些金额；已经生成的订单不会因本次修改而回写。</p></div></div></div>`;
  }

  function itemsSection(t, editable) {
    return `<section class="overflow-hidden rounded-xl border border-slate-200"><div class="flex items-center justify-between border-b border-slate-200 p-5"><div><h3 class="font-semibold">工单服务项目</h3><p class="mt-1 text-xs text-slate-500">${t.items.length} 个项目 · 数量 ${t.items.reduce((n,x) => n + Number(x.quantity), 0)} · 合计 ${money(t.items.reduce((n,x) => n + Number(x.lineAmount),0))}</p></div>${editable ? '<span class="text-xs text-slate-400">只能修改现有项目</span>' : ""}</div><div class="divide-y divide-slate-100">${t.items.map((item,index) => itemCard(item,index,editable)).join("")}</div></section>`;
  }

  function itemCard(item, index, editable) {
    const open = editable && state.editingItem === index;
    return `<article><div class="grid grid-cols-[minmax(0,1fr)_100px_110px_90px] items-center gap-3 p-5"><div class="min-w-0"><div class="flex items-center gap-2"><span class="font-semibold">${esc(item.name)}</span><span class="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">${item.service}</span></div><div class="mt-1 truncate text-xs text-slate-500">${[item.itemType,item.category,item.color,item.brand,item.material].filter(Boolean).join(" · ")}</div><div class="mt-1 font-mono text-[11px] text-blue-600">标签 ${item.label}</div></div><div>${badge(item.status)}</div><div class="text-right"><div class="font-semibold">${money(item.lineAmount)}</div><div class="mt-1 text-[11px] text-slate-400">${item.quantity} × ${money(item.unitAmount)}</div></div><div class="text-right">${editable ? `<button onclick="Tickets.toggleItem(${index})" class="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">${ico(open ? "chevron-up" : "square-pen","h-3.5 w-3.5")} ${open ? "收起" : "修改"}</button>` : ""}</div></div>${open ? itemForm(item,index) : ""}</article>`;
  }

  function itemForm(item,index) {
    return `<div class="border-t border-slate-100 bg-slate-50/70 p-5"><div class="grid grid-cols-3 gap-4">${readonlyField("标签码",item.label)}${readonlyField("服务",`${item.service} · ${item.serviceId}`)}${fieldSelect("item-status","项目状态",item.status,itemStatusOptions,`Tickets.updateItem(${index}, 'status', this.value)`)}${fieldSelect("item-type","物品类型",item.itemType,["衣物","车","鞋","地毯"],`Tickets.updateItem(${index}, 'itemType', this.value)`)}${fieldInput("item-name","物品名称",item.name,"text",`Tickets.updateItem(${index}, 'name', this.value)`)}${fieldInput("item-category","分类（可选）",item.category,"text",`Tickets.updateItem(${index}, 'category', this.value)`)}${fieldInput("item-color","颜色",item.color,"text",`Tickets.updateItem(${index}, 'color', this.value)`)}${fieldInput("item-brand","品牌",item.brand,"text",`Tickets.updateItem(${index}, 'brand', this.value)`)}${fieldInput("item-material","材质",item.material,"text",`Tickets.updateItem(${index}, 'material', this.value)`)}${numberField("item-quantity","数量",item.quantity,`Tickets.updateItem(${index}, 'quantity', this.value)`)}${numberField("item-unit","单价（XOF）",item.unitAmount,`Tickets.updateItem(${index}, 'unitAmount', this.value)`)}${readonlyField("行金额（自动计算）",money(item.lineAmount))}<label><span class="mb-1.5 block text-xs font-semibold text-slate-600">瑕疵</span><textarea oninput="Tickets.updateItem(${index}, 'defect', this.value)" class="min-h-[72px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-400">${esc(item.defect)}</textarea></label><label><span class="mb-1.5 block text-xs font-semibold text-slate-600">特殊要求</span><textarea oninput="Tickets.updateItem(${index}, 'request', this.value)" class="min-h-[72px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-400">${esc(item.request)}</textarea></label><label><span class="mb-1.5 block text-xs font-semibold text-slate-600">项目备注</span><textarea oninput="Tickets.updateItem(${index}, 'remark', this.value)" class="min-h-[72px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-400">${esc(item.remark)}</textarea></label></div></div>`;
  }

  function summary(label,value,note,danger) { return `<div><div class="text-xs text-slate-400">${label}</div><div class="mt-1 truncate text-sm font-semibold ${danger ? "text-red-700" : "text-slate-800"}">${esc(value)}</div><div class="mt-1 truncate text-[11px] ${danger ? "text-red-500" : "text-slate-400"}">${esc(note)}</div></div>`; }
  function detail(label,value,wide) { return `<div class="${wide ? "col-span-2" : ""}"><div class="text-xs text-slate-400">${label}</div><div class="mt-1 text-sm font-medium text-slate-700">${esc(value)}</div></div>`; }
  function readonlyField(label,value) { return `<label><span class="mb-1.5 block text-xs font-semibold text-slate-600">${label}</span><input disabled value="${esc(value)}" class="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500" /></label>`; }
  function fieldInput(id,label,value,type,onchange) { return `<label><span class="mb-1.5 block text-xs font-semibold text-slate-600">${label}</span><input id="${id}" type="${type}" value="${esc(value)}" oninput="${onchange}" class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" /></label>`; }
  function numberField(id,label,value,onchange) { return `<label><span class="mb-1.5 block text-xs font-semibold text-slate-600">${label}</span><input id="${id}" type="number" min="0" value="${esc(value)}" onchange="${onchange}" class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" /></label>`; }
  function fieldSelect(id,label,value,options,onchange) { return `<label><span class="mb-1.5 block text-xs font-semibold text-slate-600">${label}</span>${select(id,value,options,onchange,"w-full")}</label>`; }
  function select(id,value,options,onchange,extra) { return `<select id="${id}" onchange="${onchange}" class="h-10 min-w-[128px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 ${extra || ""}">${options.map(x => `<option value="${esc(x)}" ${value === x ? "selected" : ""}>${x}</option>`).join("")}</select>`; }

  function badge(status) { const tone = status === "已完成" || status === "已取件" ? "bg-emerald-50 text-emerald-700" : status === "待付款" ? "bg-amber-50 text-amber-700" : status === "待取件" ? "bg-violet-50 text-violet-700" : status === "已开启" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700"; return `<span class="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${tone}">${status}</span>`; }
  function priorityBadge(value) { const tone = value === "最紧急" ? "bg-red-50 text-red-700" : value === "加急" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"; return `<span class="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${tone}">${value}</span>`; }
  function sourceIcon(source) { return ico(source === "WhatsApp" ? "message-circle" : source === "Phone" ? "phone" : source === "App" ? "smartphone" : "monitor", "h-3 w-3"); }
  function toast() { return state.toast ? `<div class="fixed bottom-5 right-5 z-[70] flex min-w-[300px] items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-xl"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">${ico("circle-check")}</span><div><div class="text-sm font-semibold">${esc(state.toast)}</div><div class="mt-1 text-xs text-slate-500">工单列表已同步更新。</div></div></div>` : ""; }
  function ico(name,extra) { return `<i data-lucide="${name}" class="h-4 w-4 ${extra || ""}" aria-hidden="true"></i>`; }
  function money(value) { return `XOF ${Number(value || 0).toLocaleString("en-US")}`; }
  function norm(value) { return String(value || "").trim().toLowerCase(); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
  function formatPickup(value) { const d = new Date(value); return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
  function isOverdue(t) { return new Date(t.pickup) < new Date("2026-06-18T12:00") && !["已取件","已完成"].includes(t.status); }
  function dateMatches(t) { if (state.date === "今天取件") return t.pickup.startsWith("2026-06-18"); if (state.date === "已逾期") return isOverdue(t); if (state.date === "近7天") return new Date(t.pickup) >= new Date("2026-06-12"); return true; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  window.Tickets = {
    quickSearch(value) { state.query = value; render(); setTimeout(() => { const el = document.getElementById("global-ticket-search"); if (el) { el.focus(); el.setSelectionRange(value.length,value.length); } },0); },
    setQuery(value) { state.query = value; render(); setTimeout(() => { const el = document.getElementById("ticket-search"); if (el) { el.focus(); el.setSelectionRange(value.length,value.length); } },0); },
    setScope(scope) { state.scope = scope; render(); },
    setFilter(key,value) { state[key] = value; render(); },
    resetFilters() { Object.assign(state,{scope:"mine",query:"",status:"全部状态",type:"全部类型",priority:"全部优先级",date:"全部日期"}); render(); },
    open(no) { state.selectedId = no; state.editing = false; state.editingItem = null; state.draft = null; render(); },
    edit(no) { state.selectedId = no; this.startEdit(); },
    startEdit() { const source = tickets.find(t => t.no === state.selectedId); state.draft = clone(source); state.editing = true; state.editingItem = null; render(); },
    cancelEdit() { this.close(); },
    close() { state.selectedId = null; state.editing = false; state.editingItem = null; state.draft = null; render(); },
    closeFromBackdrop(event) { if (!event.target.closest("[data-drawer]")) this.close(); },
    updateDraft(key,value) { state.draft[key] = value; },
    toggleItem(index) { state.editingItem = state.editingItem === index ? null : index; render(); },
    updateItem(index,key,value) { const item = state.draft.items[index]; item[key] = ["quantity","unitAmount"].includes(key) ? Math.max(0,Number(value)) : value; item.lineAmount = Number(item.quantity) * Number(item.unitAmount); if (["quantity","unitAmount"].includes(key)) render(); },
    save() { const index = tickets.findIndex(t => t.no === state.selectedId); state.draft.amount = state.draft.items.reduce((sum,item) => sum + Number(item.lineAmount),0); state.draft.updatedAt = "2026-06-18 10:24"; tickets[index] = clone(state.draft); state.selectedId = null; state.editing = false; state.editingItem = null; state.draft = null; state.toast = `${tickets[index].no} 已保存`; render(); setTimeout(() => { state.toast = ""; render(); },2600); }
  };

  render();
})();
