import type { Meta, StoryObj } from '@storybook/react';
import PriceCtaBlock from './PriceCtaBlock';

const meta: Meta<typeof PriceCtaBlock> = {
    title: 'Shared/PriceCtaBlock',
    component: PriceCtaBlock,
    tags: ['autodocs'],
    argTypes: {
        price: { control: 'number' },
        variant: { control: 'select', options: ['default', 'compact'] },
    },
};

export default meta;
type Story = StoryObj<typeof PriceCtaBlock>;

export const Default: Story = {
    args: {
        price: 150000,
        priceLabel: 'Giá bán',
        ctaText: 'Xem chi tiết',
        variant: 'default',
    },
};

export const Compact: Story = {
    args: {
        price: 50000,
        priceLabel: 'Giá ưu đãi',
        ctaText: 'Mua ngay',
        variant: 'compact',
    },
};

export const WithHref: Story = {
    args: {
        price: 200000,
        href: '/cua-hang/123',
        ctaText: 'Thanh toán',
    },
};
