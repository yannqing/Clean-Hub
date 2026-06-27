"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { MobileAuthContext } from "@cleanhub/api-client";
import { Button, Input, Label } from "@cleanhub/ui";
import { Building2, ChevronRight, Loader2, LockKeyhole, LogOut, PackageCheck, ShieldCheck } from "lucide-react";

import {
  enterTenantContext,
  getCustomerTestOtp,
  loadStoredAuthState,
  loginCustomerWithPassword,
  loginDriver,
  loginOwner,
  logoutLocally,
  requestCustomerOtp,
  resetTenantContext,
  verifyCustomerOtp,
} from "../actions";
import type { LoginMode } from "../types";
import { CustomerHome } from "@/features/customer";
import { DeliveryHome } from "@/features/delivery";
import { OwnerHome } from "@/features/owner";

type SessionView = {
  authContext: MobileAuthContext;
};

const loginModes: { value: LoginMode; label: string }[] = [
  { value: "customer-otp", label: "Client OTP" },
  { value: "customer-password", label: "Client mot de passe" },
  { value: "driver", label: "Livreur" },
  { value: "owner", label: "Owner" },
];

export function MobileAuthShell() {
  const [tenantCode, setTenantCode] = useState<string | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);
  const [tenantInput, setTenantInput] = useState("");
  const [mode, setMode] = useState<LoginMode>("customer-otp");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    loadStoredAuthState()
      .then((state) => {
        if (!mounted) {
          return;
        }

        setTenantCode(state.tenantCode);
        setTenantInput(state.tenantCode ?? "");
        setSession(state.session ? { authContext: state.session.authContext } : null);
      })
      .catch(() => {
        setError("Impossible de relire la session locale.");
      })
      .finally(() => {
        if (mounted) {
          setIsBooting(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const activeLoginTitle = useMemo(() => {
    switch (mode) {
      case "customer-password":
        return "Connexion client";
      case "driver":
        return "Connexion livreur";
      case "owner":
        return "Connexion owner";
      default:
        return "Connexion par OTP";
    }
  }, [mode]);

  function runAction(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    startTransition(() => {
      void action().catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError.message : "Action impossible pour le moment.");
      });
    });
  }

  function handleTenantSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runAction(async () => {
      const nextTenantCode = await enterTenantContext(tenantInput);
      setTenantCode(nextTenantCode);
      setMessage("Code pressing enregistré.");
    });
  }

  function handleOtpRequest() {
    if (!tenantCode) {
      return;
    }

    runAction(async () => {
      const response = await requestCustomerOtp({ tenantCode, phone });
      setTestOtp(response.code);
      setMessage("Code envoyé. Le canal de test est affiché pour la recette MVP.");
    });
  }

  function handleOtpTestFetch() {
    if (!tenantCode) {
      return;
    }

    runAction(async () => {
      const response = await getCustomerTestOtp({ tenantCode, phone });
      setTestOtp(response.code);
      setMessage("Code de test récupéré.");
    });
  }

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantCode) {
      setError("Choisissez d'abord un pressing.");
      return;
    }

    runAction(async () => {
      const nextSession =
        mode === "customer-otp"
          ? await verifyCustomerOtp({ tenantCode, phone, code: otp })
          : mode === "customer-password"
            ? await loginCustomerWithPassword({ tenantCode, identifier, password })
            : mode === "driver"
              ? await loginDriver({ tenantCode, identifier, password })
              : await loginOwner({ tenantCode, identifier, password });

      setSession(nextSession);
      setMessage("Connexion réussie.");
    });
  }

  function handleLogout() {
    runAction(async () => {
      await logoutLocally();
      setSession(null);
      setPassword("");
      setOtp("");
      setMessage("Session fermée sur cet appareil.");
    });
  }

  function handleTenantReset() {
    runAction(async () => {
      await resetTenantContext();
      setTenantCode(null);
      setTenantInput("");
      setSession(null);
      setTestOtp(null);
      setMessage("Contexte pressing réinitialisé.");
    });
  }

  if (isBooting) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="flex items-center gap-3 rounded-md border bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal-700" />
          Chargement de l&apos;espace mobile
        </div>
      </main>
    );
  }

  if (tenantCode && session) {
    return (
      <>
        <div className="fixed right-4 top-[max(16px,env(safe-area-inset-top))] z-20">
          <Button
            aria-label="Se déconnecter"
            className="size-11 rounded-md bg-white/95 p-0 shadow-sm backdrop-blur"
            disabled={isPending}
            type="button"
            variant="outline"
            onClick={handleLogout}
          >
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {session.authContext.role === "driver" ? (
          <DeliveryHome driverName={session.authContext.displayName} />
        ) : session.authContext.role === "owner" ? (
          <OwnerHome />
        ) : (
          <CustomerHome />
        )}
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(24px,env(safe-area-inset-top))]">
      <header className="mb-7 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">CleanHub</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Mobile</h1>
        </div>
        <div className="flex size-11 items-center justify-center rounded-md bg-teal-700 text-white shadow-sm">
          <PackageCheck className="size-5" aria-hidden="true" />
        </div>
      </header>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Building2 className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-950">Pressing</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {tenantCode
                ? `Contexte actif: ${tenantCode}`
                : "Entrez le code pressing remis par la boutique."}
            </p>
          </div>
        </div>

        {!tenantCode ? (
          <form className="mt-4 space-y-3" onSubmit={handleTenantSubmit}>
            <div className="space-y-2">
              <Label htmlFor="tenant-code">Code pressing</Label>
              <Input
                id="tenant-code"
                autoCapitalize="characters"
                autoComplete="organization"
                className="h-12 text-base"
                inputMode="text"
                placeholder="CLEAN-001"
                value={tenantInput}
                onChange={(event) => setTenantInput(event.target.value)}
              />
            </div>
            <Button className="h-12 w-full" disabled={isPending} type="submit">
              Continuer
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <div className="mt-4 flex gap-2">
            <Button className="h-11 flex-1" disabled={isPending || Boolean(session)} variant="secondary" onClick={handleTenantReset}>
              Changer
            </Button>
          </div>
        )}
      </section>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {message}
        </p>
      ) : null}

      {tenantCode && !session ? (
        <section className="mt-5 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">{activeLoginTitle}</p>
              <p className="text-sm text-slate-600">Jeton Bearer stocké localement après validation.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {loginModes.map((loginMode) => (
              <button
                className={`min-h-11 rounded-md border px-3 text-sm font-medium transition ${
                  mode === loginMode.value
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
                key={loginMode.value}
                type="button"
                onClick={() => {
                  setMode(loginMode.value);
                  setError(null);
                  setMessage(null);
                }}
              >
                {loginMode.label}
              </button>
            ))}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleLogin}>
            {mode === "customer-otp" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    autoComplete="tel"
                    className="h-12 text-base"
                    inputMode="tel"
                    placeholder="+33 6 12 34 56 78"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-11" disabled={isPending || !phone.trim()} type="button" variant="secondary" onClick={handleOtpRequest}>
                    Envoyer
                  </Button>
                  <Button className="h-11" disabled={isPending || !phone.trim()} type="button" variant="outline" onClick={handleOtpTestFetch}>
                    Code test
                  </Button>
                </div>
                {testOtp ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Code de recette: <span className="font-semibold">{testOtp}</span>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="otp">Code OTP</Label>
                  <Input
                    id="otp"
                    autoComplete="one-time-code"
                    className="h-12 text-base"
                    inputMode="numeric"
                    placeholder="123456"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="identifier">Téléphone ou email</Label>
                  <Input
                    id="identifier"
                    autoComplete="username"
                    className="h-12 text-base"
                    placeholder="nom@pressing.fr"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    autoComplete="current-password"
                    className="h-12 text-base"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </>
            )}

            <Button className="h-12 w-full" disabled={isPending} type="submit">
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
              Se connecter
            </Button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
