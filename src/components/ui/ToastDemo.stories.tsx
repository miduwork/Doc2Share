import type { Meta, StoryObj } from "@storybook/react";
import { toast, Toaster } from "sonner";
import { useEffect } from "react";

const ToastDemo = ({ type, message, description }: { type: 'success' | 'error' | 'info' | 'warning', message: string, description?: string }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            if (type === 'success') toast.success(message, { description });
            if (type === 'error') toast.error(message, { description });
            if (type === 'info') toast.info(message, { description });
            if (type === 'warning') toast.warning(message, { description });
        }, 100);
        return () => clearTimeout(timer);
    }, [type, message, description]);

    return (
        <div className="flex flex-col items-center justify-center p-10 min-h-[300px]">
            <Toaster position="bottom-right" richColors />
            <button
                className="btn-primary"
                onClick={() => {
                    if (type === 'success') toast.success(message, { description });
                    if (type === 'error') toast.error(message, { description });
                    if (type === 'info') toast.info(message, { description });
                    if (type === 'warning') toast.warning(message, { description });
                }}
            >
                Hiển thị Toast
            </button>
        </div>
    );
};

const meta = {
    title: "UI/ToastDemo",
    component: ToastDemo,
    parameters: {
        layout: "fullscreen",
    },
    tags: ["autodocs"],
    argTypes: {
        type: {
            control: "radio",
            options: ["success", "error", "info", "warning"],
        },
        message: { control: "text" },
        description: { control: "text" },
    },
} satisfies Meta<typeof ToastDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
    args: {
        type: "success",
        message: "Đăng nhập thành công",
        description: "Chào mừng bạn quay trở lại Doc2Share.",
    },
};

export const ErrorToast: Story = {
    args: {
        type: "error",
        message: "Lỗi thanh toán",
        description: "Không thể xác thực giao dịch. Vui lòng thử lại.",
    },
};

export const Info: Story = {
    args: {
        type: "info",
        message: "Cập nhật tài liệu mới",
        description: "Đề thi thử mới nhất đã được thêm vào tủ sách.",
    },
};
