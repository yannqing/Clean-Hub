import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = resolve(rootDir, "apps/api/src/app.ts");
const outputPath = resolve(
  rootDir,
  "docs/04-technical/api/cleanhub.openapi.json",
);

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];
const PUBLIC_ROUTES = new Set([
  "GET /health",
  "POST /auth/login",
  "POST /auth/refresh",
]);

const SCHEMAS = {
  ApiErrorResponse: {
    type: "object",
    properties: {
      message: { type: "string" },
      code: { type: "string" },
      requestId: { type: "string" },
      validationErrors: {
        type: "object",
        additionalProperties: true,
      },
    },
    required: ["message", "code", "requestId"],
  },
  AuthContext: {
    type: "object",
    properties: {
      userId: { type: "string", example: "01HZY4Y3F8F3V4Z7YQ2S8K9M0N" },
      tenantId: {
        type: "string",
        nullable: true,
        example: null,
      },
      branchIds: {
        type: "array",
        items: { type: "string" },
      },
      role: {
        type: "string",
        enum: ["super_admin", "support", "owner", "manager"],
      },
      roles: {
        type: "array",
        items: { type: "string" },
      },
      permissions: {
        type: "array",
        items: { type: "string" },
      },
      accessTokenExpiresAt: {
        type: "string",
        format: "date-time",
      },
    },
    required: [
      "userId",
      "tenantId",
      "branchIds",
      "role",
      "roles",
      "permissions",
      "accessTokenExpiresAt",
    ],
  },
  LoginRequest: {
    type: "object",
    properties: {
      identifier: {
        type: "string",
        format: "email",
        example: "owner@example.com",
      },
      password: { type: "string", format: "password" },
      deviceId: { type: "string", example: "apifox-local" },
    },
    required: ["identifier", "password"],
  },
  LoginResponse: {
    type: "object",
    properties: {
      authContext: { $ref: "#/components/schemas/AuthContext" },
    },
    required: ["authContext"],
  },
  SaasUserSummary: {
    type: "object",
    properties: {
      id: { type: "string" },
      tenantId: { type: "string", nullable: true },
      email: { type: "string", nullable: true, format: "email" },
      phone: { type: "string", nullable: true },
      displayName: { type: "string" },
      role: { type: "string" },
      roles: {
        type: "array",
        items: { type: "string" },
      },
      status: {
        type: "string",
        enum: ["invited", "active", "disabled", "suspended"],
      },
      language: { type: "string" },
      lastLoginAt: {
        type: "string",
        nullable: true,
        format: "date-time",
      },
      createdAt: {
        type: "string",
        format: "date-time",
      },
    },
    required: [
      "id",
      "tenantId",
      "email",
      "phone",
      "displayName",
      "role",
      "roles",
      "status",
      "language",
      "lastLoginAt",
      "createdAt",
    ],
  },
  SaasUserDetail: {
    allOf: [
      { $ref: "#/components/schemas/SaasUserSummary" },
      {
        type: "object",
        properties: {
          avatarUrl: { type: "string", nullable: true },
          timezone: { type: "string" },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
        required: ["avatarUrl", "timezone", "updatedAt"],
      },
    ],
  },
  CreateSaasUserRequest: {
    type: "object",
    properties: {
      email: { type: "string", format: "email", maxLength: 320 },
      phone: { type: "string", minLength: 3, maxLength: 32 },
      displayName: { type: "string", minLength: 1, maxLength: 120 },
      password: {
        type: "string",
        format: "password",
        minLength: 6,
        maxLength: 128,
      },
      roleCode: {
        type: "string",
        enum: ["super_admin", "support"],
      },
      language: {
        type: "string",
        enum: ["en", "fr", "zh-CN"],
        default: "en",
      },
    },
    required: ["email", "displayName", "password", "roleCode"],
  },
  UpdateSaasUserRequest: {
    type: "object",
    properties: {
      email: { type: "string", format: "email", maxLength: 320 },
      phone: { type: "string", nullable: true, minLength: 3, maxLength: 32 },
      displayName: { type: "string", minLength: 1, maxLength: 120 },
      language: {
        type: "string",
        enum: ["en", "fr", "zh-CN"],
      },
      timezone: { type: "string", minLength: 1, maxLength: 64 },
    },
    minProperties: 1,
  },
};

const OPERATION_OVERRIDES = {
  "GET /health": {
    summary: "Health check",
    tags: ["System"],
    responses: {
      200: jsonResponse("API service health.", {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          service: { type: "string", example: "cleanhub-api" },
        },
        required: ["status", "service"],
      }),
    },
  },
  "POST /auth/login": {
    summary: "Login",
    tags: ["Auth"],
    requestBody: jsonRequest("#/components/schemas/LoginRequest"),
    responses: {
      200: jsonResponse("Authenticated session context.", {
        $ref: "#/components/schemas/LoginResponse",
      }),
      ...errorResponses([401, 403, 422, 500]),
    },
  },
  "POST /auth/refresh": {
    summary: "Refresh auth session",
    tags: ["Auth"],
    responses: {
      200: jsonResponse("Refreshed session context.", {
        $ref: "#/components/schemas/LoginResponse",
      }),
      ...errorResponses([401, 403, 500]),
    },
  },
  "POST /auth/logout": {
    summary: "Logout",
    tags: ["Auth"],
    responses: {
      204: { description: "Logged out." },
      ...errorResponses([401, 500]),
    },
  },
  "GET /auth/me": {
    summary: "Get current auth context",
    tags: ["Auth"],
    responses: {
      200: jsonResponse("Current authenticated session context.", {
        $ref: "#/components/schemas/AuthContext",
      }),
      ...errorResponses([401, 403, 500]),
    },
  },
  "GET /saas/users": {
    summary: "List SaaS users",
    tags: ["SaaS Users"],
    parameters: [
      queryParameter("q", { type: "string", minLength: 1 }),
      queryParameter("status", {
        type: "string",
        enum: ["invited", "active", "disabled", "suspended"],
      }),
      queryParameter("limit", {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 50,
      }),
      queryParameter("offset", {
        type: "integer",
        minimum: 0,
        default: 0,
      }),
    ],
    responses: {
      200: jsonResponse("SaaS user list.", {
        type: "array",
        items: { $ref: "#/components/schemas/SaasUserSummary" },
      }),
      ...errorResponses([401, 403, 422, 500]),
    },
  },
  "POST /saas/users": {
    summary: "Create SaaS user",
    tags: ["SaaS Users"],
    requestBody: jsonRequest("#/components/schemas/CreateSaasUserRequest"),
    responses: {
      201: jsonResponse("Created SaaS user.", {
        $ref: "#/components/schemas/SaasUserSummary",
      }),
      ...errorResponses([401, 403, 409, 422, 500]),
    },
  },
  "GET /saas/users/{userId}": {
    summary: "Get SaaS user detail",
    tags: ["SaaS Users"],
    responses: {
      200: jsonResponse("SaaS user detail.", {
        $ref: "#/components/schemas/SaasUserDetail",
      }),
      ...errorResponses([401, 403, 404, 422, 500]),
    },
  },
  "PATCH /saas/users/{userId}": {
    summary: "Update SaaS user",
    tags: ["SaaS Users"],
    requestBody: jsonRequest("#/components/schemas/UpdateSaasUserRequest"),
    responses: {
      200: jsonResponse("Updated SaaS user detail.", {
        $ref: "#/components/schemas/SaasUserDetail",
      }),
      ...errorResponses([401, 403, 404, 409, 422, 500]),
    },
  },
};

