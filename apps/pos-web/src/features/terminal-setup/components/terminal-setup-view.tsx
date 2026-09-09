"use client";

import { isApiHttpError, type TenantProfileBranch } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Badge,
  Button,
  Input,
  Label,
  cn,
} from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { posRoutes } from "@/config/routes";
import {
  Icon,
  type PosIconName,
} from "@/components/app-shell/icons";
import { getOrCreatePosDeviceId } from "@/features/auth/utils/device-id";
import { getPosApiErrorMessage } from "@/lib/api-error-message";

import {
  enrollCurrentTerminal,
  fetchSetupAuthContext,
  fetchSetupTenantProfile,
  fetchTerminalBootstrap,
  loginSetupAdministrator,
  logoutSetupAdministrator,
  recoverCurrentTerminal,
} from "../api";
import { getTerminalSetupCopy } from "../copy";
import { getPosTerminalRuntimeMetadata } from "../terminal-runtime";
import type {
  SetupAdminSession,
  SetupStep,
  TerminalBootstrapResponse,
} from "../types";
import { TerminalSetupShell } from "./terminal-setup-shell";
import { TerminalStatusPanel } from "./terminal-status-panel";

type PageState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "disabled"; bootstrap: TerminalBootstrapResponse }
  | { kind: "setup"; bootstrap: TerminalBootstrapResponse };

const ADMIN_ROLES = new Set(["owner", "manager"]);

function defaultTerminalLabel(branchName: string): string {
  return `${branchName} POS 1`;
}

