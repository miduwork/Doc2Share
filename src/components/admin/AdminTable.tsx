"use client";

import React, { type ReactNode } from "react";

export type AdminTableColumn<T> = {
  id: string;
  header: string;
  cell?: (_row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

type AdminTableProps<T> = {
  columns: AdminTableColumn<T>[];
  data: T[];
  emptyMessage: string;
  emptyIcon?: ReactNode;
  wrapperClassName?: string;
  /** Optional expandable row below each data row. expandedRowId determines which row is expanded. */
  expandableRow?: (_row: T) => ReactNode;
  expandedRowId?: string | null;
  getRowId: (_row: T) => string;
};

function defaultCell(row: Record<string, unknown>, key: string): ReactNode {
  const v = (row as Record<string, unknown>)[key];
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return "—";
}

export default function AdminTable<T extends object>({
  columns,
  data,
  emptyMessage,
  emptyIcon,
  wrapperClassName = "",
  expandableRow,
  expandedRowId,
  getRowId,
}: AdminTableProps<T>) {
  const tableClass = "w-full text-xs";
  const theadClass = "bg-muted/50 dark:bg-slate-800/50";
  const thClass = "px-3 py-1.5 text-left font-medium text-semantic-heading";
  const tdClass = "px-3 py-1.5 text-slate-600 dark:text-slate-400";
  const hasExpandable = Boolean(expandableRow);

  return (
    <div className={wrapperClassName || "overflow-hidden rounded-xl border border-line bg-surface"}>
      <table className={tableClass} role="grid">
        <thead className={theadClass}>
          <tr>
            {columns.map((col) => (
              <th key={col.id} className={col.headerClassName ?? thClass}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((row) => {
            const rowId = getRowId(row);
            const isExpanded = hasExpandable && expandedRowId === rowId;
            return (
              <React.Fragment key={rowId}>
                <tr className="hover:bg-muted/30">
                  {columns.map((col) => (
                    <td key={col.id} className={col.cellClassName ?? tdClass}>
                      {col.cell ? col.cell(row) : defaultCell(row as Record<string, unknown>, col.id)}
                    </td>
                  ))}
                </tr>
                {hasExpandable && isExpanded && expandableRow && (
                  <tr className="bg-muted/20 dark:bg-slate-800/30">
                    <td colSpan={columns.length} className="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {expandableRow(row)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center" role="status">
          {emptyIcon && <span className="mb-2 text-slate-400">{emptyIcon}</span>}
          <p className="text-xs text-muted">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
