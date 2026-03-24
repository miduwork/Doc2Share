"use client";

import { useCallback, useState } from "react";
import type { BulkActionOption, DocRow } from "../admin-documents.types";

export function useDocumentsSelectionAndBulk() {
  const [activeTab, setActiveTab] = useState<"crud" | "ops">("crud");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkActionOption>("publish");
  const [bulkRejectNote, setBulkRejectNote] = useState("");

  const toggleDoc = useCallback((id: string, checked: boolean) => {
    setSelectedDocIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
  }, []);

  const selectAllFromDocs = useCallback((docs: DocRow[], checked: boolean) => {
    setSelectedDocIds(checked ? docs.map((d) => d.id) : []);
  }, []);

  const clearSelectionAndBulkInputs = useCallback(() => {
    setSelectedDocIds([]);
    setBulkRejectNote("");
  }, []);

  return {
    activeTab,
    setActiveTab,
    selectedDocIds,
    setSelectedDocIds,
    bulkAction,
    setBulkAction,
    bulkRejectNote,
    setBulkRejectNote,
    toggleDoc,
    selectAllFromDocs,
    clearSelectionAndBulkInputs,
  };
}

