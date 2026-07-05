import { LoginForm } from "@/features/auth/components";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-6 py-12 text-foreground">
      <div className="mx-auto max-w-md">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            CleanHub Web Admin
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Login</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Choose store or platform sign-in. Store administrators must enter
            their pressing code.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
