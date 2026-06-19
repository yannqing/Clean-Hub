import { LoginForm } from "@/features/auth/components";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen bg-[#F7F9FC] text-slate-900">
      {/* Brand panel */}
      <aside className="relative hidden w-[440px] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-violet-500 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="CleanHub mark"
            className="h-11 w-11 rounded-xl bg-white/20 object-cover p-1"
            src="/cleanhub-logo-mark.jpg"
          />
          <div>
            <div className="text-lg font-extrabold tracking-tight">
              CleanHub POS
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
              门店收银系统
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-tight">
            门店高效运营
            <br />
            从这里开始
          </h1>
          <p className="max-w-xs text-sm leading-6 text-white/80">
            收银、受理、扫描、订单与交接班，一站式协作前台。请使用门店编码与店员账号登录。
          </p>
        </div>

        <p className="text-xs text-white/60">
          © {new Date().getFullYear()} CleanHub
        </p>
      </aside>

      {/* Form panel */}
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              CleanHub POS
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">店员登录</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              请输入门店编码与店员账号信息以继续。
            </p>
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
