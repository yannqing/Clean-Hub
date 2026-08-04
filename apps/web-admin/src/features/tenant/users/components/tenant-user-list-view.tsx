"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@cleanhub/ui";
import {
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCog,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Pagination } from "@/components/pagination";
import { useTenantI18n } from "@/i18n";

import {
  createTenantUserAction,
  resetTenantUserPasswordAction,
  resetTenantUserPinAction,
  updateTenantUserAction,
  updateTenantUserStatusAction,
} from "../actions";
import { getTenantUserListQuery } from "../queries";
import type {
  BranchSummary,
  CreateTenantUserRequest,
  ManagedTenantUserRoleCode,
  TenantUserRoleCode,
  TenantUserStatus,
  TenantUserSummary,
  UpdateTenantUserRequest,
} from "../types";

const PAGE_SIZE = 10;

const COPY = {
  en: {
    title: "Team members",
    add: "Add employee",
    search: "Search name, email or phone",
    allStatus: "All statuses",
    allRoles: "All roles",
    allBranches: "All branches",
    refresh: "Refresh",
    name: "Employee",
    role: "Role",
    branch: "Branch",
    status: "Status",
    lastLogin: "Last login",
    actions: "Actions",
    empty: "No employees match these filters.",
    owner: "Owner",
    manager: "Manager",
    cashier: "Cashier",
    active: "Active",
    disabled: "Disabled",
    invited: "Invited",
    suspended: "Suspended",
    never: "Never",
    edit: "Edit",
    credentials: "Credentials",
    enable: "Enable",
    disable: "Disable",
    createTitle: "Add employee",
    createDescription:
      "Managers use email and password in the admin, while every employee uses a unique six-digit PIN at POS.",
    displayName: "Display name",
    email: "Email",
    phone: "Phone",
    password: "Password",
    pin: "Six-digit PIN",
    language: "Language",
    selectBranch: "Select a branch",
    cancel: "Cancel",
    create: "Create employee",
    saving: "Saving...",
    editTitle: "Edit employee",
    editDescription: "Update identity, role and the employee's single branch assignment.",
    save: "Save changes",
    statusTitle: "Change employee status",
    statusDescription: "Disabling an employee revokes their active refresh sessions.",
    reason: "Reason",
    reasonPlaceholder: "Explain why this change is required",
    confirm: "Confirm",
    credentialTitle: "Reset credentials",
    credentialDescription:
      "The new value is hashed before storage and is never written to audit logs.",
    credentialType: "Credential",
    passwordCredential: "Password",
    pinCredential: "POS PIN",
    newPassword: "New password",
    newPin: "New six-digit PIN",
    reset: "Reset credential",
    protectedOwner: "Owner accounts are protected here.",
    created: "Employee created.",
    updated: "Employee updated.",
    statusUpdated: "Employee status updated.",
    credentialUpdated: "Credential reset completed.",
    required: "Complete all required fields.",
  },
  "zh-CN": {
    title: "员工管理",
    add: "添加员工",
    search: "搜索姓名、邮箱或手机号",
    allStatus: "全部状态",
    allRoles: "全部角色",
    allBranches: "全部门店",
    refresh: "刷新",
    name: "员工",
    role: "角色",
    branch: "门店",
    status: "状态",
    lastLogin: "最后登录",
    actions: "操作",
    empty: "没有符合当前筛选条件的员工。",
    owner: "租户所有者",
    manager: "门店管理员",
    cashier: "收银员",
    active: "启用",
    disabled: "停用",
    invited: "待激活",
    suspended: "已暂停",
    never: "从未登录",
    edit: "编辑",
    credentials: "重置凭证",
    enable: "启用",
    disable: "停用",
    createTitle: "添加员工",
    createDescription:
      "门店管理员使用邮箱和密码登录管理端；所有员工在 POS 使用门店内唯一的六位数字 PIN。",
    displayName: "员工姓名",
    email: "邮箱",
    phone: "手机号",
    password: "登录密码",
    pin: "六位数字 PIN",
    language: "语言",
    selectBranch: "选择门店",
    cancel: "取消",
    create: "创建员工",
    saving: "保存中...",
    editTitle: "编辑员工",
    editDescription: "修改员工资料、角色以及唯一归属门店。",
    save: "保存修改",
    statusTitle: "修改员工状态",
    statusDescription: "停用员工后，将撤销该员工现有的刷新会话。",
    reason: "操作原因",
    reasonPlaceholder: "请说明执行该操作的原因",
    confirm: "确认",
    credentialTitle: "重置登录凭证",
    credentialDescription: "新凭证只以哈希形式入库，审计日志不会记录明文。",
    credentialType: "凭证类型",
    passwordCredential: "登录密码",
    pinCredential: "POS PIN",
    newPassword: "新密码",
    newPin: "新的六位 PIN",
    reset: "确认重置",
    protectedOwner: "租户所有者账号不能在员工管理中修改。",
    created: "员工已创建。",
    updated: "员工资料已更新。",
    statusUpdated: "员工状态已更新。",
    credentialUpdated: "登录凭证已重置。",
    required: "请填写所有必填字段。",
  },
} as const;

