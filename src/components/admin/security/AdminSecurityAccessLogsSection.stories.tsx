import type { Meta, StoryObj } from "@storybook/react";
import AdminSecurityAccessLogsSection from "./AdminSecurityAccessLogsSection";

const meta: Meta<typeof AdminSecurityAccessLogsSection> = {
  title: "Admin/Security/AccessLogsSection",
  component: AdminSecurityAccessLogsSection,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof AdminSecurityAccessLogsSection>;

export const Default: Story = {
  args: {
    accessLogs: [
      {
        id: "1",
        user_id: "user-1",
        document_id: "doc-1",
        action: "secure_pdf",
        status: "success",
        ip_address: "1.1.1.1",
        device_id: "d1",
        correlation_id: "corr-1",
        created_at: "2026-01-10T00:00:00.000Z",
      },
    ],
    accessPagination: { prevCursor: "prev-1", nextCursor: "next-1" },
    exportAccessUrl: "/admin/security/export/access-logs?from=x",
    withQuery: () => "/admin/security?access_cursor=next-1&access_dir=next",
  },
};
