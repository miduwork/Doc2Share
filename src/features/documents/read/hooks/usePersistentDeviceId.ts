"use client";

import { useState } from "react";

const STORAGE_KEY = "doc2share_device_id";

function createDeviceId() {
  return "fp_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function usePersistentDeviceId() {
  const [deviceId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = createDeviceId();
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch {
      // Nếu localStorage bị chặn, fallback chuỗi rỗng để hook fetch không chạy.
      return "";
    }
  });

  return deviceId;
}