type EmployeeForm = {
  displayName: string;
  email: string;
  phone: string;
  roleCode: ManagedTenantUserRoleCode;
  branchId: string;
  password: string;
  pin: string;
  language: "en" | "fr" | "zh-CN";
};

const EMPTY_FORM: EmployeeForm = {
  displayName: "",
  email: "",
  phone: "",
  roleCode: "cashier",
  branchId: "",
  password: "",
  pin: "",
  language: "en",
};

type TenantUserListViewProps = {
  currentRole: "owner" | "manager";
  currentUserId: string;
  initialBranches: BranchSummary[];
  initialError?: string;
  initialUsers: TenantUserSummary[];
};

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function TenantUserListView({
  currentRole,
  currentUserId,
  initialBranches,
  initialError,
  initialUsers,
}: TenantUserListViewProps) {
  const { locale, formatDateTime } = useTenantI18n();
  const copy = COPY[locale];
  const firstLoad = useRef(true);
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | TenantUserStatus>("all");
  const [role, setRole] = useState<"all" | TenantUserRoleCode>("all");
  const [branchId, setBranchId] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EmployeeForm>(() => ({
    ...EMPTY_FORM,
    roleCode: currentRole === "manager" ? "cashier" : "manager",
    branchId: currentRole === "manager" ? initialBranches[0]?.id ?? "" : "",
  }));
  const [editUser, setEditUser] = useState<TenantUserSummary | null>(null);
  const [editForm, setEditForm] = useState<UpdateTenantUserRequest>({});
  const [statusUser, setStatusUser] = useState<TenantUserSummary | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [credentialUser, setCredentialUser] = useState<TenantUserSummary | null>(null);
  const [credentialType, setCredentialType] = useState<"pin" | "password">("pin");
  const [credentialValue, setCredentialValue] = useState("");
  const [credentialReason, setCredentialReason] = useState("");
  const [saving, setSaving] = useState(false);

  const query = useMemo(
    () => ({
      q: search.trim() || undefined,
      status: status === "all" ? undefined : status,
      roleCode: role === "all" ? undefined : role,
      branchId: branchId === "all" ? undefined : branchId,
      limit: PAGE_SIZE,
      offset,
    }),
    [branchId, offset, role, search, status],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await getTenantUserListQuery(query));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const timer = window.setTimeout(() => void loadUsers(), 250);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const branchNames = useMemo(
    () => new Map(initialBranches.map((branch) => [branch.id, branch.name])),
    [initialBranches],
  );

  function roleLabel(roleCode: string) {
    return roleCode === "owner"
      ? copy.owner
      : roleCode === "manager"
        ? copy.manager
        : roleCode === "cashier"
          ? copy.cashier
          : roleCode;
  }

  function statusLabel(value: TenantUserStatus) {
    return copy[value];
  }

  function updateCreateForm<K extends keyof EmployeeForm>(
    key: K,
    value: EmployeeForm[K],
  ) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  async function submitCreate() {
    if (
      !createForm.displayName.trim() ||
      !createForm.branchId ||
      createForm.pin.length !== 6 ||
      (createForm.roleCode === "manager" &&
        (!createForm.email.trim() || !createForm.password))
    ) {
      toast.error(copy.required);
      return;
    }
    setSaving(true);
    const input: CreateTenantUserRequest = {
      displayName: createForm.displayName.trim(),
      email: createForm.email.trim() || undefined,
      phone: createForm.phone.trim() || undefined,
      roleCode: createForm.roleCode,
      branchId: createForm.branchId,
      password: createForm.password || undefined,
      pin: createForm.pin,
      language: createForm.language,
    };
    const result = await createTenantUserAction(input);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(copy.created);
    setCreateOpen(false);
    setCreateForm({
      ...EMPTY_FORM,
      roleCode: currentRole === "manager" ? "cashier" : "manager",
      branchId: currentRole === "manager" ? initialBranches[0]?.id ?? "" : "",
    });
    setOffset(0);
    await loadUsers();
  }

  function openEdit(user: TenantUserSummary) {
    if (user.role === "owner" || user.id === currentUserId) return;
    setEditUser(user);
    setEditForm({
      displayName: user.displayName,
      email: user.email ?? undefined,
      phone: user.phone,
      roleCode:
        user.role === "manager" || user.role === "cashier"
          ? user.role
          : undefined,
      branchId: user.branchIds[0],
    });
  }

  async function submitEdit() {
    if (
      !editUser ||
      !editForm.displayName?.trim() ||
      !editForm.branchId ||
      (editForm.roleCode === "manager" &&
        editUser.role !== "manager" &&
        !editForm.password)
    ) {
      toast.error(copy.required);
      return;
    }
    setSaving(true);
    const result = await updateTenantUserAction(editUser.id, {
      ...editForm,
      displayName: editForm.displayName.trim(),
      email: editForm.email?.trim() || undefined,
      phone: editForm.phone?.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(copy.updated);
    setEditUser(null);
    await loadUsers();
  }

  async function submitStatus() {
    if (!statusUser || !statusReason.trim()) {
      toast.error(copy.required);
      return;
    }
    setSaving(true);
    const result = await updateTenantUserStatusAction(statusUser.id, {
      status: statusUser.status === "disabled" ? "active" : "disabled",
      reason: statusReason.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(copy.statusUpdated);
    setStatusUser(null);
    setStatusReason("");
    await loadUsers();
  }

  async function submitCredential() {
    if (
      !credentialUser ||
      !credentialReason.trim() ||
      !credentialValue ||
      (credentialType === "pin" && credentialValue.length !== 6)
    ) {
      toast.error(copy.required);
      return;
    }
    setSaving(true);
    const result =
      credentialType === "pin"
        ? await resetTenantUserPinAction(credentialUser.id, {
            pin: credentialValue,
            reason: credentialReason.trim(),
          })
        : await resetTenantUserPasswordAction(credentialUser.id, {
            password: credentialValue,
            reason: credentialReason.trim(),
          });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(copy.credentialUpdated);
    setCredentialUser(null);
    setCredentialValue("");
    setCredentialReason("");
  }

  const roleOptions: ManagedTenantUserRoleCode[] =
    currentRole === "owner" ? ["manager", "cashier"] : ["cashier"];

  return (
    <section className="space-y-6 pb-8" data-testid="tenant-users-view">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden icon={Users} size={19} />
          {copy.title}
        </h1>
        <Button className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => setCreateOpen(true)} size="sm">
          <Icon aria-hidden icon={Plus} size={14} />
          {copy.add}
        </Button>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="min-w-0 border-y bg-background">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <div className="relative min-w-56 flex-1 sm:max-w-sm">
            <Icon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" icon={Search} size={14} />
            <Input
              className="h-8 pl-8 text-xs"
              onChange={(event) => { setSearch(event.target.value); setOffset(0); }}
              placeholder={copy.search}
              value={search}
            />
          </div>
          <Select onValueChange={(value) => { setStatus(value as typeof status); setOffset(0); }} value={status}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.allStatus}</SelectItem>
              {(["active", "disabled", "invited", "suspended"] as const).map((value) => (
                <SelectItem key={value} value={value}>{statusLabel(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(value) => { setRole(value as typeof role); setOffset(0); }} value={role}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.allRoles}</SelectItem>
              {(["owner", "manager", "cashier"] as const).map((value) => (
                <SelectItem key={value} value={value}>{roleLabel(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentRole === "owner" ? (
            <Select onValueChange={(value) => { setBranchId(value); setOffset(0); }} value={branchId}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{copy.allBranches}</SelectItem>
                {initialBranches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          <Button aria-label={copy.refresh} disabled={loading} onClick={() => void loadUsers()} size="icon-sm" title={copy.refresh} variant="outline">
            <Icon className={loading ? "animate-spin" : undefined} icon={RefreshCw} size={14} />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead className="h-9 text-xs">{copy.name}</TableHead>
                <TableHead className="h-9 text-xs">{copy.role}</TableHead>
                <TableHead className="h-9 text-xs">{copy.branch}</TableHead>
                <TableHead className="h-9 text-xs">{copy.status}</TableHead>
                <TableHead className="h-9 text-xs">{copy.lastLogin}</TableHead>
                <TableHead className="h-9 text-right text-xs">{copy.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const protectedUser = user.role === "owner" || user.id === currentUserId;
                return (
                  <TableRow className="h-12" key={user.id}>
                    <TableCell className="py-2">
                      <div className="text-sm font-medium">{user.displayName}</div>
                      <div className="text-[11px] text-muted-foreground">{user.email ?? user.phone ?? "—"}</div>
                    </TableCell>
                    <TableCell className="py-2"><Badge variant="outline">{roleLabel(user.role)}</Badge></TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {user.role === "owner" ? copy.allBranches : user.branchIds.map((id) => branchNames.get(id) ?? id.slice(0, 8)).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="py-2"><Badge variant={user.status === "active" ? "default" : "secondary"}>{statusLabel(user.status)}</Badge></TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : copy.never}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex justify-end gap-1">
                        {protectedUser ? (
                          <span className="px-2 text-[11px] text-muted-foreground" title={copy.protectedOwner}>{user.role === "owner" ? copy.protectedOwner : "—"}</span>
                        ) : (
                          <>
                            <Button aria-label={copy.edit} onClick={() => openEdit(user)} size="icon-sm" title={copy.edit} variant="ghost"><Icon icon={Pencil} size={14} /></Button>
                            <Button aria-label={copy.credentials} onClick={() => { setCredentialUser(user); setCredentialType("pin"); setCredentialValue(""); setCredentialReason(""); }} size="icon-sm" title={copy.credentials} variant="ghost"><Icon icon={KeyRound} size={14} /></Button>
                            <Button aria-label={user.status === "disabled" ? copy.enable : copy.disable} onClick={() => { setStatusUser(user); setStatusReason(""); }} size="icon-sm" title={user.status === "disabled" ? copy.enable : copy.disable} variant="ghost"><Icon icon={ShieldCheck} size={14} /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!loading && users.length === 0 ? <p className="px-4 py-12 text-center text-sm text-muted-foreground">{copy.empty}</p> : null}
      </section>

      <Pagination currentPageCount={users.length} nextLabel="›" offset={offset} onOffsetChange={setOffset} pageSize={PAGE_SIZE} previousLabel="‹" />

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{copy.createTitle}</DialogTitle><DialogDescription>{copy.createDescription}</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label>{copy.displayName} *</Label><Input onChange={(event) => updateCreateForm("displayName", event.target.value)} value={createForm.displayName} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label>{copy.role} *</Label><Select onValueChange={(value) => updateCreateForm("roleCode", value as ManagedTenantUserRoleCode)} value={createForm.roleCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roleOptions.map((value) => <SelectItem key={value} value={value}>{roleLabel(value)}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>{copy.branch} *</Label><Select disabled={currentRole === "manager"} onValueChange={(value) => updateCreateForm("branchId", value)} value={createForm.branchId}><SelectTrigger><SelectValue placeholder={copy.selectBranch} /></SelectTrigger><SelectContent>{initialBranches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label>{copy.email}{createForm.roleCode === "manager" ? " *" : ""}</Label><Input onChange={(event) => updateCreateForm("email", event.target.value)} type="email" value={createForm.email} /></div>
              <div className="grid gap-1.5"><Label>{copy.phone}</Label><Input onChange={(event) => updateCreateForm("phone", event.target.value)} value={createForm.phone} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label>{copy.password}{createForm.roleCode === "manager" ? " *" : ""}</Label><Input autoComplete="new-password" onChange={(event) => updateCreateForm("password", event.target.value)} type="password" value={createForm.password} /></div>
              <div className="grid gap-1.5"><Label>{copy.pin} *</Label><Input inputMode="numeric" maxLength={6} onChange={(event) => updateCreateForm("pin", normalizeDigits(event.target.value))} value={createForm.pin} /></div>
            </div>
            <div className="grid gap-1.5"><Label>{copy.language}</Label><Select onValueChange={(value) => updateCreateForm("language", value as EmployeeForm["language"])} value={createForm.language}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">Français</SelectItem><SelectItem value="zh-CN">简体中文</SelectItem></SelectContent></Select></div>
            <div className="flex justify-end gap-2"><Button onClick={() => setCreateOpen(false)} variant="outline">{copy.cancel}</Button><Button disabled={saving} onClick={() => void submitCreate()}>{saving ? copy.saving : copy.create}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setEditUser(null)} open={editUser !== null}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{copy.editTitle}</DialogTitle><DialogDescription>{copy.editDescription}</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label>{copy.displayName} *</Label><Input onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} value={editForm.displayName ?? ""} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label>{copy.email}</Label><Input onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} type="email" value={editForm.email ?? ""} /></div><div className="grid gap-1.5"><Label>{copy.phone}</Label><Input onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} value={editForm.phone ?? ""} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label>{copy.role} *</Label><Select onValueChange={(value) => setEditForm((current) => ({ ...current, roleCode: value as ManagedTenantUserRoleCode, password: value === "manager" && editUser?.role !== "manager" ? current.password : undefined }))} value={editForm.roleCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roleOptions.map((value) => <SelectItem key={value} value={value}>{roleLabel(value)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5"><Label>{copy.branch} *</Label><Select disabled={currentRole === "manager"} onValueChange={(value) => setEditForm((current) => ({ ...current, branchId: value }))} value={editForm.branchId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{initialBranches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div></div>
            {editForm.roleCode === "manager" && editUser?.role !== "manager" ? <div className="grid gap-1.5"><Label>{copy.password} *</Label><Input autoComplete="new-password" onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} type="password" value={editForm.password ?? ""} /></div> : null}
            <div className="flex justify-end gap-2"><Button onClick={() => setEditUser(null)} variant="outline">{copy.cancel}</Button><Button disabled={saving} onClick={() => void submitEdit()}>{saving ? copy.saving : copy.save}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setStatusUser(null)} open={statusUser !== null}>
        <DialogContent><DialogHeader><DialogTitle>{copy.statusTitle}</DialogTitle><DialogDescription>{copy.statusDescription}</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-1.5"><Label>{copy.reason} *</Label><Input onChange={(event) => setStatusReason(event.target.value)} placeholder={copy.reasonPlaceholder} value={statusReason} /></div><div className="flex justify-end gap-2"><Button onClick={() => setStatusUser(null)} variant="outline">{copy.cancel}</Button><Button disabled={saving} onClick={() => void submitStatus()}>{saving ? copy.saving : copy.confirm}</Button></div></div></DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setCredentialUser(null)} open={credentialUser !== null}>
        <DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Icon icon={UserRoundCog} size={18} />{copy.credentialTitle}</DialogTitle><DialogDescription>{copy.credentialDescription}</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-1.5"><Label>{copy.credentialType}</Label><Select onValueChange={(value) => { setCredentialType(value as "pin" | "password"); setCredentialValue(""); }} value={credentialType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pin">{copy.pinCredential}</SelectItem><SelectItem value="password">{copy.passwordCredential}</SelectItem></SelectContent></Select></div><div className="grid gap-1.5"><Label>{credentialType === "pin" ? copy.newPin : copy.newPassword} *</Label><Input autoComplete="new-password" inputMode={credentialType === "pin" ? "numeric" : undefined} maxLength={credentialType === "pin" ? 6 : 128} onChange={(event) => setCredentialValue(credentialType === "pin" ? normalizeDigits(event.target.value) : event.target.value)} type="password" value={credentialValue} /></div><div className="grid gap-1.5"><Label>{copy.reason} *</Label><Input onChange={(event) => setCredentialReason(event.target.value)} placeholder={copy.reasonPlaceholder} value={credentialReason} /></div><div className="flex justify-end gap-2"><Button onClick={() => setCredentialUser(null)} variant="outline">{copy.cancel}</Button><Button disabled={saving} onClick={() => void submitCredential()}>{saving ? copy.saving : copy.reset}</Button></div></div></DialogContent>
      </Dialog>
    </section>
  );
}