function jsonRequest(schemaRef) {
  return {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: schemaRef },
      },
    },
  };
}

function jsonResponse(description, schema) {
  return {
    description,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

function errorResponses(statuses) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      jsonResponse(errorDescription(status), {
        $ref: "#/components/schemas/ApiErrorResponse",
      }),
    ]),
  );
}

function errorDescription(status) {
  const descriptions = {
    400: "Bad request.",
    401: "Authentication required or token invalid.",
    403: "Permission denied.",
    404: "Resource not found.",
    409: "Conflict.",
    422: "Request validation failed.",
    500: "Internal server error.",
  };

  return descriptions[status] ?? "Error response.";
}

function queryParameter(name, schema) {
  return {
    name,
    in: "query",
    required: false,
    schema,
  };
}

function pathParameter(name) {
  return {
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  };
}

function parseNamedImports(source, importerPath) {
  const imports = new Map();
  const importPattern =
    /import\s+\{(?<names>[^}]+)\}\s+from\s+["'](?<specifier>[^"']+)["']/gs;

  for (const match of source.matchAll(importPattern)) {
    const names = match.groups.names
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => name.split(/\s+as\s+/)[1] ?? name.split(/\s+as\s+/)[0]);

    const specifier = match.groups.specifier;
    if (!specifier.startsWith(".")) {
      continue;
    }

    const importedPath = resolve(dirname(importerPath), specifier).replace(
      /\.js$/,
      ".ts",
    );
    for (const name of names) {
      imports.set(name, importedPath);
    }
  }

  return imports;
}

