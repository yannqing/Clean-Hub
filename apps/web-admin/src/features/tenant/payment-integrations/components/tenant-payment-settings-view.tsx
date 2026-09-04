"use client";

import type {
  TenantPaymentIntegrationSummary,
  TenantPaymentProvider,
} from "@cleanhub/api-client";
import { Badge, Button, Input, Label, toast } from "@cleanhub/ui";
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useState } from "react";

import { useTenantSettingsWorkspace } from "@/features/tenant/settings/components";
import { useTenantI18n } from "@/i18n";

import {
  configureOrangeMoneyPaymentIntegrationAction,
  configureWavePaymentIntegrationAction,
  removePaymentIntegrationAction,
  updatePaymentIntegrationAvailabilityAction,
  verifyPaymentIntegrationAction,
} from "../actions";

type ProviderForm = {
  apiKey: string;
  signingSecret: string;
  clientId: string;
  clientSecret: string;
  merchantKey: string;
};

const EMPTY_FORM: ProviderForm = {
  apiKey: "",
  signingSecret: "",
  clientId: "",
  clientSecret: "",
  merchantKey: "",
};

const PROVIDER_DETAILS = {
  wave: {
    name: "Wave",
    description:
      "使用 Wave Business Checkout API 创建并核对门店移动支付。API Key 必须拥有 Checkout API 权限。",
  },
  orange_money: {
    name: "Orange Money",
    description:
      "使用 Orange Money Web Payment 商户凭据。验证会检查 Orange OAuth Client ID 与 Client Secret。",
  },
} satisfies Record<
  TenantPaymentProvider,
  { name: string; description: string }
>;

function replaceIntegration(
  integrations: TenantPaymentIntegrationSummary[],
  next: TenantPaymentIntegrationSummary,
): TenantPaymentIntegrationSummary[] {
  return integrations.map((item) =>
    item.provider === next.provider ? next : item,
  );
}

function blankIntegration(
  provider: TenantPaymentProvider,
): TenantPaymentIntegrationSummary {
  return {
    provider,
    configured: false,
    credentialHint: null,
    verificationStatus: "not_configured",
    posEnabled: false,
    verifiedAt: null,
    updatedAt: null,
    version: null,
    lastVerificationError: null,
  };
}

