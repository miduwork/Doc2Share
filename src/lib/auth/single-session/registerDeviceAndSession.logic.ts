export type RegisterDevicePolicyInput = {
  isSuperAdmin: boolean;
  existingDeviceIds: string[];
  currentDeviceId: string;
  maxDevices?: number;
};

export type RegisterDevicePolicyResult =
  | { ok: true; isNewDevice: boolean }
  | { ok: false; error: string };

const DEFAULT_MAX_DEVICES = 2;

export function evaluateRegisterDevicePolicy({
  isSuperAdmin,
  existingDeviceIds,
  currentDeviceId,
  maxDevices = DEFAULT_MAX_DEVICES,
}: RegisterDevicePolicyInput): RegisterDevicePolicyResult {
  const isNewDevice = !existingDeviceIds.some((id) => id === currentDeviceId);
  if (!isSuperAdmin && isNewDevice && existingDeviceIds.length >= maxDevices) {
    return { ok: false, error: "Tối đa 2 thiết bị. Vui lòng gỡ thiết bị cũ trong Tủ sách." };
  }
  return { ok: true, isNewDevice };
}

