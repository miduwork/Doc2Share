import type { Meta, StoryObj } from "@storybook/react";
import AdminSecurityHighRiskSection from "./AdminSecurityHighRiskSection";

const meta: Meta<typeof AdminSecurityHighRiskSection> = {
  title: "Admin/Security/HighRiskSection",
  component: AdminSecurityHighRiskSection,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof AdminSecurityHighRiskSection>;

export const Default: Story = {
  args: {
    highRiskUsers: [
      {
        userId: "user-risk-1",
        score: 90,
        band: "critical",
        factors: [],
        correlationId: "corr-risk-1",
      },
    ],
    revoking: null,
    panicUserId: null,
    onRevokeSession: () => undefined,
    onTemporaryBan: () => undefined,
    onPanic: () => undefined,
  },
};
