import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localeCookie = "cleanhub_web_admin_locale";
const preferenceCookie = "cleanhub_web_admin_locale_preference";
let state;

// Exercise the real login action and auth-cookie adapter. Only Next's request
// context and the upstream API are replaced; no database or real login is used.
const bundled = await build({
  entryPoints: [
    join(root, "apps/web-admin/src/features/auth/actions/login.action.ts"),
  ],
  tsconfig: join(root, "apps/web-admin/tsconfig.json"),
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  plugins: [
    {
      name: "login-request-context",
      setup(plugin) {
        plugin.onResolve({ filter: /^next\/headers$/ }, () => ({
          path: "headers",
          namespace: "login-smoke",
        }));
        plugin.onResolve({ filter: /^@\/lib\/api-client$/ }, () => ({
          path: "api",
          namespace: "login-smoke",
        }));
        plugin.onResolve({ filter: /^server-only$/ }, () => ({
          path: "server-only",
          namespace: "login-smoke",
        }));
        plugin.onResolve({ filter: /^@\/i18n$/ }, () => ({
          path: join(root, "apps/web-admin/src/i18n/locale.ts"),
        }));
        plugin.onLoad(
          { filter: /.*/, namespace: "login-smoke" },
          ({ path }) => ({
            contents:
              path === "headers"
                ? "export const cookies = async () => globalThis.loginLocaleSmoke.cookies; export const headers = async () => globalThis.loginLocaleSmoke.headers;"
                : path === "api"
                  ? "export const webAdminApi = globalThis.loginLocaleSmoke.api;"
                  : "",
            loader: "js",
          }),
        );
      },
    },
  ],
});
const module = { exports: {} };
runInNewContext(bundled.outputFiles[0].text, {
  module,
  exports: module.exports,
  require: createRequire(import.meta.url),
  console,
  Response,
  Headers,
  loginLocaleSmoke: {
    get cookies() {
      return state.cookies;
    },
    get headers() {
      return state.headers;
    },
    api: {
      auth: {
        async login(_input, options) {
          state.apiLanguage = options.headers["accept-language"];
          if (state.failure) throw new Error("Test upstream failure");
          options.afterResponse(
            new Response(null, {
              headers: [
                [
                  "set-cookie",
                  "cleanhub_access_token=test-access; HttpOnly; Path=/; SameSite=Lax",
                ],
                [
                  "set-cookie",
                  "cleanhub_refresh_token=test-refresh; HttpOnly; Path=/; SameSite=Lax",
                ],
              ],
            }),
          );
          return { authContext: state.authContext };
        },
      },
    },
  },
});

function request(role, language, stored = {}) {
  const values = new Map(Object.entries(stored));
  const writes = new Map();
  state = {
    headers: new Headers({
      "accept-language": "zh-CN,fr;q=0.8",
      "user-agent": "login-locale-smoke",
    }),
    authContext: {
      userId: "user-test",
      role,
      tenantId: role === "super_admin" ? null : "tenant-test",
      language,
      branchIds: [],
      permissions: [],
      roles: [role],
    },
    cookies: {
      get(name) {
        return values.has(name) ? { name, value: values.get(name) } : undefined;
      },
      set(name, value, options) {
        const entry =
          typeof name === "string" ? { name, value, ...options } : name;
        values.set(entry.name, entry.value);
        writes.set(entry.name, entry);
      },
    },
    values,
    writes,
  };
  return state;
}

const credentials = {
  identifier: "locale-review@example.invalid",
  password: "fixture-password",
  deviceId: "fixture-device",
};
for (const role of ["super_admin", "owner", "manager"]) {
  for (const locale of ["en", "fr", "zh-CN"]) {
    const current = request(role, locale === "zh-CN" ? "fr" : "zh-CN");
    const result = await module.exports.loginAction({ ...credentials, locale });
    assert.equal(result.ok, true, `${role} login must succeed`);
    assert.equal(
      current.values.get(localeCookie),
      locale,
      `${role}: keep the displayed login language even without a manual selection`,
    );
    assert.equal(
      current.values.get(preferenceCookie),
      "1",
      "Protect the login language from both dashboard defaults",
    );
    assert.equal(
      current.apiLanguage,
      locale,
      "API feedback follows the language the login form displays",
    );
    assert.equal(current.writes.get(localeCookie).maxAge, 365 * 24 * 60 * 60);
    assert.equal(current.writes.get(localeCookie).path, "/");
    assert.equal(current.writes.get("cleanhub_access_token").httpOnly, true);
    assert.equal(current.writes.get("cleanhub_refresh_token").httpOnly, true);
  }
}

// Requests from an already-open form may omit the new field. The fallback must
// be the same cookie/default the server used to render that form, never profile.language.
for (const [submitted, stored, expected] of [
  [undefined, undefined, "en"],
  [undefined, "fr", "fr"],
  ["unsupported", "fr", "fr"],
  ["en", "fr", "en"],
]) {
  const current = request(
    "owner",
    "zh-CN",
    stored ? { [localeCookie]: stored } : {},
  );
  const result = await module.exports.loginAction({
    ...credentials,
    locale: submitted,
  });
  assert.equal(result.ok, true);
  assert.equal(current.values.get(localeCookie), expected);
}

const failed = request("super_admin", "zh-CN");
failed.failure = true;
assert.equal(
  (await module.exports.loginAction({ ...credentials, locale: "fr" })).ok,
  false,
);
assert.equal(
  failed.writes.size,
  0,
  "An upstream login failure must not establish cookies",
);
const invalid = request("super_admin", "zh-CN");
assert.equal(
  (
    await module.exports.loginAction({
      ...credentials,
      identifier: "",
      locale: "fr",
    })
  ).ok,
  false,
);
assert.equal(invalid.writes.size, 0);

console.log(
  "Web-admin login locale checks passed (first visit, SaaS/owner/manager, saved choice, fallback, API language and auth cookies).",
);