export function TerminalSetupView() {
  const router = useRouter();
  const { locale, setLocale } = useTranslation();
  const copy = getTerminalSetupCopy(locale);
  const mountedRef = useRef(true);
  const [pageState, setPageState] = useState<PageState>({ kind: "loading" });
  const [step, setStep] = useState<SetupStep>("admin");
  const [deviceId, setDeviceId] = useState("");
  const [adminSession, setAdminSession] =
    useState<SetupAdminSession | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [terminalLabel, setTerminalLabel] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [submittingEnrollment, setSubmittingEnrollment] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const bootstrap =
    pageState.kind === "setup" || pageState.kind === "disabled"
      ? pageState.bootstrap
      : null;
  const recovering = bootstrap?.status === "credential_lost";

  const activeBranches = useMemo(
    () =>
      (adminSession?.profile.accessibleBranches ?? []).filter(
        (branch) => branch.status === "active",
      ),
    [adminSession],
  );
  const selectedBranch =
    activeBranches.find((branch) => branch.id === selectedBranchId) ?? null;
  const managerBranchInvalid =
    adminSession?.authContext.role === "manager" &&
    activeBranches.length !== 1;
  const recoveryBranchUnavailable =
    recovering &&
    (!bootstrap?.terminal ||
      !activeBranches.some(
        (branch) => branch.id === bootstrap.terminal?.branchId,
      ));
  const branchBlockingError = managerBranchInvalid
    ? copy.setup.branch.managerAssignmentInvalid
    : recoveryBranchUnavailable
      ? copy.setup.recovery.branchUnavailable
      : null;

  const applyAdminSession = useCallback(
    (
      authContext: SetupAdminSession["authContext"],
      profile: SetupAdminSession["profile"],
      currentBootstrap: TerminalBootstrapResponse,
    ) => {
      const session = { authContext, profile };
      const availableBranches = profile.accessibleBranches.filter(
        (branch) => branch.status === "active",
      );
      setAdminSession(session);
      setFormError(null);

      if (currentBootstrap.status === "credential_lost") {
        const originalTerminal = currentBootstrap.terminal;
        const originalBranch = originalTerminal
          ? availableBranches.find(
              (branch) => branch.id === originalTerminal.branchId,
            )
          : null;

        setTerminalLabel(
          originalTerminal?.label ?? copy.setup.recovery.unnamedTerminal,
        );

        if (
          authContext.role === "manager" &&
          availableBranches.length !== 1
        ) {
          setSelectedBranchId("");
          setFormError(copy.setup.branch.managerAssignmentInvalid);
          setStep("branch");
          return;
        }

        if (!originalBranch) {
          setSelectedBranchId("");
          setFormError(copy.setup.recovery.branchUnavailable);
          setStep("branch");
          return;
        }

        setSelectedBranchId(originalBranch.id);
        setStep("terminal");
        return;
      }

      if (authContext.role === "manager" && availableBranches.length === 1) {
        const onlyBranch = availableBranches[0]!;
        setSelectedBranchId(onlyBranch.id);
        setTerminalLabel((current) =>
          current.trim() ? current : defaultTerminalLabel(onlyBranch.name),
        );
        setStep("terminal");
        return;
      }

      setStep("branch");
    },
    [
      copy.setup.branch.managerAssignmentInvalid,
      copy.setup.recovery.branchUnavailable,
      copy.setup.recovery.unnamedTerminal,
    ],
  );

  const loadExistingAdminSession = useCallback(
    async (currentBootstrap: TerminalBootstrapResponse) => {
      try {
        const [authContext, profile] = await Promise.all([
          // `/tenant/profile` is authoritative for the account and accessible
          // branches; `/auth/me` supplies the resolved primary role.
          fetchSetupAuthContext(),
          fetchSetupTenantProfile(),
        ]);

        if (!ADMIN_ROLES.has(authContext.role)) {
          await logoutSetupAdministrator().catch(() => undefined);
          setFormError(copy.setup.admin.invalidRole);
          setStep("admin");
          return;
        }

        if (mountedRef.current) {
          applyAdminSession(authContext, profile, currentBootstrap);
        }
      } catch {
        if (mountedRef.current) {
          setStep("admin");
        }
      }
    },
    [applyAdminSession, copy.setup.admin.invalidRole],
  );

  const finalizeSetup = useCallback(async () => {
    setFinalizing(true);
    setCompletionError(null);

    try {
      await logoutSetupAdministrator();
      router.replace(`${posRoutes.login}?setup=complete`);
      router.refresh();
    } catch {
      setCompletionError(copy.setup.complete.signOutFailed);
      setFinalizing(false);
    }
  }, [copy.setup.complete.signOutFailed, router]);

  const initialize = useCallback(async () => {
    setPageState({ kind: "loading" });
    setFormError(null);

    try {
      const resolvedDeviceId = await getOrCreatePosDeviceId();
      const state = await fetchTerminalBootstrap(resolvedDeviceId);
      if (!mountedRef.current) return;

      setDeviceId(resolvedDeviceId);

      if (state.status === "disabled") {
        setPageState({ kind: "disabled", bootstrap: state });
        return;
      }

      if (state.status === "ready_for_pin") {
        router.replace(posRoutes.login);
        return;
      }

      setPageState({ kind: "setup", bootstrap: state });

      if (state.status === "enrolled") {
        setStep("complete");
        await finalizeSetup();
        return;
      }

      if (!state.requiresAdminLogin) {
        await loadExistingAdminSession(state);
      } else {
        setStep("admin");
      }
    } catch {
      if (mountedRef.current) {
        setPageState({ kind: "error" });
      }
    }
  }, [finalizeSetup, loadExistingAdminSession, router]);

  useEffect(() => {
    mountedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void initialize();
    }, 0);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timeoutId);
    };
  }, [initialize]);

  async function submitAdministrator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingLogin) return;

    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || !password) {
      setFormError(copy.setup.admin.loginFailed);
      return;
    }

    setSubmittingLogin(true);
    setFormError(null);

    try {
      const authContext = await loginSetupAdministrator({
        identifier: normalizedIdentifier,
        password,
        deviceId,
      });

      if (!ADMIN_ROLES.has(authContext.role)) {
        await logoutSetupAdministrator().catch(() => undefined);
        setPassword("");
        setFormError(copy.setup.admin.invalidRole);
        return;
      }

      const [profile, refreshedBootstrap] = await Promise.all([
        fetchSetupTenantProfile(),
        fetchTerminalBootstrap(deviceId),
      ]);
      setPassword("");

      if (refreshedBootstrap.status === "disabled") {
        setPageState({
          kind: "disabled",
          bootstrap: refreshedBootstrap,
        });
        return;
      }

      setPageState({ kind: "setup", bootstrap: refreshedBootstrap });

      if (refreshedBootstrap.status === "enrolled") {
        setStep("complete");
        await finalizeSetup();
        return;
      }

      applyAdminSession(authContext, profile, refreshedBootstrap);
    } catch (error) {
      setPassword("");
      setFormError(
        isApiHttpError(error)
          ? getPosApiErrorMessage(error, copy.setup.admin.loginFailed)
          : copy.setup.admin.loginFailed,
      );
    } finally {
      setSubmittingLogin(false);
    }
  }

  function chooseBranch(branch: TenantProfileBranch) {
    if (branch.status !== "active") return;
    setSelectedBranchId(branch.id);
    setTerminalLabel((current) =>
      current.trim() ? current : defaultTerminalLabel(branch.name),
    );
    setFormError(null);
  }

  function continueFromBranch() {
    if (!selectedBranch) return;
    setStep("terminal");
  }

  async function changeAdministrator() {
    await logoutSetupAdministrator().catch(() => undefined);
    setAdminSession(null);
    setSelectedBranchId("");
    setTerminalLabel("");
    setIdentifier("");
    setPassword("");
    setStep("admin");
    setFormError(null);
  }

  async function submitEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submittingEnrollment ||
      !selectedBranch ||
      (!recovering && !terminalLabel.trim()) ||
      !deviceId
    ) {
      return;
    }

    setSubmittingEnrollment(true);
    setFormError(null);

    try {
      if (bootstrap?.status === "credential_lost") {
        await recoverCurrentTerminal(deviceId);
      } else {
        const runtimeMetadata = await getPosTerminalRuntimeMetadata();
        await enrollCurrentTerminal({
          deviceId,
          label: terminalLabel.trim(),
          branchId: selectedBranch.id,
          ...runtimeMetadata,
        });
        await setLocale(selectedBranch.defaultLanguage).catch(() => undefined);
      }

      setStep("complete");
      await finalizeSetup();
    } catch (error) {
      setFormError(
        getPosApiErrorMessage(error, copy.setup.terminal.failed),
      );
    } finally {
      setSubmittingEnrollment(false);
    }
  }

  if (pageState.kind === "loading") {
    return (
      <TerminalSetupShell>
        <TerminalStatusPanel kind="loading" />
      </TerminalSetupShell>
    );
  }

  if (pageState.kind === "error") {
    return (
      <TerminalSetupShell>
        <TerminalStatusPanel
          kind="error"
          onRetry={() => void initialize()}
        />
      </TerminalSetupShell>
    );
  }

  if (pageState.kind === "disabled") {
    return (
      <TerminalSetupShell>
        <TerminalStatusPanel kind="disabled" />
      </TerminalSetupShell>
    );
  }

  return (
    <TerminalSetupShell currentStep={step} showProgress>
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/[0.96] shadow-[0_32px_90px_-42px_rgba(0,0,0,0.64)] backdrop-blur-2xl">
        <div className="border-b border-black/8 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {copy.setup.eyebrow}
            </p>
            {recovering ? (
              <Badge variant="secondary">{copy.setup.recovery.badge}</Badge>
            ) : null}
          </div>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
            {copy.setup.title}
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {recovering
              ? copy.setup.recovery.hint
              : copy.setup.description}
          </p>
        </div>

        {step === "admin" ? (
          <form
            className="grid gap-5 px-5 py-6 sm:px-7 sm:py-7"
            onSubmit={submitAdministrator}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black text-white">
                <Icon className="size-[17px]" name="user-circle" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">
                  {copy.setup.admin.title}
                </h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                  {copy.setup.admin.description}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="setup-email">
                  {copy.setup.admin.identifier}
                </Label>
                <Input
                  autoComplete="username"
                  disabled={submittingLogin}
                  id="setup-email"
                  inputMode="email"
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={copy.setup.admin.identifierPlaceholder}
                  type="email"
                  value={identifier}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="setup-password">
                  {copy.setup.admin.password}
                </Label>
                <Input
                  autoComplete="current-password"
                  disabled={submittingLogin}
                  id="setup-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={copy.setup.admin.passwordPlaceholder}
                  type="password"
                  value={password}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl bg-muted/65 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <Icon
                  className="size-4 shrink-0 text-foreground"
                  name="shield-check"
                />
                {copy.setup.admin.ownerManagerOnly}
              </span>
              <span className="max-w-[16rem] truncate font-mono text-[10px]">
                {deviceId}
              </span>
            </div>

            {formError ? (
              <div
                className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                <Icon className="mt-0.5 size-4 shrink-0" name="alert" />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                className="h-10 min-w-28 rounded-xl"
                disabled={
                  submittingLogin || !identifier.trim() || !password
                }
                type="submit"
              >
                {submittingLogin ? (
                  <Icon className="size-4 animate-spin" name="rotate-ccw" />
                ) : (
                  <Icon className="size-4" name="key-round" />
                )}
                {submittingLogin
                  ? copy.setup.admin.submitting
                  : copy.setup.admin.submit}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "branch" && adminSession ? (
          <div className="grid gap-5 px-5 py-6 sm:px-7 sm:py-7">
            <SetupAccountSummary
              session={adminSession}
              onChangeAccount={() => void changeAdministrator()}
            />

            <div>
              <h2 className="text-base font-semibold">
                {recovering
                  ? copy.bootstrap.credentialLostTitle
                  : copy.setup.branch.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {recovering
                  ? copy.setup.recovery.hint
                  : adminSession.authContext.role === "owner"
                    ? copy.setup.branch.descriptionOwner
                    : copy.setup.branch.descriptionManager}
              </p>
            </div>

            {branchBlockingError ? (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <Icon className="mt-0.5 size-4 shrink-0" name="alert" />
                <span>{branchBlockingError}</span>
              </div>
            ) : activeBranches.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {activeBranches.map((branch) => {
                  const selected = branch.id === selectedBranchId;
                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "group flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition duration-150",
                        "hover:-translate-y-0.5 hover:border-black/25 hover:shadow-sm",
                        selected
                          ? "border-black bg-black text-white shadow-md shadow-black/10"
                          : "border-black/10 bg-white",
                      )}
                      key={branch.id}
                      onClick={() => chooseBranch(branch)}
                      type="button"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted",
                          selected && "bg-white/12",
                        )}
                      >
                        <Icon className="size-4" name="store" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold sm:truncate">
                          {branch.name}
                        </span>
                        <span
                          className={cn(
                            "mt-1 block break-all font-mono text-[10px] text-muted-foreground sm:truncate",
                            selected && "text-white/65",
                          )}
                        >
                          {branch.id}
                        </span>
                      </span>
                      {selected ? (
                        <span className="flex size-5 items-center justify-center rounded-full bg-white text-black">
                          <Icon className="size-3" name="check" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black/15 bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground">
                {copy.setup.branch.noBranches}
              </div>
            )}

            {!recovering ? (
              <div className="flex justify-end">
                <Button
                  className="h-10 rounded-xl"
                  disabled={!selectedBranch || managerBranchInvalid}
                  onClick={continueFromBranch}
                  type="button"
                >
                  {copy.setup.branch.continue}
                  <Icon className="size-4" name="chevron-right" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "terminal" && adminSession && selectedBranch ? (
          <form
            className="grid gap-5 px-5 py-6 sm:px-7 sm:py-7"
            onSubmit={submitEnrollment}
          >
            <SetupAccountSummary
              session={adminSession}
              onChangeAccount={() => void changeAdministrator()}
            />

            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-black text-white">
                <Icon className="size-4" name="monitor" />
              </span>
              <div>
                <h2 className="text-base font-semibold">
                  {copy.setup.terminal.title}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {recovering
                    ? copy.setup.recovery.hint
                    : copy.setup.terminal.description}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="terminal-label">
                {copy.setup.terminal.label}
              </Label>
              <Input
                autoFocus={!recovering}
                disabled={submittingEnrollment || recovering}
                id="terminal-label"
                maxLength={64}
                onChange={(event) => setTerminalLabel(event.target.value)}
                placeholder={copy.setup.terminal.labelPlaceholder}
                value={terminalLabel}
              />
              <p className="text-[11px] leading-5 text-muted-foreground">
                {recovering
                  ? copy.setup.recovery.labelHint
                  : copy.setup.terminal.labelHint}
              </p>
            </div>

            <dl className="grid gap-px overflow-hidden rounded-xl border border-black/10 bg-black/10 sm:grid-cols-3">
              <TerminalDetail
                icon="store"
                label={copy.setup.terminal.tenant}
                value={adminSession.profile.tenant.name}
              />
              <TerminalDetail
                icon="store"
                label={copy.setup.terminal.branch}
                value={selectedBranch.name}
              />
              <TerminalDetail
                icon="monitor"
                label={copy.setup.terminal.device}
                value={deviceId}
                mono
              />
            </dl>

            <div className="flex items-start gap-3 rounded-xl border border-emerald-600/15 bg-emerald-500/[0.06] px-4 py-3">
              <Icon
                className="mt-0.5 size-4 shrink-0 text-emerald-700"
                name="lock"
              />
              <div>
                <p className="text-xs font-semibold text-emerald-950">
                  {copy.setup.terminal.securityTitle}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-emerald-900/70">
                  {copy.setup.terminal.securityDescription}
                </p>
              </div>
            </div>

            {formError ? (
              <div
                className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                <Icon className="mt-0.5 size-4 shrink-0" name="alert" />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {recovering ? (
                <span />
              ) : (
                <Button
                  className="h-10 rounded-xl"
                  disabled={submittingEnrollment}
                  onClick={() => setStep("branch")}
                  type="button"
                  variant="outline"
                >
                  <Icon className="size-4" name="arrow-left" />
                  {copy.setup.terminal.back}
                </Button>
              )}
              <Button
                className="h-10 rounded-xl"
                disabled={
                  submittingEnrollment ||
                  (!recovering && terminalLabel.trim().length === 0)
                }
                type="submit"
              >
                {submittingEnrollment ? (
                  <Icon className="size-4 animate-spin" name="rotate-ccw" />
                ) : (
                  <Icon className="size-4" name="shield-check" />
                )}
                {submittingEnrollment
                  ? recovering
                    ? copy.setup.recovery.confirming
                    : copy.setup.terminal.confirming
                  : recovering
                    ? copy.setup.recovery.confirm
                    : copy.setup.terminal.confirm}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "complete" ? (
          <div className="px-5 py-10 text-center sm:px-7 sm:py-14">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-black text-white shadow-xl shadow-black/15">
              <Icon className="size-6" name="check" />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">
              {copy.setup.complete.title}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {copy.setup.complete.description}
            </p>

            {completionError ? (
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {completionError}
              </div>
            ) : (
              <p className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="size-4 animate-spin" name="rotate-ccw" />
                {copy.setup.complete.redirecting}
              </p>
            )}

            {completionError ? (
              <Button
                className="mt-5 h-10 rounded-xl"
                disabled={finalizing}
                onClick={() => void finalizeSetup()}
                type="button"
              >
                {finalizing ? (
                  <Icon className="size-4 animate-spin" name="rotate-ccw" />
                ) : (
                  <Icon className="size-4" name="log-out" />
                )}
                {copy.setup.complete.retry}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </TerminalSetupShell>
  );

  function SetupAccountSummary({
    session,
    onChangeAccount,
  }: {
    session: SetupAdminSession;
    onChangeAccount: () => void;
  }) {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-muted/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-xs font-semibold sm:truncate">
            {session.profile.tenant.name}
          </p>
          <p className="mt-0.5 break-all text-[11px] text-muted-foreground sm:truncate">
            {session.profile.displayName} · {session.profile.email}
          </p>
        </div>
        <Button
          className="h-8 shrink-0 text-xs"
          onClick={onChangeAccount}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Icon className="size-3.5" name="log-out" />
          {copy.setup.tenant.changeAccount}
        </Button>
      </div>
    );
  }
}

function TerminalDetail({
  icon,
  label,
  mono = false,
  value,
}: {
  icon: PosIconName;
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0 bg-white px-3 py-3">
      <dt className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
        <Icon className="size-3" name={icon} />
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 break-all text-xs font-semibold sm:truncate",
          mono && "font-mono text-[10px]",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
