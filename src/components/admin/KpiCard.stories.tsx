import type { Meta, StoryObj } from '@storybook/react';
import KpiCard from './KpiCard';
import React from 'react';
import { DollarSign, ShoppingCart, Users } from 'lucide-react';

const meta: Meta<typeof KpiCard> = {
    title: 'Admin/KpiCard',
    component: KpiCard,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof KpiCard>;

export const Revenue: Story = {
    args: {
        icon: <DollarSign className="h-4 w-4" />,
        label: 'Doanh thu',
        value: '1.200.000 ₫',
        sub: '+12% so với tháng trước',
        tooltip: 'Tổng doanh thu thực nhận sau phí',
    },
};

export const Orders: Story = {
    args: {
        icon: <ShoppingCart className="h-4 w-4" />,
        label: 'Đơn hàng',
        value: '45',
        sub: '5 đơn đang chờ',
    },
};

export const UsersCount: Story = {
    args: {
        icon: <Users className="h-4 w-4" />,
        label: 'Người dùng mới',
        value: '128',
        sub: 'Tăng trưởng 5%',
    },
};
