import type {
  SaasUserDetail,
  UpdateSaasUserRequest,
} from "../identity/users.types";

export type SaasProfile = SaasUserDetail;
export type UpdateSaasProfileRequest = UpdateSaasUserRequest;
export type ChangeSaasProfilePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};
export type ChangeSaasProfilePasswordResult = {
  passwordChanged: true;
  sessionsRevoked: number;
};
