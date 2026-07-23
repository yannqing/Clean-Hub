import { LoginPageContent } from "@/features/auth/components";
import {
  isAuthRedirectReason,
  type AuthRedirectReason,
} from "@/config/auth-routing";

type LoginPageProps = {
  searchParams?: Promise<{
    reason?: string | string[];
  }>;
};

function resolveAuthRedirectReason(
  value: string | string[] | undefined,
): AuthRedirectReason | undefined {
  const reason = Array.isArray(value) ? value[0] : value;
  return isAuthRedirectReason(reason) ? reason : undefined;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const reason = resolveAuthRedirectReason(params?.reason);

  return <LoginPageContent reason={reason} />;
}