function parseAppRoutes(source) {
  const routes = [];
  const directPattern =
    /app\.(?<method>get|post|put|patch|delete)\(\s*["'`](?<path>[^"'`]+)["'`]/gi;
  const mountedPattern =
    /app\.route\(\s*["'`](?<path>[^"'`]+)["'`]\s*,\s*(?<factory>[A-Za-z0-9_]+)/g;

  for (const match of source.matchAll(directPattern)) {
    routes.push({
      type: "direct",
      method: match.groups.method.toUpperCase(),
      path: normalizeOpenApiPath(match.groups.path),
    });
  }

  for (const match of source.matchAll(mountedPattern)) {
    routes.push({
      type: "mounted",
      basePath: normalizeHonoPath(match.groups.path),
      factory: match.groups.factory,
    });
  }

  return routes;
}

function parseModuleRoutes(source) {
  const routes = [];
  const routePattern =
    /routes\.(?<method>get|post|put|patch|delete)\(\s*["'`](?<path>[^"'`]+)["'`]/gi;

  for (const match of source.matchAll(routePattern)) {
    routes.push({
      method: match.groups.method.toUpperCase(),
      path: normalizeHonoPath(match.groups.path),
    });
  }

  return routes;
}

function normalizeHonoPath(path) {
  if (!path || path === "/") {
    return "/";
  }

  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}

function combinePaths(basePath, routePath) {
  const base = normalizeHonoPath(basePath);
  const route = normalizeHonoPath(routePath);

  if (base === "/") {
    return normalizeOpenApiPath(route);
  }

  if (route === "/") {
    return normalizeOpenApiPath(base);
  }

  return normalizeOpenApiPath(`${base}${route}`);
}

function normalizeOpenApiPath(path) {
  const normalized = normalizeHonoPath(path);
  return normalized.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function extractPathParameters(path) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

function getTag(path) {
  if (path === "/health") return "System";
  if (path.startsWith("/auth")) return "Auth";
  if (path.startsWith("/saas/users")) return "SaaS Users";
  if (path.startsWith("/saas/backups")) return "SaaS Backups";
  if (path.startsWith("/saas/operation-logs")) return "SaaS Operation Logs";
  if (path.startsWith("/saas/security")) return "SaaS Security";
  if (path.startsWith("/saas")) return "SaaS";
  if (path.startsWith("/tenant")) return "Tenant";
  return "API";
}

function getOperationId(method, path) {
  const pathPart = path
    .replace(/[{}]/g, "")
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, " "))
    .flatMap((part) => part.split(/\s+/).filter(Boolean))
    .map((part, index) =>
      index === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("");

  return `${method.toLowerCase()}${pathPart.charAt(0).toUpperCase()}${pathPart.slice(1)}`;
}

function getDefaultSuccessStatus(method, path) {
  if (method === "DELETE") return 204;
  if (method === "POST" && path === "/saas/users") return 201;
  if (method === "POST" && path === "/auth/logout") return 204;
  return 200;
}

function shouldUseCookieAuth(method, path) {
  return !PUBLIC_ROUTES.has(`${method} ${path}`);
}

function createDefaultOperation(method, path) {
  const status = getDefaultSuccessStatus(method, path);
  const operation = {
    tags: [getTag(path)],
    summary: `${method} ${path}`,
    operationId: getOperationId(method, path),
    parameters: extractPathParameters(path).map(pathParameter),
    responses: {
      [status]:
        status === 204
          ? { description: "No content." }
          : jsonResponse("Success.", {}),
      ...errorResponses([401, 403, 404, 422, 500]),
    },
  };

  if (shouldUseCookieAuth(method, path)) {
    operation.security = [{ cookieAuth: [] }];
  }

  return operation;
}

function mergeOperation(base, override) {
  const merged = {
    ...base,
    ...override,
    parameters: mergeParameters(
      base.parameters ?? [],
      override.parameters ?? [],
    ),
    responses: override.responses ?? base.responses,
  };

  if (base.security && !("security" in override)) {
    merged.security = base.security;
  }

  return merged;
}

function mergeParameters(baseParameters, overrideParameters) {
  const parameterMap = new Map();

  for (const parameter of baseParameters) {
    parameterMap.set(`${parameter.in}:${parameter.name}`, parameter);
  }

  for (const parameter of overrideParameters) {
    parameterMap.set(`${parameter.in}:${parameter.name}`, parameter);
  }

  return [...parameterMap.values()];
}

function addOperation(paths, method, path) {
  const methodKey = method.toLowerCase();
  const operationKey = `${method} ${path}`;
  const baseOperation = createDefaultOperation(method, path);
  const override = OPERATION_OVERRIDES[operationKey] ?? {};
  const operation = mergeOperation(baseOperation, override);

  paths[path] ??= {};
  paths[path][methodKey] = operation;
}

function sortOpenApiPaths(paths) {
  return Object.fromEntries(
    Object.entries(paths)
      .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
      .map(([path, operations]) => [
        path,
        Object.fromEntries(
          HTTP_METHODS.filter((method) => operations[method]).map((method) => [
            method,
            operations[method],
          ]),
        ),
      ]),
  );
}

async function main() {
  const appSource = await readFile(appPath, "utf8");
  const importMap = parseNamedImports(appSource, appPath);
  const appRoutes = parseAppRoutes(appSource);
  const paths = {};
  const warnings = [];

  for (const route of appRoutes) {
    if (route.type === "direct") {
      addOperation(paths, route.method, route.path);
      continue;
    }

    const routeFilePath = importMap.get(route.factory);
    if (!routeFilePath) {
      warnings.push(`No import found for route factory ${route.factory}.`);
      continue;
    }

    let routeSource;
    try {
      routeSource = await readFile(routeFilePath, "utf8");
    } catch (error) {
      warnings.push(
        `Cannot read routes file for ${route.factory}: ${routeFilePath}`,
      );
      continue;
    }

    const moduleRoutes = parseModuleRoutes(routeSource);
    if (moduleRoutes.length === 0) {
      warnings.push(`No routes.* calls found in ${routeFilePath}.`);
      continue;
    }

    for (const moduleRoute of moduleRoutes) {
      addOperation(
        paths,
        moduleRoute.method,
        combinePaths(route.basePath, moduleRoute.path),
      );
    }
  }

  const document = {
    openapi: "3.0.3",
    info: {
      title: "CleanHub API",
      version: "0.1.0",
      description:
        "Generated from apps/api/src/app.ts and mounted Hono route files. First version focuses on route discovery for Apifox import.",
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Local API",
      },
    ],
    tags: [
      ...new Set(
        Object.values(paths).flatMap((operations) =>
          Object.values(operations).flatMap(
            (operation) => operation.tags ?? [],
          ),
        ),
      ),
    ]
      .sort()
      .map((name) => ({ name })),
    paths: sortOpenApiPaths(paths),
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "cleanhub_access_token",
        },
      },
      schemas: SCHEMAS,
    },
    "x-generated-by": "scripts/generate-openapi-from-routes.mjs",
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  console.log(`Generated ${Object.keys(document.paths).length} OpenAPI paths.`);
  console.log(`Output: ${outputPath}`);

  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
