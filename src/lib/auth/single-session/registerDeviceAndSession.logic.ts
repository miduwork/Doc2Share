export type RegisterDevicePolicyInput = {
  isSuperAdmin: boolean;
  existingDevices: { device_id: string; hardware_hash: string | null }[];
  currentDeviceId: string;
  currentHardwareHash?: string | null;
  maxDevices?: number;
};

export type RegisterDevicePolicyResult =
  | { ok: true; isNewDevice: boolean; recoveredDeviceId?: string }
  | { ok: false; error: string };

const DEFAULT_MAX_DEVICES = 2;

export function evaluateRegisterDevicePolicy({
  isSuperAdmin,
  existingDevices,
  currentDeviceId,
  currentHardwareHash,
  maxDevices = DEFAULT_MAX_DEVICES,
}: RegisterDevicePolicyInput): RegisterDevicePolicyResult {
  const isNewDevice = !existingDevices.some((d) => d.device_id === currentDeviceId);

  if (isNewDevice) {
    if (currentHardwareHash) {
      const match = existingDevices.find((d) => d.hardware_hash === currentHardwareHash);
      if (match) {
        // Auto-heal: User lost localStorage (e.g. Incognito tab), but hardware fingerprint matches exactly!
        return { ok: true, isNewDevice: false, recoveredDeviceId: match.device_id };
      }
    }

    if (!isSuperAdmin && existingDevices.length >= maxDevices) {
      return { ok: false, error: "Tối đa 2 thiết bị. Vui lòng gỡ thiết bị cũ trong Tủ sách." };
    }
  }

  return { ok: true, isNewDevice };
}

