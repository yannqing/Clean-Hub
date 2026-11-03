(function () {
  const noticeTypes = ["系统通知", "业务通知"];
  const readStatuses = ["未读", "已读", "已归档"];
  const priorities = ["普通", "加急", "最紧急", "低优先级"];

  // 模拟数据:对应 notification_deliveries + join notifications 的视图
  const notifications = [
    makeNotice("N-28F4", "D-28F4", "order_ready", "业务通知", "普通", "未读", "订单 OD-28F4 已完成处理", "客户的工单已处理完毕,可以通知取件。", "order", "OD-28F4", "Aminata Diop", "2026-06-18 10:08", null),
    makeNotice("N-28E1", "D-28E1", "ticket_updated", "业务通知", "加急", "未读", "工单 T-28E1 被标记为异常", "西装在处理过程中发现新瑕疵,需要店长确认处理方式。", "ticket", "T-28E1", "Mamadou Sarr", "2026-06-18 09:42", null),
    makeNotice("N-28C2", "D-28C2", "low_cash", "业务通知", "加急", "未读", "钱箱现金不足", "当前钱箱现金余额低于预警阈值,请安排补充。", null, null, null, "2026-06-18 09:15", null),
    makeNotice("N-28B7", "D-28B7", "manager_broadcast", "业务通知", "普通", "已读", "店长广播:下午培训", "今天 15:00 在会议室进行新流程培训,请所有当班店员参加。", null, null, "Maya C.", "2026-06-17 14:20", "2026-06-17 16:30"),
    makeNotice("N-28B1", "D-28B1", "system", "系统通知", "最紧急", "已读", "系统将于今晚维护", "系统将于今晚 23:00-次日 02:00 进行维护升级,期间 POS 无法使用。", null, null, "系统管理员", "2026-06-17 11:00", "2026-06-17 11:05"),
    makeNotice("N-27Z9", "D-27Z9", "order_ready", "业务通知", "普通", "已归档", "订单 OD-27Z1 已完成处理", "会员订阅订单已完成。", "order", "OD-27Z1", "Mariama Ba", "2026-06-16 09:35", "2026-06-16 10:00"),
    makeNotice("N-27Y2", "D-27Y2", "ticket_updated", "业务通知", "普通", "已归档", "工单 T-27Y6 已更新状态", "床单套装已进入清洗流程。", "ticket", "T-27Y6", "Ousmane Kane", "2026-06-16 08:20", "2026-06-16 09:00"),
    makeNotice("N-27W3", "D-27W3", "system", "系统通知", "低优先级", "已归档", "密码即将过期", "您的登录密码将在 7 天后过期,请及时修改。", null, null, "系统管理员", "2026-06-15 18:00", "2026-06-15 18:05")
  ];

  const state = { query: "", readStatus: "全部状态", noticeType: "全部类型", priority: "全部优先级", selectedId: null, toast: "" };

  function makeNotice(id, deliveryId, kind, noticeType, priority, readStatus, title, content, relatedType, relatedId, sender, createdAt, readAt) {
    return { id, deliveryId, kind, noticeType, priority, readStatus, title, content, relatedType, relatedId, sender: sender || "系统", createdAt, readAt };
  }

  function App() { return React.createElement("div", { dangerouslySetInnerHTML: { __html: page() } }); }
  function render() { window.__cleanHubRoot.render(React.createElement(App)); setTimeout(() => window.lucide && lucide.createIcons({ attrs: { "stroke-width": 2 } }), 0); }
  function page() { return `<div class="flex h-screen overflow-hidden bg-page">${sidebar()}<main class="flex min-w-0 flex-1 flex-col">${topbar()}<div class="scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 lg:px-6">${heading()}${metrics()}${filters()}${list()}</div></main>${toast()}</div>`; }

  function sidebar() {
    return `<aside class="hidden w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white xl:flex"><div class="border-b border-slate-100 px-5 py-5"><div class="flex items-center gap-3"><img src="./assets/cleanhub-logo-mark.jpg" class="h-11 w-11 rounded-xl object-cover" alt="CleanHub" /><div><div class="text-lg font-extrabold"><span>Clean</span><span class="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Hub</span></div><div class="text-[10px] font-semibold uppercase tracking-[.22em] text-slate-400">POS</div></div></div><a href="./cleanhub-pos-new-intake.html" class="mt-5 flex h-11 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brandDark">${ico("user-round-plus")} 客户接待</a></div><nav class="scrollbar flex-1 overflow-y-auto px-3 py-4"><div class="space-y-6">${navGroup("业务操作", [["layout-dashboard","工作台","./cleanhub-pos-home.html"],["user-round-plus","客户接待","./cleanhub-pos-new-intake.html"],["search","查询客户","./cleanhub-pos-customers.html"],["scan-line","扫描标签","#"],["wallet-cards","收款","#"]])}${navGroup("业务记录", [["users","客户管理","./cleanhub-pos-customers.html"],["clipboard-list","工单管理","./cleanhub-pos-tickets.html"],["receipt","订单管理","./cleanhub-pos-orders.html"],["chart-no-axes-column-increasing","统计数据","./cleanhub-pos-statistics.html"],["shirt","衣物状态","#"]])}${navGroup("门店管理", [["arrow-left-right","店员交接","#"],["bell","通知中心","./cleanhub-pos-notifications.html",true],["settings","设置","#"]])}</div></nav><div class="border-t border-slate-100 p-4"><div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><div class="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white">MC</div><div><div class="text-sm font-semibold">Maya C.</div><div class="text-xs text-slate-500">收银员</div></div></div></div></aside>`;
  }
  function navGroup(title, items) { return `<div><div class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">${title}</div><div class="space-y-1">${items.map(([i,l,h,a]) => `<a href="${h}" class="relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm ${a ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}">${a ? '<span class="absolute left-0 h-5 w-1 rounded-r-full bg-blue-600"></span>' : ""}<span class="flex h-7 w-7 items-center justify-center">${ico(i)}</span><span class="font-medium">${l}</span></a>`).join("")}</div></div>`; }

  function topbar() {
    return `<header class="flex h-[68px] items-center border-b border-slate-200 bg-white px-6"><div class="flex h-10 w-full max-w-[520px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-focus">${ico("search","mr-2.5 text-slate-400")}<input id="global-search" oninput="Notifications.quickSearch(this.value)" value="${esc(state.query)}" class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="搜索通知标题、内容或关联单号" /></div><div class="ml-auto flex items-center gap-2"><div class="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 lg:flex"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>已同步</div><button class="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold">中文</button><button class="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold">${ico("lock")} 锁定</button><button class="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200">${ico("bell")}<span class="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"></span></button></div></header>`;
  }
  function heading() {
    const unread = notifications.filter(n => n.readStatus === "未读").length;
    return `<div class="flex flex-wrap items-end justify-between gap-4"><div><div class="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><span>POS</span>${ico("chevron-right","h-3 w-3")}<span class="text-slate-600">通知中心</span></div><h1 class="mt-2 text-2xl font-semibold tracking-tight">通知中心</h1><p class="mt-1 text-sm text-slate-500">查看站内通知,管理已读与归档。</p></div><div class="flex items-center gap-2"><button onclick="Notifications.markAllRead()" class="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">${ico("check-check")} 全部标记已读 ${unread ? `<span class="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">${unread}</span>` : ""}</button></div></div>`;
  }

  function metrics() {
    const visible = filteredNotifications();
    const unread = visible.filter(n => n.readStatus === "未读").length;
    const urgent = visible.filter(n => ["加急","最紧急"].includes(n.priority) && n.readStatus === "未读").length;
    const business = visible.filter(n => n.noticeType === "业务通知").length;
    const system = visible.filter(n => n.noticeType === "系统通知").length;
    return `<div class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">${metric("未读通知", unread, "bell-ring", "text-blue-700 bg-blue-50", "需要处理")}${metric("加急未读", urgent, "zap", "text-amber-700 bg-amber-50", "优先查看")}${metric("业务通知", business, "briefcase", "text-violet-700 bg-violet-50", "工单/订单/支付")}${metric("系统通知", system, "server", "text-slate-700 bg-slate-100", "平台公告")}</div>`;
  }
  function metric(label, value, icon, tone, note) { return `<section class="rounded-xl border border-slate-200 bg-white p-4 shadow-panel"><div class="flex items-center justify-between"><div class="text-sm font-medium text-slate-500">${label}</div><span class="flex h-9 w-9 items-center justify-center rounded-lg ${tone}">${ico(icon)}</span></div><div class="mt-2 text-2xl font-semibold">${value}</div><div class="mt-1 text-xs text-slate-400">${note}</div></section>`; }

  function filters() {
    return `<section class="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-panel"><div class="flex flex-wrap items-center gap-3"><div class="flex h-10 min-w-[250px] flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:bg-white">${ico("search","mr-2 text-slate-400")}<input id="notice-search" oninput="Notifications.setQuery(this.value)" value="${esc(state.query)}" class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="标题、内容或关联单号" /></div>${select("read-status", state.readStatus, ["全部状态", ...readStatuses], "Notifications.setFilter('readStatus',this.value)")}${select("notice-type", state.noticeType, ["全部类型", ...noticeTypes], "Notifications.setFilter('noticeType',this.value)")}${select("priority-filter", state.priority, ["全部优先级", ...priorities], "Notifications.setFilter('priority',this.value)")}<button onclick="Notifications.resetFilters()" class="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">${ico("rotate-ccw")} 重置</button></div></section>`;
  }

  function filteredNotifications() {
    const q = norm(state.query);
    return notifications.filter(n => {
      const haystack = [n.title, n.content, n.noticeType, n.priority, n.readStatus, n.relatedType, n.relatedId, n.sender].join(" ").toLowerCase();
      return (!q || haystack.includes(q))
        && (state.readStatus === "全部状态" || n.readStatus === state.readStatus)
        && (state.noticeType === "全部类型" || n.noticeType === state.noticeType)
        && (state.priority === "全部优先级" || n.priority === state.priority);
    });
  }

  function list() {
    const rows = filteredNotifications();
    const grouped = groupByDate(rows);
    const sections = Object.entries(grouped).map(([date, items]) => `${dateLabel(date)}${items.map(noticeRow).join("")}`).join("");
    return `<section class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel"><div class="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 class="font-semibold">通知列表</h2><p class="mt-1 text-xs text-slate-500">共 ${rows.length} 条结果 · 点击通知查看详情</p></div><div class="text-xs text-slate-400">最后同步:10:18</div></div>${rows.length ? `<div class="divide-y divide-slate-100">${sections}</div>` : emptyState()}</section>`;
  }
  function groupByDate(rows) {
    const groups = {};
    rows.forEach(n => {
      const date = n.createdAt.split(" ")[0];
      (groups[date] = groups[date] || []).push(n);
    });
    return groups;
  }
  function dateLabel(date) {
    const today = "2026-06-18";
    const yesterday = "2026-06-17";
    let label = `${new Date(date).getMonth()+1}月${new Date(date).getDate()}日`;
    if (date === today) label = "今天";
    else if (date === yesterday) label = "昨天";
    return `<div class="bg-slate-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-[.1em] text-slate-400">${label}</div>`;
  }
  function noticeRow(n) {
    const isSelected = state.selectedId === n.deliveryId;
    const isUnread = n.readStatus === "未读";
    return `<div class="${isSelected ? "bg-blue-50/60" : isUnread ? "bg-white hover:bg-slate-50/70" : "bg-slate-50/30 hover:bg-slate-50"} border-t border-slate-100 px-5 py-4"><div class="flex items-start gap-3"><div class="relative mt-1 shrink-0">${kindIcon(n.kind)}${isUnread ? '<span class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"></span>' : ""}</div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2">${isUnread ? '<span class="text-sm font-semibold text-slate-900">' : '<span class="text-sm font-medium text-slate-600">'}${esc(n.title)}</span>${priorityBadge(n.priority)}${readStatusBadge(n.readStatus)}${noticeTypeBadge(n.noticeType)}</div><p class="mt-1 text-sm ${isUnread ? "text-slate-700" : "text-slate-500"} line-clamp-2">${esc(n.content)}</p><div class="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">${ico("clock","h-3 w-3")}${formatDateTime(n.createdAt)}<span>·</span><span>来自 ${esc(n.sender)}</span>${n.relatedId ? `<span>·</span><a href="${relatedHref(n)}" class="font-semibold text-blue-700 hover:underline">${n.relatedType === "ticket" ? "工单" : "订单"} ${esc(n.relatedId)}</a>` : ""}</div></div><div class="flex shrink-0 items-center gap-1">${isUnread ? `<button title="标记已读" onclick="Notifications.markRead('${n.deliveryId}')" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700">${ico("check")}</button>` : ""}<button title="归档" onclick="Notifications.archive('${n.deliveryId}')" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-violet-50 hover:text-violet-700">${ico("archive")}</button><button title="查看详情" onclick="Notifications.open('${n.deliveryId}')" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-700">${ico("chevron-right")}</button></div></div>${isSelected ? detailPanel(n) : ""}</div>`;
  }
  function detailPanel(n) {
    return `<div class="mt-4 rounded-xl border border-slate-200 bg-white p-5"><div class="flex items-start justify-between gap-3"><div class="min-w-0 flex-1"><h3 class="text-base font-semibold text-slate-900">${esc(n.title)}</h3><div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">${priorityBadge(n.priority)}${noticeTypeBadge(n.noticeType)}${readStatusBadge(n.readStatus)}</div></div><button aria-label="关闭详情" onclick="Notifications.closeDetail()" class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">${ico("x")}</button></div><div class="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">${detail("发送者", n.sender)}${detail("接收时间", formatDateTime(n.createdAt))}${n.readAt ? detail("阅读时间", formatDateTime(n.readAt)) : ""}${n.relatedId ? detail("关联", `${n.relatedType === "ticket" ? "工单" : "订单"} ${n.relatedId}`) : detail("关联", "无")}<div class="lg:col-span-2"><div class="text-xs text-slate-400">通知内容</div><div class="mt-1 text-sm leading-6 text-slate-700">${esc(n.content)}</div></div></div><div class="mt-5 flex items-center gap-2">${n.readStatus === "未读" ? `<button onclick="Notifications.markRead('${n.deliveryId}')" class="flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brandDark">${ico("check")} 标记已读</button>` : ""}<button onclick="Notifications.archive('${n.deliveryId}')" class="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">${ico("archive")} 归档</button>${n.relatedId ? `<a href="${relatedHref(n)}" class="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">${ico("external-link")} 查看关联${n.relatedType === "ticket" ? "工单" : "订单"}</a>` : ""}</div></div>`;
  }
  function emptyState() { return `<div class="px-5 py-14 text-center"><span class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">${ico("bell-off","h-5 w-5")}</span><div class="mt-3 font-semibold text-slate-700">没有匹配的通知</div><div class="mt-1 text-sm text-slate-400">请调整筛选条件,或等待新通知到达。</div><button onclick="Notifications.resetFilters()" class="mt-4 text-sm font-semibold text-blue-700">清除全部筛选</button></div>`; }

  function relatedHref(n) {
    if (n.relatedType === "ticket") return `./cleanhub-pos-ticket-detail.html?ticket=${encodeURIComponent(n.relatedId)}&customer=${encodeURIComponent(n.sender)}`;
    if (n.relatedType === "order") return `./cleanhub-pos-order-detail.html?order=${encodeURIComponent(n.relatedId)}&customer=${encodeURIComponent(n.sender)}`;
    return "#";
  }
  function kindIcon(kind) {
    const map = { order_ready: ["package-check","text-emerald-600"], ticket_updated: ["clipboard-list","text-blue-600"], low_cash: ["wallet-minimal","text-amber-600"], manager_broadcast: ["megaphone","text-violet-600"], system: ["server","text-slate-600"] };
    const [icon, tone] = map[kind] || ["bell","text-slate-500"];
    return `<span class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 ${tone}">${ico(icon)}</span>`;
  }
  function priorityBadge(priority) {
    const tone = priority === "最紧急" ? "bg-red-50 text-red-700" : priority === "加急" ? "bg-amber-50 text-amber-700" : priority === "低优先级" ? "bg-slate-100 text-slate-500" : "bg-slate-100 text-slate-600";
    return `<span class="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}">${priority}</span>`;
  }
  function noticeTypeBadge(type) {
    const tone = type === "系统通知" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700";
    return `<span class="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}">${type}</span>`;
  }
  function readStatusBadge(status) {
    const tone = status === "未读" ? "bg-blue-50 text-blue-700" : status === "已归档" ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-700";
    return `<span class="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}">${status}</span>`;
  }
  function detail(label, value, wide) { return `<div class="${wide ? "lg:col-span-2" : ""}"><div class="text-xs text-slate-400">${label}</div><div class="mt-1 text-sm font-medium text-slate-700">${esc(value)}</div></div>`; }
  function select(id, value, options, onchange) { return `<select id="${id}" onchange="${onchange}" class="h-10 min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400">${options.map(x => `<option value="${esc(x)}" ${value === x ? "selected" : ""}>${x}</option>`).join("")}</select>`; }
  function toast() { return state.toast ? `<div class="fixed bottom-5 right-5 z-[70] flex min-w-[300px] items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-xl"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">${ico("circle-check")}</span><div><div class="text-sm font-semibold">${esc(state.toast)}</div></div></div>` : ""; }
  function ico(name, extra) { return `<i data-lucide="${name}" class="h-4 w-4 ${extra || ""}" aria-hidden="true"></i>`; }
  function norm(value) { return String(value || "").trim().toLowerCase(); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c])); }
  function formatDateTime(value) { const d = new Date(value.replace(" ", "T")); return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }

  window.Notifications = {
    quickSearch(value) { state.query = value; render(); setTimeout(() => { const el = document.getElementById("global-search"); if (el) { el.focus(); el.setSelectionRange(value.length, value.length); } }, 0); },
    setQuery(value) { state.query = value; render(); setTimeout(() => { const el = document.getElementById("notice-search"); if (el) { el.focus(); el.setSelectionRange(value.length, value.length); } }, 0); },
    setFilter(key, value) { state[key] = value; render(); },
    resetFilters() { Object.assign(state, { query: "", readStatus: "全部状态", noticeType: "全部类型", priority: "全部优先级" }); render(); },
    open(deliveryId) {
      const n = notifications.find(x => x.deliveryId === deliveryId);
      if (!n) return;
      state.selectedId = state.selectedId === deliveryId ? null : deliveryId;
      // 打开详情时自动标记已读
      if (state.selectedId && n.readStatus === "未读") {
        n.readStatus = "已读"; n.readAt = "2026-06-18 10:32";
        state.toast = "已标记为已读";
        setTimeout(() => { state.toast = ""; render(); }, 2200);
      }
      render();
    },
    closeDetail() { state.selectedId = null; render(); },
    markRead(deliveryId) {
      const n = notifications.find(x => x.deliveryId === deliveryId);
      if (!n || n.readStatus !== "未读") return;
      n.readStatus = "已读"; n.readAt = "2026-06-18 10:32";
      state.toast = "已标记为已读"; render();
      setTimeout(() => { state.toast = ""; render(); }, 2200);
    },
    markAllRead() {
      let count = 0;
      notifications.forEach(n => { if (n.readStatus === "未读") { n.readStatus = "已读"; n.readAt = "2026-06-18 10:32"; count++; } });
      state.toast = count ? `已将 ${count} 条通知标记为已读` : "没有未读通知"; render();
      setTimeout(() => { state.toast = ""; render(); }, 2200);
    },
    archive(deliveryId) {
      const n = notifications.find(x => x.deliveryId === deliveryId);
      if (!n) return;
      n.readStatus = "已归档";
      if (state.selectedId === deliveryId) state.selectedId = null;
      state.toast = "已归档"; render();
      setTimeout(() => { state.toast = ""; render(); }, 2200);
    }
  };
  render();
})();
