import type { Meta, StoryObj } from "@storybook/react";
import DocumentCard from "./DocumentCard";
import type { Category } from "@/lib/types";
import type { DocumentCardDoc } from "./document-card-types";

const mockCategories: Category[] = [
    { id: 12, name: "Lớp 12", type: "grade" },
    { id: 1, name: "Toán học", type: "subject" },
    { id: 1, name: "THPT Quốc Gia", type: "exam" },
];

const mockDoc: DocumentCardDoc = {
    id: "doc-1",
    title: "Bộ Đề Thi Thử THPT Quốc Gia Môn Toán 2026",
    description: "Bộ đề bao gồm 50 đề thi thử chuẩn bị cho kỳ thi THPT Quốc Gia môn Toán học. Có đáp án chi tiết và giải thích cặn kẽ từng bước.",
    price: 150000,
    thumbnail_url: "https://images.unsplash.com/photo-1620509420015-d91fe086c8a7?q=80&w=600&auto=format&fit=crop",
    preview_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    grade_id: 12,
    subject_id: 1,
    exam_id: 1,
    is_downloadable: true,
};

const meta = {
    title: "Documents/List/DocumentCard",
    component: DocumentCard,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: "radio",
            options: ["default", "compact"],
        },
        topBadge: {
            control: "select",
            options: ["premium", "free", false],
        },
        enableMicroInteraction: { control: "boolean" },
        enableQuickPreview: { control: "boolean" },
        viewCount: { control: "number" },
        ratingCount: { control: "number" },
        avgRating: { control: "number" },
        soldCount: { control: "number" },
    },
} satisfies Meta<typeof DocumentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        doc: mockDoc,
        categories: mockCategories,
        viewCount: 15420,
        ratingCount: 125,
        avgRating: 4.8,
        soldCount: 450,
    },
    decorators: [
        (Story) => (
            <div style={{ width: "400px" }}>
                <Story />
            </div>
        ),
    ],
};

export const CompactVariant: Story = {
    args: {
        doc: mockDoc,
        categories: mockCategories,
        variant: "compact",
        topBadge: false,
    },
    decorators: [
        (Story) => (
            <div style={{ width: "320px" }}>
                <Story />
            </div>
        ),
    ],
};

export const WithoutImage: Story = {
    args: {
        doc: { ...mockDoc, thumbnail_url: null },
        categories: mockCategories,
    },
    decorators: [
        (Story) => (
            <div style={{ width: "400px" }}>
                <Story />
            </div>
        ),
    ],
};
