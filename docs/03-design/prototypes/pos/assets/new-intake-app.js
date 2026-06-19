(function () {
  const accounts = [
    {
      id: "CA-01HZX91K",
      name: "Diop Family & Co.",
      phone: "+221 77 000 0000",
      email: "family.diop@example.com",
      profiles: [
        profile("CU-01HZXA01", "Aminata Diop", "+221 77 000 0000", "aminata@example.com", "Primary", "Today, 09:42", 8500, "VIP"),
        profile("CU-01HZXA02", "Mamadou Diop", "+221 78 111 2200", "mamadou.diop@example.com", "Family", "Jun 12, 2026", 0, "Standard"),
        profile("CU-01HZXA03", "Awa Diop", "+221 76 333 0044", "awa.diop@example.com", "Family", "Jun 10, 2026", 2000, "Standard"),
        profile("CU-01HZXA04", "Ibrahima Diop", "", "ibrahima@example.com", "Employee", "Jun 08, 2026", 0, "Corporate"),
        profile("CU-01HZXA05", "Mariama Diop", "+221 77 000 0000", "", "Family", "May 29, 2026", 1250, "Standard"),
        profile("CU-01HZXA06", "Ousmane Diop", "", "ousmane@example.com", "Employee", "May 24, 2026", 0, "Corporate"),
        profile("CU-01HZXA07", "Fatou Diop", "+221 75 010 2200", "fatou.diop@example.com", "Family", "May 18, 2026", 500, "Standard"),
        profile("CU-01HZXA08", "Cheikh Diop", "", "cheikh@example.com", "Employee", "May 02, 2026", 0, "Corporate"),
        profile("CU-01HZXA09", "Ndeye Diop", "+221 70 202 3344", "ndeye@example.com", "Family", "Apr 28, 2026", 3200, "Standard"),
        profile("CU-01HZXA10", "Diop Household", "+221 77 000 0000", "", "Shared", "Apr 11, 2026", 0, "Shared"),
        profile("CU-01HZXA11", "Samba Diop", "", "samba@example.com", "Employee", "Mar 30, 2026", 0, "Corporate"),
        profile("CU-01HZXA12", "Khady Diop", "+221 78 990 1199", "khady@example.com", "Family", "Mar 22, 2026", 1000, "Standard")
      ]
    },
    {
      id: "CA-01J11F3P",
      name: "Sarr Account",
      phone: "+221 70 555 0198",
      email: "mamadou.sarr@example.com",
      profiles: [profile("CU-01J11F4A", "Mamadou Sarr", "+221 70 555 0198", "mamadou.sarr@example.com", "Primary", "Yesterday", 0, "Standard")]
    }
  ];

  const state = {
    query: "+221 77 000 0000",
    resultFilter: "",
    searched: true,
    page: 1,
    pageSize: 5,
    matchedAccountIds: ["CA-01HZX91K"],
    matchSource: "account",
    profileAccountId: null,
    modal: null,
    toast: null
  };

  function profile(id, name, phone, email, relationship, lastVisit, balance, tier) {
    return { id, name, phone, email, relationship, lastVisit, balance, tier };
  }

  function App() {
    return React.createElement("div", { dangerouslySetInnerHTML: { __html: renderPage() } });
  }

  function render() {
    window.__cleanHubRoot.render(React.createElement(App));
  }

  function renderPage() {
    return `
      <div class="flex h-screen overflow-hidden bg-page">
        ${renderSidebar()}
        <main class="flex min-w-0 flex-1 flex-col">
          ${renderTopbar()}
          <div class="scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
            ${renderHeader()}
            ${renderSearchPanel()}
          </div>
        </main>
        ${renderModal()}
        ${renderToast()}
      </div>`;
  }

  function renderSidebar() {
    return `
      <aside class="flex w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white">
        <div class="border-b border-slate-100 px-5 py-5">
          <div class="flex items-center gap-3">
            <img src="./assets/cleanhub-logo-mark.jpg" class="h-11 w-11 rounded-xl object-cover" alt="CleanHub mark" />
            <div><div class="text-lg font-extrabold"><span class="text-slate-950">Clean</span><span class="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Hub</span></div><div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">POS</div></div>
          </div>
          <button onclick="NewIntakeDemo.focusSearch()" class="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brandDark">${icon("user-plus", "h-4 w-4")} New Intake</button>
        </div>
        <nav class="scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-4"><div class="space-y-6">
          ${navGroup("Operate", [["layout-dashboard", "Workspace", false, "./cleanhub-pos-home.html"], ["user-plus", "New Intake", true, "./cleanhub-pos-new-intake.html"], ["search", "Find Customer", false, "./cleanhub-pos-customers.html"], ["scan-line", "Scan Label", false, "#"], ["wallet-cards", "Take Payment", false, "#"]])}
          ${navGroup("Records", [["users", "Customers", false, "./cleanhub-pos-customers.html"], ["clipboard-list", "Tickets", false, "./cleanhub-pos-tickets.html"], ["receipt", "Orders", false, "./cleanhub-pos-orders.html"], ["chart", "Statistics", false, "./cleanhub-pos-statistics.html"], ["shirt", "Garments", false, "#"]])}
          ${navGroup("Store", [["replace", "Shift Handover", false, "#"], ["bell", "Notifications", false, "#"], ["settings", "Settings", false, "#"]])}
        </div></nav>
        <div class="border-t border-slate-100 p-4"><div class="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><div class="brand-gradient flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white">MC</div><div><div class="text-sm font-semibold text-slate-900">Maya C.</div><div class="text-xs text-slate-500">Cashier</div></div></div></div>
      </aside>`;
  }

  function renderTopbar() {
    return `
      <header class="flex h-[68px] items-center gap-4 border-b border-slate-200 bg-white px-6">
        <div class="flex h-10 w-full max-w-[520px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-focus">
          ${icon("search", "mr-2.5 h-4 w-4 text-slate-400")}<input class="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Search customer, ticket, order, or label" />
        </div>
        <div class="ml-auto flex items-center gap-2"><div class="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 lg:flex"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>Synced</div><button class="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700">EN</button><button class="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700">${icon("lock", "h-4 w-4")} Lock</button><button class="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200">${icon("bell", "h-4 w-4")}<span class="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"></span></button></div>
      </header>`;
  }

  function renderHeader() {
    return `
      <div class="mb-5 flex items-end justify-between gap-5">
        <div><div class="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><span>POS</span>${icon("chevron-right", "h-3.5 w-3.5")}<span class="text-slate-600">New Intake</span></div><h1 class="mt-2 text-2xl font-semibold text-slate-950">Find a customer profile</h1><p class="mt-1 text-sm text-slate-500">Search the account contact first. Profile phone and email are checked automatically as a fallback.</p></div>
        <button onclick="NewIntakeDemo.openCreate()" class="flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100">${icon("user-plus", "h-4 w-4")} New Customer</button>
      </div>`;
  }

  function renderSearchPanel() {
    const results = filteredProfiles();
    const pageCount = Math.max(1, Math.ceil(results.length / state.pageSize));
    if (state.page > pageCount) state.page = pageCount;
    const start = (state.page - 1) * state.pageSize;
    const rows = results.slice(start, start + state.pageSize);
    return `
      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel">
        <div class="border-b border-slate-200 p-5">
          <div class="flex gap-3">
            <div class="flex h-12 min-w-0 flex-1 items-center rounded-lg border border-blue-200 bg-blue-50/50 px-3 focus-within:border-blue-400 focus-within:bg-white focus-within:shadow-focus">${icon("search", "mr-2.5 h-4.5 w-4.5 text-blue-500")}<input id="primary-search" value="${escapeHtml(state.query)}" onkeydown="if(event.key==='Enter') NewIntakeDemo.search()" class="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-slate-400" placeholder="Enter account or profile phone / email" /><button onclick="NewIntakeDemo.search()" class="h-9 rounded-md bg-brand px-5 text-sm font-semibold text-white hover:bg-brandDark">Search</button></div>
          </div>
          <div class="mt-3 flex items-center gap-2 text-xs text-slate-500"><span>Examples:</span><button onclick="NewIntakeDemo.quickSearch('+221 77 000 0000')" class="font-semibold text-blue-700">shared account phone</button><span>·</span><button onclick="NewIntakeDemo.quickSearch('mamadou.diop@example.com')" class="font-semibold text-blue-700">profile email fallback</button></div>
        </div>
        ${state.searched ? renderResults(rows, results.length, start, pageCount) : renderPrompt()}
      </section>`;
  }

  function renderResults(rows, total, start, pageCount) {
    if (!total) return `<div class="flex min-h-[360px] flex-col items-center justify-center px-6 text-center"><div class="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">${icon("search", "h-5 w-5")}</div><h2 class="mt-4 text-base font-semibold text-slate-950">No customer profile found</h2><p class="mt-1 max-w-md text-sm text-slate-500">No account or profile contact matches “${escapeHtml(state.query)}”. Create the account first, then add its first profile.</p><button onclick="NewIntakeDemo.openCreate()" class="mt-5 h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">Create Customer</button></div>`;
    return `
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
        <div><div class="text-sm font-semibold text-slate-900">${total} customer profiles</div><div class="mt-0.5 text-xs text-slate-500">${state.matchSource === "account" ? "Account contact matched · showing every linked profile" : "Profile contact fallback matched"}</div></div>
        <div class="flex items-center gap-2"><div class="flex h-9 w-[260px] items-center rounded-lg border border-slate-200 bg-white px-3">${icon("search", "mr-2 h-3.5 w-3.5 text-slate-400")}<input id="result-filter" value="${escapeHtml(state.resultFilter)}" oninput="NewIntakeDemo.filterResults(this.value)" class="h-full min-w-0 flex-1 text-sm outline-none" placeholder="Filter profiles in results" /></div><button onclick="NewIntakeDemo.openCreateProfile()" class="flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">${icon("user-plus", "h-3.5 w-3.5")} New Profile</button><select onchange="NewIntakeDemo.setPageSize(this.value)" class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600"><option value="5" ${state.pageSize === 5 ? "selected" : ""}>5 / page</option><option value="10" ${state.pageSize === 10 ? "selected" : ""}>10 / page</option></select></div>
      </div>
      <div class="overflow-x-auto"><div class="min-w-[900px]">
        <div class="grid grid-cols-[minmax(220px,1.2fr)_minmax(170px,1fr)_minmax(220px,1.2fr)_120px_130px_90px] bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"><div>Customer profile</div><div>Account</div><div>Profile contact</div><div>Last visit</div><div class="text-right">Balance</div><div></div></div>
        ${rows.map(renderProfileRow).join("")}
      </div></div>
      <div class="flex items-center justify-between border-t border-slate-200 px-5 py-4"><div class="text-sm text-slate-500">Showing <span class="font-semibold text-slate-700">${start + 1}-${Math.min(start + state.pageSize, total)}</span> of <span class="font-semibold text-slate-700">${total}</span></div><div class="flex items-center gap-1"><button onclick="NewIntakeDemo.goPage(${state.page - 1})" ${state.page === 1 ? "disabled" : ""} class="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 disabled:opacity-40">Previous</button>${pagination(pageCount)}<button onclick="NewIntakeDemo.goPage(${state.page + 1})" ${state.page === pageCount ? "disabled" : ""} class="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 disabled:opacity-40">Next</button></div></div>`;
  }

  function renderProfileRow(entry) {
    const p = entry.profile;
    return `<div class="grid grid-cols-[minmax(220px,1.2fr)_minmax(170px,1fr)_minmax(220px,1.2fr)_120px_130px_90px] items-center border-t border-slate-100 px-5 py-3.5 text-sm hover:bg-blue-50/30"><div class="flex min-w-0 items-center gap-3"><div class="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white">${initials(p.name)}</div><div class="min-w-0"><div class="truncate font-semibold text-slate-950">${escapeHtml(p.name)}</div><div class="mt-0.5 flex items-center gap-2 text-xs text-slate-500"><span>${escapeHtml(p.relationship)}</span><span class="rounded bg-slate-100 px-1.5 py-0.5 font-medium">${escapeHtml(p.tier)}</span></div></div></div><div class="min-w-0"><div class="truncate font-medium text-slate-700">${escapeHtml(entry.account.name)}</div><div class="truncate text-xs text-slate-400">${escapeHtml(entry.account.phone)}</div></div><div class="min-w-0"><div class="truncate text-slate-700">${escapeHtml(p.phone || "No profile phone")}</div><div class="truncate text-xs text-slate-500">${escapeHtml(p.email || "No profile email")}</div></div><div class="text-slate-500">${escapeHtml(p.lastVisit)}</div><div class="text-right font-semibold text-slate-950">${money(p.balance)}</div><div class="text-right"><button onclick="NewIntakeDemo.selectProfile('${entry.account.id}','${p.id}')" class="h-9 rounded-lg bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100">Select</button></div></div>`;
  }

  function renderPrompt() {
    return `<div class="flex min-h-[360px] flex-col items-center justify-center text-center"><div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">${icon("users", "h-5 w-5")}</div><h2 class="mt-4 font-semibold text-slate-950">Search before starting service</h2><p class="mt-1 max-w-md text-sm text-slate-500">A shared account contact may return many profiles. Select the exact person receiving the service.</p></div>`;
  }

  function pagination(pageCount) {
    return Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => `<button onclick="NewIntakeDemo.goPage(${page})" class="h-9 min-w-9 rounded-lg text-sm font-semibold ${page === state.page ? "bg-brand text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}">${page}</button>`).join("");
  }

  function renderModal() {
    if (state.modal === "profile") return renderProfileModal();
    if (state.modal !== "create") return "";
    return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"><div class="w-full max-w-xl rounded-xl bg-white shadow-2xl"><div class="flex items-start justify-between border-b border-slate-200 p-5"><div><h2 class="text-lg font-semibold text-slate-950">Create customer account</h2><p class="mt-1 text-sm text-slate-500">The account is created first, then its first customer profile.</p></div><button onclick="NewIntakeDemo.closeModal()" class="h-9 w-9 rounded-lg text-xl text-slate-400 hover:bg-slate-100">×</button></div><div class="grid grid-cols-2 gap-4 p-5">${field("account-name", "Account name", "e.g. Ndiaye Family")}${field("account-phone", "Account phone", "+221 ...")}${field("profile-name", "Profile full name", "Full name")}${field("profile-email", "Profile email", "name@example.com")}</div><div class="flex justify-end gap-2 border-t border-slate-200 p-4"><button onclick="NewIntakeDemo.closeModal()" class="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">Cancel</button><button onclick="NewIntakeDemo.createCustomer()" class="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">Create and continue</button></div></div></div>`;
  }

  function renderProfileModal() {
    const account = accounts.find((item) => item.id === state.profileAccountId);
    if (!account) return "";
    return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"><div class="w-full max-w-xl rounded-xl bg-white shadow-2xl"><div class="flex items-start justify-between border-b border-slate-200 p-5"><div><h2 class="text-lg font-semibold text-slate-950">Create customer profile</h2><p class="mt-1 text-sm text-slate-500">Add a new profile to the selected customer account.</p></div><button onclick="NewIntakeDemo.closeModal()" class="h-9 w-9 rounded-lg text-xl text-slate-400 hover:bg-slate-100">×</button></div><div class="border-b border-slate-100 bg-slate-50 px-5 py-3"><div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer account</div><div class="mt-1 flex items-center justify-between"><div class="text-sm font-semibold text-slate-900">${escapeHtml(account.name)}</div><div class="text-xs text-slate-500">${escapeHtml(account.phone || account.email)}</div></div></div><div class="grid grid-cols-2 gap-4 p-5">${field("new-profile-name", "Profile full name", "Full name")}${field("new-profile-phone", "Profile phone", "+221 ...")}${field("new-profile-email", "Profile email", "name@example.com")}<label class="block"><span class="mb-1.5 block text-xs font-semibold text-slate-600">Relationship</span><select id="new-profile-relationship" class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"><option value="Family">Family</option><option value="Employee">Employee</option><option value="Shared">Shared</option><option value="Primary">Primary</option></select></label></div><div class="flex justify-end gap-2 border-t border-slate-200 p-4"><button onclick="NewIntakeDemo.closeModal()" class="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">Cancel</button><button onclick="NewIntakeDemo.createProfile()" class="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">Create profile and continue</button></div></div></div>`;
  }

  function renderToast() {
    if (!state.toast) return "";
    return `<div class="fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-xl"><div class="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500"></div><div><div class="text-sm font-semibold text-slate-950">${escapeHtml(state.toast.title)}</div><div class="mt-0.5 text-xs text-slate-500">${escapeHtml(state.toast.message)}</div></div></div>`;
  }

  function field(id, label, placeholder) { return `<label class="block"><span class="mb-1.5 block text-xs font-semibold text-slate-600">${label}</span><input id="${id}" class="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400" placeholder="${placeholder}" /></label>`; }
  function matchedAccounts() { return accounts.filter((a) => state.matchedAccountIds.includes(a.id)); }
  function filteredProfiles() { const q = normalize(state.resultFilter); return matchedAccounts().flatMap((account) => account.profiles.map((p) => ({ account, profile: p }))).filter(({ profile: p }) => !q || [p.name, p.phone, p.email, p.relationship, p.tier].some((v) => normalize(v).includes(q))); }
  function runSearch(query) { const q = normalize(query); const accountMatches = accounts.filter((a) => normalize(a.phone).includes(q) || normalize(a.email).includes(q)); if (accountMatches.length) { state.matchedAccountIds = accountMatches.map((a) => a.id); state.matchSource = "account"; } else { const profileMatches = accounts.filter((a) => a.profiles.some((p) => normalize(p.phone).includes(q) || normalize(p.email).includes(q))); state.matchedAccountIds = profileMatches.map((a) => a.id); state.matchSource = "profile"; } state.searched = true; state.resultFilter = ""; state.page = 1; }
  function value(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function normalize(v) { return String(v || "").trim().toLowerCase().replace(/[\s()-]/g, ""); }
  function initials(name) { return name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase(); }
  function money(n) { return `XOF ${Number(n).toLocaleString("en-US")}`; }
  function escapeHtml(v) { return String(v || "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }

  window.NewIntakeDemo = {
    focusSearch() { document.getElementById("primary-search")?.focus(); },
    search() { state.query = value("primary-search"); if (!state.query) return; runSearch(state.query); render(); },
    quickSearch(q) { state.query = q; runSearch(q); render(); },
    filterResults(q) { state.resultFilter = q; state.page = 1; render(); setTimeout(() => { const input = document.getElementById("result-filter"); if (input) { input.focus(); input.setSelectionRange(q.length, q.length); } }, 0); },
    setPageSize(size) { state.pageSize = Number(size); state.page = 1; render(); },
    goPage(page) { const max = Math.max(1, Math.ceil(filteredProfiles().length / state.pageSize)); state.page = Math.min(max, Math.max(1, page)); render(); },
    selectProfile(accountId, profileId) {
      const account = accounts.find((item) => item.id === accountId);
      const customer = account && account.profiles.find((item) => item.id === profileId);
      const query = new URLSearchParams({
        account: accountId,
        profile: profileId,
        accountName: account ? account.name : "Customer account",
        name: customer ? customer.name : "Customer profile",
        phone: customer ? customer.phone : "",
        email: customer ? customer.email : "",
        relationship: customer ? customer.relationship : "Profile",
        tier: customer ? customer.tier : "Standard",
        balance: customer ? String(customer.balance) : "0"
      });
      window.location.href = `./cleanhub-pos-customer-service.html?${query.toString()}`;
    },
    openCreate() { state.modal = "create"; render(); },
    openCreateProfile() {
      const matched = matchedAccounts();
      if (matched.length !== 1) {
        state.toast = { title: "Select a customer account first", message: "Search and confirm one customer account before adding a profile." };
        render();
        return;
      }
      state.profileAccountId = matched[0].id;
      state.modal = "profile";
      render();
    },
    closeModal() { state.modal = null; state.profileAccountId = null; render(); },
    createProfile() {
      const account = accounts.find((item) => item.id === state.profileAccountId);
      const name = value("new-profile-name");
      if (!account || !name) {
        state.toast = { title: "Profile name is required", message: "Enter the customer's full name before continuing." };
        render();
        return;
      }
      const profileId = `CU-DEMO-${Date.now()}`;
      account.profiles.unshift(profile(profileId, name, value("new-profile-phone"), value("new-profile-email"), value("new-profile-relationship") || "Family", "New customer", 0, "Standard"));
      window.NewIntakeDemo.selectProfile(account.id, profileId);
    },
    createCustomer() { const accountName = value("account-name"); const phone = value("account-phone"); const name = value("profile-name"); if (!accountName || !phone || !name) { state.toast = { title: "Required details missing", message: "Account name, account phone, and profile name are required." }; render(); return; } const aid = `CA-DEMO-${Date.now()}`; const pid = `CU-DEMO-${Date.now()}`; accounts.unshift({ id: aid, name: accountName, phone, email: "", profiles: [profile(pid, name, phone, value("profile-email"), "Primary", "New customer", 0, "Standard")] }); window.location.href = `./cleanhub-pos-customer-service.html?account=${encodeURIComponent(aid)}&profile=${encodeURIComponent(pid)}&name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&accountName=${encodeURIComponent(accountName)}`; }
  };

  render();
})();
