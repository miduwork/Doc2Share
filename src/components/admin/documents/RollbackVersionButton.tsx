"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rollbackDocumentToVersion } from "@/app/admin/documents/manage-actions";

type Props = {
  documentId: string;
  versionId: string;
  versionNo: number;
};

export default function RollbackVersionButton({ documentId, versionId, versionNo }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const ok = window.confirm(
      `Rollback tài liệu về version v${versionNo}?\n\nTrạng thái hiện tại sẽ được lưu thành một version mới (backup) trước khi khôi phục.`
    );
    if (!ok) return;
    setLoading(true);
    try {
      const result = await rollbackDocumentToVersion({ documentId, versionId });
      if (result.ok) {
        toast.success(`Đã rollback về version v${result.data?.restoredFromVersion ?? versionNo}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="admin-btn-sm bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
    >
      {loading ? "Đang xử lý…" : "Rollback về version này"}
    </button>
  );
}
