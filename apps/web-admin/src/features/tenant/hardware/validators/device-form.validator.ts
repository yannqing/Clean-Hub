export type DeviceFormInput = {
  name: string;
  type: string;
  branchId: string;
};

export function validateDeviceForm(input: DeviceFormInput): DeviceFormInput {
  return input;
}
