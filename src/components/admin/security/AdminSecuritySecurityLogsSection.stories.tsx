import type { Meta, StoryObj } from "@storybook/react";
import AdminSecuritySecurityLogsSection from "./AdminSecuritySecurityLogsSection";

const meta: Meta<typeof AdminSecuritySecurityLogsSection> = {
  title: "Admin/Security/SecurityLogsSection",
  component: AdminSecuritySecurityLogsSection,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof AdminSecuritySecurityLogsSection>;

export const Default: Story = {
  args: {
    logs: [
      {
        id: "1",
        user_id: "user-1",
        event_type: "ip_change",
        severity: "high",
        ip_address: "8.8.8.8",
        user_agent: "ua",
        device_id: "d1",
        correlation_id: "corr-1",
        created_at: "2026-01-10T00:00:00.000Z",
      },
    ],
    securityPagination: { prevCursor: null, nextCursor: "next-2" },
    exportSecurityUrl: "/admin/security/export/security-logs?from=x",
    withQuery: () => "/admin/security?security_cursor=next-2&security_dir=next",
    revoking: null,
    onRevokeSession: () => undefined,
    onTemporaryBan: () => undefined,
  },
};
