export const POS_ACCESS_COOKIE_NAME = "cleanhub_pos_access_token";
export const POS_REFRESH_COOKIE_NAME = "cleanhub_pos_refresh_token";
export const POS_AUTH_CLIENT_HEADER_NAME = "X-CleanHub-Auth-Client";
export const POS_AUTH_CLIENT_HEADER_VALUE = "pos";

export const POS_AUTH_CLIENT_HEADERS = {
  [POS_AUTH_CLIENT_HEADER_NAME]: POS_AUTH_CLIENT_HEADER_VALUE,
} as const;
