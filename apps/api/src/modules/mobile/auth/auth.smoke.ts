import type { Database } from "@cleanhub/db";

import { AuthError } from "../../auth/auth.errors.js";
import { hashPassword } from "../../auth/password.service.js";
import type { EffectiveSecurityPolicy } from "../../saas/security/security-policy.js";
import {
  MobileAuthService,
  type MobileAuthRepositoryLike,
} from "./auth.service.js";
import type {
  MobileCustomerAccount,
  MobileCustomerCredential,
  MobileCustomerOtp,
  MobileStaffUser,
  MobileStoredRefreshToken,
} from "./auth.types.js";

const TEST_SECRET = "mobile-auth-smoke-secret-32-chars-min";
const GOOD_PASSWORD = "Correct123";
const BAD_PASSWORD = "Wrong123";

const policy: EffectiveSecurityPolicy = {
  passwordMinLength: 8,
  passwordRequiresNumber: true,
  passwordRequiresSymbol: false,
  loginMaxAttempts: 2,
  lockoutMinutes: 15,
  refreshTokenDays: 30,
};

const fakeDb = {
  select() {
    return {
      from() {
        return {
          where() {
            return {
              limit() {
                return [];
              },
            };
          },
        };
      },
    };
  },
  insert() {
    return {
      values() {
        return undefined;
      },
    };
  },
  update() {
    return {
      set() {
        return {
          where() {
            return undefined;
          },
        };
      },
    };
  },
  delete() {
    return {
      where() {
        return undefined;
      },
    };
  },
} as unknown as Database;

type RefreshRecord = MobileStoredRefreshToken & {
  tokenHash: string;
  replacedByTokenId?: string;
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejectsAuth(
  action: () => Promise<unknown>,
  code: AuthError["code"],
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (!(error instanceof AuthError)) {
      throw new Error("expected an AuthError");
    }

    assert(error.code === code, `expected auth error ${code}`);
    return;
  }

  throw new Error(`expected action to reject with ${code}`);
}

function makeCustomer(overrides?: Partial<MobileCustomerAccount>): MobileCustomerAccount {
  return {
    id: "customer_account_1",
    tenantId: "tenant_1",
    accountName: "Customer One",
    phone: "+100000000",
    email: "customer@example.com",
    status: "active",
    ...overrides,
  };
}

function makeStaffUser(
  id: string,
  tenantId: string,
  passwordHash: string,
): MobileStaffUser {
  return {
    id,
    tenantId,
    userType: "tenant",
    email: `${id}@example.com`,
    passwordHash,
    status: "active",
  };
}

class FakeMobileAuthRepository implements MobileAuthRepositoryLike {
  private readonly customers = new Map<string, MobileCustomerAccount>();
  private readonly customerCredentials = new Map<string, MobileCustomerCredential>();
  private readonly staffUsers = new Map<string, MobileStaffUser>();
  private readonly staffAccess = new Map<
    string,
    {
      displayName: string;
      roles: string[];
      permissions: string[];
      branchIds: string[];
    }
  >();
  private readonly customerRefreshTokens = new Map<string, RefreshRecord>();
  private readonly staffRefreshTokens = new Map<string, RefreshRecord>();
  private otps: MobileCustomerOtp[] = [];
  private refreshCounter = 0;
  public readonly staffLoginAttempts: Array<{
    identifier: string;
    tenantId: string;
  }> = [];

  constructor(passwordHash: string) {
    const customer = makeCustomer();
    this.customers.set(customer.id, customer);
    this.customerCredentials.set(customer.id, {
      id: "customer_credential_1",
      tenantId: customer.tenantId,
      customerAccountId: customer.id,
      passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
    });

    const driver = makeStaffUser("driver_1", "tenant_1", passwordHash);
    const owner = makeStaffUser("owner_1", "tenant_1", passwordHash);

    this.staffUsers.set(driver.id, driver);
    this.staffUsers.set(owner.id, owner);
    this.staffAccess.set(driver.id, {
      displayName: "Driver One",
      roles: ["driver"],
      permissions: ["delivery:read"],
      branchIds: ["branch_1"],
    });
    this.staffAccess.set(owner.id, {
      displayName: "Owner One",
      roles: ["owner"],
      permissions: ["owner:read"],
      branchIds: [],
    });
  }

