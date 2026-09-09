import type {
  PosChannelAvailableBranch,
  PosChannelCashHandlingMode,
  PosChannelDeviceConnectivity,
  PosChannelDeviceStatus,
  PosChannelDeviceSummary,
  PosChannelDeviceType,
  PosChannelPaymentMethod,
  PosChannelRegisterSession,
  PosChannelRoundingRule,
  PosChannelShiftStatus,
  PosChannelSyncStatus,
  TenantPosChannelDeviceList,
  TenantPosChannelDeviceListQuery,
  TenantPosChannelOverview,
  TenantPosChannelOverviewQuery,
  TenantPosChannelRegisterSessionList,
  TenantPosChannelRegisterSessionQuery,
  TenantPosChannelSettings,
  RemoveTenantPosChannelDeviceRequest,
  UpdateTenantPosChannelDeviceRequest,
  UpdateTenantPosChannelSettingsRequest,
} from "@cleanhub/api-client";

export type PointOfSaleBranchOption = PosChannelAvailableBranch;
export type PointOfSaleCashHandlingMode = PosChannelCashHandlingMode;
export type PointOfSaleOverview = TenantPosChannelOverview;
export type PointOfSaleOverviewQuery = TenantPosChannelOverviewQuery;
export type PointOfSaleDevice = PosChannelDeviceSummary;
export type PointOfSaleDeviceList = TenantPosChannelDeviceList;
export type PointOfSaleDeviceQuery = TenantPosChannelDeviceListQuery;
export type PointOfSaleDeviceStatus = PosChannelDeviceStatus;
export type UpdatePointOfSaleDeviceInput = UpdateTenantPosChannelDeviceRequest;
export type RemovePointOfSaleDeviceInput = RemoveTenantPosChannelDeviceRequest;
export type PointOfSaleDeviceConnectivity = PosChannelDeviceConnectivity;
export type PointOfSaleDeviceType = PosChannelDeviceType;
export type PointOfSaleSyncStatus = PosChannelSyncStatus;
export type PointOfSaleRegisterSession = PosChannelRegisterSession;
export type PointOfSaleRegisterSessionList =
  TenantPosChannelRegisterSessionList;
export type PointOfSaleRegisterSessionQuery =
  TenantPosChannelRegisterSessionQuery;
export type PointOfSaleShiftStatus = PosChannelShiftStatus;
export type PointOfSaleSettings = TenantPosChannelSettings;
export type PointOfSalePaymentMethod = PosChannelPaymentMethod;
export type PointOfSaleRoundingRule = PosChannelRoundingRule;
export type UpdatePointOfSaleSettingsInput =
  UpdateTenantPosChannelSettingsRequest;
