/**
 * Customer intake UI constants.
 */
export const NEWINTAKE_PAGE_TITLE = "客户接待";
export const NEWINTAKE_PAGE_DESCRIPTION =
  "优先查询客户账户联系方式，并自动使用档案手机号或邮箱进行兜底查询。";

/** Page-size options mirror the prototype and customer-management page. */
export const INTAKE_PAGE_SIZE_OPTIONS = [5, 10] as const;

/** Default query state when the intake page first loads. */
export const INTAKE_DEFAULT_QUERY = {
  q: "",
  page: 1,
  pageSize: 5,
};

/** Empty form for the create-customer-account dialog. */
export const INTAKE_EMPTY_ACCOUNT_FORM = {
  accountName: "",
  accountPhone: "",
  accountEmail: "",
};

/** Relationship options for the create-customer-profile dialog. */
export const INTAKE_RELATIONSHIP_OPTIONS = ["本人", "家庭成员", "企业员工"];

/** Empty form for the create-customer-profile dialog. */
export const INTAKE_EMPTY_PROFILE_FORM = {
  accountId: "",
  fullName: "",
  profilePhone: "",
  profileEmail: "",
  relationship: "本人",
};