  async findActiveTenantByCode(tenantCode: string): Promise<{ id: string } | null> {
    if (tenantCode === "CLEAN-001") {
      return { id: "tenant_1" };
    }

    if (tenantCode === "CLEAN-002") {
      return { id: "tenant_2" };
    }

    return null;
  }

  async findCustomerByPhone({
    tenantId,
    phone,
  }: {
    tenantId: string;
    phone: string;
  }): Promise<MobileCustomerAccount | null> {
    return (
      [...this.customers.values()].find(
        (customer) => customer.tenantId === tenantId && customer.phone === phone,
      ) ?? null
    );
  }

  async findCustomerByIdentifier({
    tenantId,
    identifier,
  }: {
    tenantId: string;
    identifier: string;
  }): Promise<MobileCustomerAccount | null> {
    return (
      [...this.customers.values()].find(
        (customer) =>
          customer.tenantId === tenantId &&
          (customer.phone === identifier || customer.email === identifier),
      ) ?? null
    );
  }

  async findCustomerById({
    tenantId,
    customerAccountId,
  }: {
    tenantId: string;
    customerAccountId: string;
  }): Promise<MobileCustomerAccount | null> {
    const customer = this.customers.get(customerAccountId);

    if (!customer || customer.tenantId !== tenantId) {
      return null;
    }

    return customer;
  }

  async findCustomerCredential(
    customerAccountId: string,
  ): Promise<MobileCustomerCredential | null> {
    return this.customerCredentials.get(customerAccountId) ?? null;
  }

  async createCustomerOtp({
    tenantId,
    customerAccountId,
    phone,
    code,
    expiresAt,
  }: {
    tenantId: string;
    customerAccountId: string;
    phone: string;
    code: string;
    expiresAt: Date;
  }): Promise<void> {
    this.otps.unshift({
      id: `otp_${this.otps.length + 1}`,
      tenantId,
      customerAccountId,
      phone,
      code,
      attempts: 0,
      maxAttempts: 2,
      expiresAt,
      consumedAt: null,
    });
  }

  async findLatestCustomerOtp({
    tenantId,
    customerAccountId,
    phone,
  }: {
    tenantId: string;
    customerAccountId: string;
    phone: string;
  }): Promise<MobileCustomerOtp | null> {
    return (
      this.otps.find(
        (otp) =>
          otp.tenantId === tenantId &&
          otp.customerAccountId === customerAccountId &&
          otp.phone === phone,
      ) ?? null
    );
  }

  async incrementCustomerOtpAttempts(otpId: string): Promise<void> {
    const otp = this.otps.find((candidate) => candidate.id === otpId);

    if (otp) {
      otp.attempts += 1;
    }
  }

  async consumeCustomerOtp(otpId: string): Promise<void> {
    const otp = this.otps.find((candidate) => candidate.id === otpId);

    if (otp) {
      otp.consumedAt = new Date();
    }
  }

  async recordCustomerPasswordFailure({
    credentialId,
    failedAttempts,
    lockedUntil,
  }: {
    credentialId: string;
    failedAttempts: number;
    lockedUntil: Date | null;
  }): Promise<void> {
    const credential = [...this.customerCredentials.values()].find(
      (candidate) => candidate.id === credentialId,
    );

    if (credential) {
      credential.failedAttempts = failedAttempts;
      credential.lockedUntil = lockedUntil;
    }
  }

  async clearCustomerPasswordFailures(credentialId: string): Promise<void> {
    const credential = [...this.customerCredentials.values()].find(
      (candidate) => candidate.id === credentialId,
    );

    if (credential) {
      credential.failedAttempts = 0;
      credential.lockedUntil = null;
    }
  }

