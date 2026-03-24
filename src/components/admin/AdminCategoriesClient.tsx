"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryRow,
} from "@/app/admin/categories/actions";
import type { CategoryType } from "@/lib/types";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";

const TYPE_LABELS: Record<string, string> = {
  subject: "Môn học",
  grade: "Khối lớp",
  exam: "Kỳ thi",
};

const TYPES: CategoryType[] = ["subject", "grade", "exam"];

function parseTypeParam(value: string | null): CategoryType {
  if (value === "grade" || value === "exam") return value;
  return "subject";
}

export default function AdminCategoriesClient({
  initialCategories,
}: {
  initialCategories: CategoryRow[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTypeFromUrl = useMemo(
    () => parseTypeParam(searchParams.get("section")),
    [searchParams]
  );
  const [categories, setCategories] = useState(initialCategories);
  const [activeType, setActiveType] = useState<CategoryType>(activeTypeFromUrl);
  const [newName, setNewName] = useState<Record<CategoryType, string>>({
    subject: "",
    grade: "",
    exam: "",
  });
  const [creating, setCreating] = useState<Record<CategoryType, boolean>>({
    subject: false,
    grade: false,
    exam: false,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    setActiveType(activeTypeFromUrl);
  }, [activeTypeFromUrl]);

  function getList(type: CategoryType) {
    return categories.filter((c) => c.type === type);
  }

  function handleChangeSection(type: CategoryType) {
    setActiveType(type);
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", type);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function handleCreate(type: CategoryType) {
    const name = newName[type].trim();
    if (!name) {
      toast.error("Nhập tên.");
      return;
    }
    setCreating((p) => ({ ...p, [type]: true }));
    const result = await createCategory(name, type);
    setCreating((p) => ({ ...p, [type]: false }));
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data) setCategories((prev) => [...prev, result.data!]);
    setNewName((p) => ({ ...p, [type]: "" }));
    toast.success(`Đã thêm ${TYPE_LABELS[type]}.`);
  }

  function startEdit(row: CategoryRow) {
    setEditingId(row.id);
    setEditName(row.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit() {
    if (editingId == null) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Tên không được để trống.");
      return;
    }
    const result = await updateCategory(editingId, name);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data) {
      setCategories((prev) =>
        prev.map((c) => (c.id === editingId ? result.data! : c))
      );
    }
    cancelEdit();
    toast.success("Đã cập nhật.");
  }

  async function handleDelete(row: CategoryRow) {
    if (!confirm(`Xóa "${row.name}"? Tài liệu đang dùng sẽ không còn gắn mục này.`)) return;
    const result = await deleteCategory(row.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== row.id));
    toast.success("Đã xóa.");
  }

  const columns: AdminTableColumn<CategoryRow>[] = [
    {
      id: "name",
      header: "Tên",
      headerClassName: "px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500",
      cell: (row) =>
        editingId === row.id ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input-premium flex-1 py-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              autoFocus
            />
            <button type="button" onClick={saveEdit} className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" aria-label="Lưu">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={cancelEdit} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Hủy">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="font-medium">{row.name}</span>
        ),
    },
    {
      id: "actions",
      header: "Thao tác",
      headerClassName: "w-16 px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500",
      cellClassName: "px-2 py-1.5 text-right",
      cell: (row) =>
        editingId !== row.id ? (
          <>
            <button type="button" onClick={() => startEdit(row)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300" aria-label="Sửa">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => handleDelete(row)} className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Xóa">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="premium-panel flex flex-wrap items-center gap-2 rounded-xl p-2">
        {TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleChangeSection(type)}
            className={`admin-btn-sm ${
              activeType === type
                ? "bg-primary text-white"
                : "border border-line bg-surface text-fg hover:bg-surface-muted"
            }`}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line bg-slate-50/80 px-3 py-2 dark:bg-slate-800/50">
          <h2 className="text-xs font-semibold text-semantic-heading">
            {TYPE_LABELS[activeType]}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-2.5">
          <input
            type="text"
            value={newName[activeType]}
            onChange={(e) => setNewName((p) => ({ ...p, [activeType]: e.target.value }))}
            placeholder={`Thêm ${TYPE_LABELS[activeType].toLowerCase()}...`}
            className="input-premium w-44 py-1.5 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleCreate(activeType)}
          />
          <button
            type="button"
            onClick={() => handleCreate(activeType)}
            disabled={creating[activeType]}
            className="btn-primary flex items-center gap-1 px-2.5 py-1.5 text-xs disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> Thêm
          </button>
        </div>
        <AdminTable<CategoryRow>
          columns={columns}
          data={getList(activeType)}
          emptyMessage="Chưa có mục nào. Thêm ở trên hoặc chạy script seed trong SQL Editor."
          getRowId={(r) => String(r.id)}
          wrapperClassName="overflow-x-auto"
        />
      </section>
    </div>
  );
}
