import type { Meta, StoryObj } from "@storybook/react";
import DiscoveryFilters from "./DiscoveryFilters";
import type { Category } from "@/lib/types";

// Mock router for Next.js app router inside Storybook
const mockCategories = {
    grades: [
        { id: 10, name: "Lớp 10", type: "grade" },
        { id: 11, name: "Lớp 11", type: "grade" },
        { id: 12, name: "Lớp 12", type: "grade" },
    ] as Category[],
    subjects: [
        { id: 1, name: "Toán học", type: "subject" },
        { id: 2, name: "Vật lý", type: "subject" },
        { id: 3, name: "Hóa học", type: "subject" },
    ] as Category[],
    exams: [
        { id: 1, name: "THPT Quốc Gia", type: "exam" },
        { id: 2, name: "Đánh giá năng lực", type: "exam" },
    ] as Category[],
};

const meta = {
    title: "Documents/List/DiscoveryFilters",
    component: DiscoveryFilters,
    parameters: {
        layout: "padded",
        nextjs: {
            appDirectory: true,
            navigation: {
                pathname: "/cua-hang",
                query: {
                    grade: "12"
                }
            },
        },
    },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: "radio",
            options: ["pills", "sidebar"],
        },
    },
} satisfies Meta<typeof DiscoveryFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PillsVariant: Story = {
    args: {
        grades: mockCategories.grades,
        subjects: mockCategories.subjects,
        exams: mockCategories.exams,
        basePath: "/cua-hang",
        variant: "pills",
    },
    decorators: [
        (Story) => (
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                <Story />
            </div>
        ),
    ],
};

export const SidebarVariant: Story = {
    args: {
        grades: mockCategories.grades,
        subjects: mockCategories.subjects,
        exams: mockCategories.exams,
        basePath: "/cua-hang",
        variant: "sidebar",
    },
    decorators: [
        (Story) => (
            <div style={{ maxWidth: "320px" }}>
                <Story />
            </div>
        ),
    ],
};