  async createCustomerRefreshToken({
    customerAccountId,
    tenantId,
    tokenHash,
    familyId,
    expiresAt,
  }: {
    customerAccountId: string;
    tenantId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<string> {
    const id = `customer_refresh_${++this.refreshCounter}`;

    this.customerRefreshTokens.set(tokenHash, {
      id,
      subjectId: customerAccountId,
      tenantId,
      familyId,
      expiresAt,
      revokedAt: null,
      tokenHash,
    });

    return id;
  }

  async findCustomerRefreshTokenByHash(
    tokenHash: string,
  ): Promise<MobileStoredRefreshToken | null> {
    return this.customerRefreshTokens.get(tokenHash) ?? null;
  }

  async revokeCustomerRefreshToken({
    tokenId,
    replacedByTokenId,
  }: {
    tokenId: string;
    replacedByTokenId?: string;
  }): Promise<void> {
    const token = [...this.customerRefreshTokens.values()].find(
      (candidate) => candidate.id === tokenId,
    );

    if (token) {
      token.revokedAt = new Date();
      token.replacedByTokenId = replacedByTokenId;
    }
  }

  async revokeCustomerRefreshTokenFamily(familyId: string): Promise<void> {
    for (const token of this.customerRefreshTokens.values()) {
      if (token.familyId === familyId) {
        token.revokedAt = new Date();
      }
    }
  }

  async revokeCustomerRefreshTokenByHash(tokenHash: string): Promise<void> {
    const token = this.customerRefreshTokens.get(tokenHash);

    if (token) {
      token.revokedAt = new Date();
    }
  }

  async findStaffLoginUser({
    identifier,
    tenantId,
  }: {
    identifier: string;
    tenantId: string;
  }): Promise<MobileStaffUser | null> {
    this.staffLoginAttempts.push({ identifier, tenantId });

    if (tenantId !== "tenant_1") {
      return null;
    }

    if (identifier === "driver@example.com") {
      return this.staffUsers.get("driver_1") ?? null;
    }

    if (identifier === "owner@example.com") {
      return this.staffUsers.get("owner_1") ?? null;
    }

    return null;
  }

  async findStaffUserById(userId: string): Promise<MobileStaffUser | null> {
    return this.staffUsers.get(userId) ?? null;
  }

  async getStaffAccess(userId: string): Promise<{
    displayName: string;
    roles: string[];
    permissions: string[];
    branchIds: string[];
  }> {
    return (
      this.staffAccess.get(userId) ?? {
        displayName: userId,
        roles: [],
        permissions: [],
        branchIds: [],
      }
    );
  }

  async updateStaffLastLoginAt(): Promise<void> {
    return undefined;
  }

  async createStaffRefreshToken({
    userId,
    tenantId,
    tokenHash,
    familyId,
    expiresAt,
  }: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<string> {
    const id = `staff_refresh_${++this.refreshCounter}`;

    this.staffRefreshTokens.set(tokenHash, {
      id,
      subjectId: userId,
      tenantId,
      familyId,
      expiresAt,
      revokedAt: null,
      tokenHash,
    });

    return id;
  }

  async findStaffRefreshTokenByHash(
    tokenHash: string,
  ): Promise<MobileStoredRefreshToken | null> {
    return this.staffRefreshTokens.get(tokenHash) ?? null;
  }

  async revokeStaffRefreshToken({
    tokenId,
    replacedByTokenId,
  }: {
    tokenId: string;
    replacedByTokenId?: string;
  }): Promise<void> {
    const token = [...this.staffRefreshTokens.values()].find(
      (candidate) => candidate.id === tokenId,
    );

    if (token) {
      token.revokedAt = new Date();
      token.replacedByTokenId = replacedByTokenId;
    }
  }

  async revokeStaffRefreshTokenFamily(familyId: string): Promise<void> {
    for (const token of this.staffRefreshTokens.values()) {
      if (token.familyId === familyId) {
        token.revokedAt = new Date();
      }
    }
  }

  async revokeStaffRefreshTokenByHash(tokenHash: string): Promise<void> {
    const token = this.staffRefreshTokens.get(tokenHash);

    if (token) {
      token.revokedAt = new Date();
    }
  }
}

async function createService(): Promise<{
  service: MobileAuthService;
  repository: FakeMobileAuthRepository;
}> {
  const passwordHash = await hashPassword(GOOD_PASSWORD);
  const repository = new FakeMobileAuthRepository(passwordHash);
  const service = new MobileAuthService({
    db: fakeDb,
    repository,
    securityPolicy: policy,
    accessTokenSecret: TEST_SECRET,
    accessTokenTtlSeconds: 60,
    refreshTokenTtlSeconds: 60 * 60,
  });

  return { service, repository };
}

async function assertCustomerOtpSuccess(): Promise<void> {
  const { service } = await createService();

  const requestedOtp = await service.requestCustomerOtp({
    tenantCode: "CLEAN-001",
    phone: "+100000000",
    deviceId: "device_1",
  });
  const testOtp = await service.getCustomerTestOtp({
    tenantCode: "CLEAN-001",
    phone: "+100000000",
  });

  assert(testOtp.code === requestedOtp.code, "test OTP should expose latest code");

  const login = await service.verifyCustomerOtp({
    tenantCode: "CLEAN-001",
    phone: "+100000000",
    code: testOtp.code,
    deviceId: "device_1",
  });

  assert(login.authContext.subjectType === "customer", "OTP login is customer");
  assert(login.authContext.role === "customer", "OTP login role is customer");
  assert(login.tokens.refreshToken.startsWith("cust_"), "customer refresh is wrapped");

  const context = await service.getMobileAuthContext(login.tokens.accessToken);

  assert(context.subjectId === "customer_account_1", "customer token resolves");
  assert(context.roles.length === 1 && context.roles[0] === "customer", "customer role is isolated");
}

async function assertCustomerOtpAttemptLimit(): Promise<void> {
  const { service } = await createService();

  await service.requestCustomerOtp({
    tenantCode: "CLEAN-001",
    phone: "+100000000",
  });

  await assertRejectsAuth(
    () =>
      service.verifyCustomerOtp({
        tenantCode: "CLEAN-001",
        phone: "+100000000",
        code: "000000",
      }),
    "INVALID_CREDENTIALS",
  );
  await assertRejectsAuth(
    () =>
      service.verifyCustomerOtp({
        tenantCode: "CLEAN-001",
        phone: "+100000000",
        code: "111111",
      }),
    "INVALID_CREDENTIALS",
  );
  await assertRejectsAuth(
    () =>
      service.verifyCustomerOtp({
        tenantCode: "CLEAN-001",
        phone: "+100000000",
        code: "222222",
      }),
    "ACCOUNT_LOCKED",
  );
}

async function assertCustomerPasswordLockout(): Promise<void> {
  const { service } = await createService();

  await assertRejectsAuth(
    () =>
      service.loginCustomerWithPassword({
        tenantCode: "CLEAN-001",
        identifier: "customer@example.com",
        password: BAD_PASSWORD,
      }),
    "INVALID_CREDENTIALS",
  );
  await assertRejectsAuth(
    () =>
      service.loginCustomerWithPassword({
        tenantCode: "CLEAN-001",
        identifier: "customer@example.com",
        password: BAD_PASSWORD,
      }),
    "ACCOUNT_LOCKED",
  );
  await assertRejectsAuth(
    () =>
      service.loginCustomerWithPassword({
        tenantCode: "CLEAN-001",
        identifier: "customer@example.com",
        password: GOOD_PASSWORD,
      }),
    "ACCOUNT_LOCKED",
  );
}

async function assertStaffRoleIsolation(): Promise<void> {
  const { service, repository } = await createService();

  const driver = await service.loginStaff({
    tenantCode: "CLEAN-001",
    identifier: "driver@example.com",
    password: GOOD_PASSWORD,
    role: "driver",
  });

  assert(driver.authContext.subjectType === "staff", "driver is staff");
  assert(driver.authContext.role === "driver", "driver role is selected");
  assert(driver.authContext.branchIds[0] === "branch_1", "driver branch is included");
  assert(driver.tokens.refreshToken.startsWith("staff_"), "staff refresh is wrapped");

  const owner = await service.loginStaff({
    tenantCode: "CLEAN-001",
    identifier: "owner@example.com",
    password: GOOD_PASSWORD,
    role: "owner",
  });

  assert(owner.authContext.role === "owner", "owner role is selected");
  assert(owner.authContext.branchIds.length === 0, "owner login is not branch bound");

  await assertRejectsAuth(
    () =>
      service.loginStaff({
        tenantCode: "CLEAN-001",
        identifier: "driver@example.com",
        password: GOOD_PASSWORD,
        role: "owner",
      }),
    "INVALID_CREDENTIALS",
  );
  await assertRejectsAuth(
    () =>
      service.loginStaff({
        tenantCode: "CLEAN-001",
        identifier: "owner@example.com",
        password: GOOD_PASSWORD,
        role: "driver",
      }),
    "INVALID_CREDENTIALS",
  );
  await assertRejectsAuth(
    () =>
      service.loginStaff({
        tenantCode: "CLEAN-001",
        identifier: "customer@example.com",
        password: GOOD_PASSWORD,
        role: "driver",
      }),
    "INVALID_CREDENTIALS",
  );
  await assertRejectsAuth(
    () =>
      service.loginStaff({
        tenantCode: "CLEAN-002",
        identifier: "driver@example.com",
        password: GOOD_PASSWORD,
        role: "driver",
      }),
    "INVALID_CREDENTIALS",
  );

  assert(
    repository.staffLoginAttempts.some(
      (attempt) =>
        attempt.identifier === "driver@example.com" &&
        attempt.tenantId === "tenant_2",
    ),
    "staff login must scope lookup by resolved tenant",
  );

  const context = await service.getMobileAuthContext(driver.tokens.accessToken);

  assert(context.role === "driver", "driver access token resolves to driver");
  assert(context.tenantId === "tenant_1", "staff token keeps tenant");
}

async function assertCustomerCannotBeStaffOrCrossTenant(): Promise<void> {
  const { service } = await createService();

  await assertRejectsAuth(
    () =>
      service.loginCustomerWithPassword({
        tenantCode: "CLEAN-001",
        identifier: "driver@example.com",
        password: GOOD_PASSWORD,
      }),
    "INVALID_CREDENTIALS",
  );
  await assertRejectsAuth(
    () =>
      service.loginCustomerWithPassword({
        tenantCode: "CLEAN-002",
        identifier: "customer@example.com",
        password: GOOD_PASSWORD,
      }),
    "INVALID_CREDENTIALS",
  );
}

async function assertRefreshAndLogout(): Promise<void> {
  const { service } = await createService();

  const login = await service.loginCustomerWithPassword({
    tenantCode: "CLEAN-001",
    identifier: "customer@example.com",
    password: GOOD_PASSWORD,
    deviceId: "device_1",
  });
  const refreshed = await service.refresh({
    refreshToken: login.tokens.refreshToken,
    deviceId: "device_1",
  });

  assert(refreshed.authContext.role === "customer", "refresh keeps customer role");
  assert(
    refreshed.tokens.refreshToken !== login.tokens.refreshToken,
    "refresh rotates token",
  );

  await assertRejectsAuth(
    () => service.refresh({ refreshToken: login.tokens.refreshToken }),
    "TOKEN_REUSE_DETECTED",
  );

  const staffLogin = await service.loginStaff({
    tenantCode: "CLEAN-001",
    identifier: "driver@example.com",
    password: GOOD_PASSWORD,
    role: "driver",
  });
  const staffRefresh = await service.refresh({
    refreshToken: staffLogin.tokens.refreshToken,
  });

  assert(staffRefresh.authContext.role === "driver", "staff refresh keeps role");

  await service.logout({ refreshToken: staffRefresh.tokens.refreshToken });
  await assertRejectsAuth(
    () => service.refresh({ refreshToken: staffRefresh.tokens.refreshToken }),
    "TOKEN_REUSE_DETECTED",
  );
}

export async function runMobileAuthSmokeChecks(): Promise<void> {
  await assertCustomerOtpSuccess();
  await assertCustomerOtpAttemptLimit();
  await assertCustomerPasswordLockout();
  await assertStaffRoleIsolation();
  await assertCustomerCannotBeStaffOrCrossTenant();
  await assertRefreshAndLogout();
}

if (process.argv[1]?.endsWith("auth.smoke.ts")) {
  await runMobileAuthSmokeChecks();
}