export function TenantPaymentSettingsView({
  initialIntegrations,
  loadError,
}: {
  initialIntegrations: TenantPaymentIntegrationSummary[];
  loadError?: string | null;
}) {
  const { canUpdateSettings } = useTenantSettingsWorkspace();
  const { formatDateTime } = useTenantI18n();
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [editingProvider, setEditingProvider] =
    useState<TenantPaymentProvider | null>(null);
  const [busyProvider, setBusyProvider] =
    useState<TenantPaymentProvider | null>(null);
  const [form, setForm] = useState<Record<TenantPaymentProvider, ProviderForm>>(
    {
      wave: { ...EMPTY_FORM },
      orange_money: { ...EMPTY_FORM },
    },
  );

  function updateForm(
    provider: TenantPaymentProvider,
    field: keyof ProviderForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [provider]: { ...current[provider], [field]: value },
    }));
  }

  async function configure(integration: TenantPaymentIntegrationSummary) {
    const values = form[integration.provider];
    setBusyProvider(integration.provider);
    const result =
      integration.provider === "wave"
        ? await configureWavePaymentIntegrationAction({
            apiKey: values.apiKey,
            ...(values.signingSecret
              ? { signingSecret: values.signingSecret }
              : {}),
            posEnabled: integration.posEnabled,
          })
        : await configureOrangeMoneyPaymentIntegrationAction({
            clientId: values.clientId,
            clientSecret: values.clientSecret,
            merchantKey: values.merchantKey,
            posEnabled: integration.posEnabled,
          });
    setBusyProvider(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setIntegrations((current) => replaceIntegration(current, result.data));
    setForm((current) => ({
      ...current,
      [integration.provider]: { ...EMPTY_FORM },
    }));
    setEditingProvider(null);
    toast.success(
      `${PROVIDER_DETAILS[integration.provider].name} 已验证并保存。`,
    );
  }

  async function verify(provider: TenantPaymentProvider) {
    setBusyProvider(provider);
    const result = await verifyPaymentIntegrationAction(provider);
    setBusyProvider(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setIntegrations((current) => replaceIntegration(current, result.data));
    if (result.data.verificationStatus === "verified") {
      toast.success(`${PROVIDER_DETAILS[provider].name} API 验证成功。`);
    } else {
      toast.error(
        result.data.lastVerificationError ??
          `${PROVIDER_DETAILS[provider].name} API 验证失败。`,
      );
    }
  }

  async function setAvailability(
    provider: TenantPaymentProvider,
    enabled: boolean,
  ) {
    setBusyProvider(provider);
    const result = await updatePaymentIntegrationAvailabilityAction(
      provider,
      enabled,
    );
    setBusyProvider(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setIntegrations((current) => replaceIntegration(current, result.data));
    toast.success(enabled ? "POS 移动支付已启用。" : "POS 移动支付已停用。");
  }

  async function remove(provider: TenantPaymentProvider) {
    if (
      !window.confirm(
        `确定解除 ${PROVIDER_DETAILS[provider].name} 绑定吗？POS 将立即停止使用该渠道。`,
      )
    ) {
      return;
    }
    setBusyProvider(provider);
    const result = await removePaymentIntegrationAction(provider);
    setBusyProvider(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setIntegrations((current) =>
      replaceIntegration(current, blankIntegration(provider)),
    );
    setEditingProvider(null);
    toast.success(`${PROVIDER_DETAILS[provider].name} 已解除绑定。`);
  }

  return (
    <div className="grid max-w-[920px] gap-4">
      <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <div className="flex items-start gap-3 border-b border-black/10 px-4 py-4 sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <ShieldCheck aria-hidden className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              POS 移动支付准入
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">
              只有 API 凭据验证成功并明确开启的渠道，才会出现在 POS
              的“移动支付”和“混合支付”中。密钥仅加密保存在服务端，不会返回到浏览器或
              POS。
            </p>
          </div>
        </div>
        {loadError ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-5">
            {loadError}
          </div>
        ) : null}
        {!canUpdateSettings ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5">
            Manager 可以查看状态，只有租户 Owner
            可以保存凭据、验证或启停支付渠道。
          </div>
        ) : null}
      </section>

      {integrations.map((integration) => {
        const details = PROVIDER_DETAILS[integration.provider];
        const editing =
          editingProvider === integration.provider || !integration.configured;
        const busy = busyProvider === integration.provider;
        const verified = integration.verificationStatus === "verified";
        const values = form[integration.provider];
        const formComplete =
          integration.provider === "wave"
            ? values.apiKey.trim().length >= 12
            : values.clientId.trim().length >= 3 &&
              values.clientSecret.trim().length >= 8 &&
              values.merchantKey.trim().length >= 3;

        return (
          <section
            className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            key={integration.provider}
          >
            <div className="flex flex-col gap-4 border-b border-black/10 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <WalletCards aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-950">
                      {details.name}
                    </h2>
                    <Badge
                      variant={
                        verified
                          ? "default"
                          : integration.configured
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {verified
                        ? "已验证"
                        : integration.configured
                          ? "验证失效"
                          : "未绑定"}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                    {details.description}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs font-medium text-slate-700">
                  在 POS 启用
                </span>
                <button
                  aria-checked={integration.posEnabled}
                  aria-label={`在 POS 启用 ${details.name}`}
                  className={`relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 ${
                    integration.posEnabled ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                  disabled={!canUpdateSettings || !verified || busy}
                  onClick={() =>
                    void setAvailability(
                      integration.provider,
                      !integration.posEnabled,
                    )
                  }
                  role="switch"
                  type="button"
                >
                  <span
                    className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
                      integration.posEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {integration.configured ? (
              <div className="grid gap-3 border-b border-black/10 bg-slate-50/60 px-4 py-3 text-xs text-slate-600 sm:grid-cols-3 sm:px-5">
                <div>
                  <span className="block text-slate-400">凭据</span>
                  <strong className="mt-0.5 block font-mono font-medium text-slate-700">
                    {integration.credentialHint}
                  </strong>
                </div>
                <div>
                  <span className="block text-slate-400">最近验证</span>
                  <strong className="mt-0.5 block font-medium text-slate-700">
                    {integration.verifiedAt
                      ? formatDateTime(integration.verifiedAt)
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span className="block text-slate-400">POS 状态</span>
                  <strong className="mt-0.5 flex items-center gap-1 font-medium text-slate-700">
                    {integration.posEnabled ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : (
                      <CircleAlert className="size-3.5 text-slate-400" />
                    )}
                    {integration.posEnabled ? "已启用" : "未启用"}
                  </strong>
                </div>
              </div>
            ) : null}

            {integration.lastVerificationError ? (
              <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700 sm:px-5">
                {integration.lastVerificationError}
              </div>
            ) : null}

            {editing && canUpdateSettings ? (
              <div className="grid gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <KeyRound aria-hidden className="size-4" />
                  {integration.configured ? "更新 API 凭据" : "绑定 API 凭据"}
                </div>
                {integration.provider === "wave" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="wave-api-key">Wave API Key</Label>
                      <Input
                        autoComplete="new-password"
                        id="wave-api-key"
                        onChange={(event) =>
                          updateForm("wave", "apiKey", event.target.value)
                        }
                        placeholder="wave_sn_prod_…"
                        type="password"
                        value={values.apiKey}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="wave-signing-secret">
                        Request Signing Secret（如已启用签名）
                      </Label>
                      <Input
                        autoComplete="new-password"
                        id="wave-signing-secret"
                        onChange={(event) =>
                          updateForm(
                            "wave",
                            "signingSecret",
                            event.target.value,
                          )
                        }
                        placeholder="wave_sn_AKS_…"
                        type="password"
                        value={values.signingSecret}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="orange-client-id">Client ID</Label>
                      <Input
                        autoComplete="new-password"
                        id="orange-client-id"
                        onChange={(event) =>
                          updateForm(
                            "orange_money",
                            "clientId",
                            event.target.value,
                          )
                        }
                        type="password"
                        value={values.clientId}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="orange-client-secret">
                        Client Secret
                      </Label>
                      <Input
                        autoComplete="new-password"
                        id="orange-client-secret"
                        onChange={(event) =>
                          updateForm(
                            "orange_money",
                            "clientSecret",
                            event.target.value,
                          )
                        }
                        type="password"
                        value={values.clientSecret}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="orange-merchant-key">
                        Orange Money Merchant Key
                      </Label>
                      <Input
                        autoComplete="new-password"
                        id="orange-merchant-key"
                        onChange={(event) =>
                          updateForm(
                            "orange_money",
                            "merchantKey",
                            event.target.value,
                          )
                        }
                        type="password"
                        value={values.merchantKey}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs leading-5 text-slate-500">
                  保存时会立即连接支付服务商进行验证。验证失败不会替换当前有效凭据，也不能开启
                  POS 移动支付。
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  {integration.configured ? (
                    <Button
                      disabled={busy}
                      onClick={() => setEditingProvider(null)}
                      type="button"
                      variant="outline"
                    >
                      取消
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy || !formComplete}
                    onClick={() => void configure(integration)}
                    type="button"
                  >
                    {busy ? "正在验证…" : "保存并验证"}
                  </Button>
                </div>
              </div>
            ) : integration.configured && canUpdateSettings ? (
              <div className="flex flex-wrap items-center justify-end gap-2 p-4 sm:px-5">
                <Button
                  disabled={busy}
                  onClick={() => setEditingProvider(integration.provider)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <KeyRound aria-hidden className="size-4" />
                  更新凭据
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void verify(integration.provider)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw
                    aria-hidden
                    className={`size-4 ${busy ? "animate-spin" : ""}`}
                  />
                  重新验证
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void remove(integration.provider)}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  <Trash2 aria-hidden className="size-4" />
                  解除绑定
                </Button>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
