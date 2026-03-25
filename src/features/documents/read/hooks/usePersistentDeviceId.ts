"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "doc2share_device_id";

function createDeviceId() {
  return "fp_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type PersistentDeviceId = { deviceId: string; storageReady: boolean };

export default function usePersistentDeviceId(): PersistentDeviceId {
  // Luôn bắt đầu rỗng trên server và frame hydrate đầu tiên — tránh lệch HTML với client đọc localStorage ngay.
  const [deviceId, setDeviceId] = useState("");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = createDeviceId();
        localStorage.setItem(STORAGE_KEY, id);
      }
      setDeviceId(id);
    } catch {
      // localStorage bị chặn: giữ rỗng, fetch không chạy (giống hành vi cũ).
    } finally {
      setStorageReady(true);
    }
  }, []);

  return { deviceId, storageReady };
}

