import type { Meta, StoryObj } from "@storybook/react";
import AdminSecurityFiltersSection from "./AdminSecurityFiltersSection";

const meta: Meta<typeof AdminSecurityFiltersSection> = {
  title: "Admin/Security/FiltersSection",
  component: AdminSecurityFiltersSection,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof AdminSecurityFiltersSection>;

export const Default: Story = {
  args: {
    filters: {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.000Z",
      severity: "all",
      status: "all",
      userId: "",
      documentId: "",
      ipAddress: "",
      correlationId: "",
      pageSize: 50,
      accessCursor: "",
      accessDir: "next",
      securityCursor: "",
      securityDir: "next",
    },
    exporting: null,
    onApplyFilters: () => undefined,
    onExportByAction: () => undefined,
    onPatchQuery: () => undefined,
  },
};
