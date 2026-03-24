import type { Meta, StoryObj } from '@storybook/react';
import ImageCard from './ImageCard';
import React from 'react';
import { Star } from 'lucide-react';

const meta: Meta<typeof ImageCard> = {
    title: 'Shared/ImageCard',
    component: ImageCard,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ImageCard>;

export const Default: Story = {
    args: {
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=640&auto=format&fit=crop',
        alt: 'Tài liệu ôn thi',
        topBadge: 'Premium',
        bottomBadge: (
            <>
                <Star className="h-3.5 w-3.5 fill-current" />
                4.8 (120)
            </>
        ),
    },
};

export const NoImage: Story = {
    args: {
        imageUrl: null,
        alt: 'No image',
        topBadge: 'Free',
    },
};

export const SquareAspect: Story = {
    args: {
        imageUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=640&auto=format&fit=crop',
        alt: 'Square image',
        aspectClass: 'aspect-square',
    },
};
