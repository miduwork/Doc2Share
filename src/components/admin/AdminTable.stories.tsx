import type { Meta, StoryObj } from '@storybook/react';
import AdminTable from './AdminTable';
import React from 'react';
import { Package } from 'lucide-react';

const meta: Meta<typeof AdminTable> = {
    title: 'Admin/AdminTable',
    component: AdminTable,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AdminTable>;

const sampleData = [
    { id: '1', name: 'Tài liệu Toán 12', price: 50000, sales: 120 },
    { id: '2', name: 'Đề thi THPT Quốc gia Lý', price: 45000, sales: 85 },
    { id: '3', name: 'Sổ tay Tiếng Anh chuyên sâu', price: 80000, sales: 210 },
];

const columns = [
    { id: 'name', header: 'Tên tài liệu' },
    {
        id: 'price',
        header: 'Giá',
        cell: (row: any) => `${row.price.toLocaleString('vi-VN')} ₫`,
        cellClassName: 'px-3 py-1.5 text-right font-medium text-primary'
    },
    { id: 'sales', header: 'Lượt bán', cellClassName: 'px-3 py-1.5 text-right tabular-nums' },
];

export const Default: Story = {
    args: {
        columns: columns,
        data: sampleData,
        emptyMessage: 'Không có dữ liệu',
        getRowId: (row: any) => row.id,
    },
};

export const Empty: Story = {
    args: {
        columns: columns,
        data: [],
        emptyMessage: 'Chưa có tài liệu nào trong danh mục này.',
        emptyIcon: <Package className="h-8 w-8" />,
        getRowId: (row: any) => row.id,
    },
};

export const Expandable: Story = {
    args: {
        columns: columns,
        data: sampleData,
        emptyMessage: 'Không có dữ liệu',
        getRowId: (row: any) => row.id,
        expandedRowId: '2',
        expandableRow: (row: any) => (
            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p><strong>Mô tả chi tiết:</strong> Đây là mô tả bổ sung cho {row.name}.</p>
                <p>ID tài liệu: {row.id}</p>
            </div>
        ),
    },
};
