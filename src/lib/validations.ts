import { z } from 'zod'

export const createPostSchema = z.object({
    type: z.enum(['listing', 'request'], {
        message: 'Please select a post type',
    }),
    title: z
        .string()
        .min(5, 'Title must be at least 5 characters')
        .max(100, 'Title must be less than 100 characters'),
    description: z
        .string()
        .max(1000, 'Description must be less than 1000 characters')
        .optional(),
    category: z.string().optional(),
    price: z
        .number()
        .min(0, 'Price must be positive')
        .optional(),
    currency: z.string(),
    location: z.string().optional(),
    tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed'),
})

export type CreatePostInput = z.infer<typeof createPostSchema>

export const commentSchema = z.object({
    content: z
        .string()
        .min(1, 'Comment cannot be empty')
        .max(500, 'Comment must be less than 500 characters'),
})

export type CommentInput = z.infer<typeof commentSchema>

export const usernameSchema = z.object({
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be less than 20 characters')
        .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
        .refine(val => !['admin', 'root', 'system', 'null', 'undefined'].includes(val.toLowerCase()), 'This username is not allowed'),
})

export const profileUpdateSchema = z.object({
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be less than 20 characters')
        .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
        .refine(val => !['admin', 'root', 'system', 'null', 'undefined'].includes(val.toLowerCase()), 'This username is not allowed'),
    full_name: z
        .string()
        .max(100, 'Full name must be less than 100 characters')
        .optional(),
    bio: z
        .string()
        .max(280, 'Bio must be less than 280 characters')
        .optional(),
    location: z
        .string()
        .max(100, 'Location must be less than 100 characters')
        .optional(),
    links: z.object({
        website: z.string().url('Invalid website URL').optional().or(z.literal('')),
        twitter: z.string().regex(/^@?[a-zA-Z0-9_]{1,15}$/, 'Invalid Twitter handle').optional().or(z.literal('')),
        github: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid GitHub username').optional().or(z.literal('')),
        telegram: z.string().regex(/^@[a-zA-Z0-9_]{5,32}$/, 'Invalid Telegram username').optional().or(z.literal('')),
    }).optional(),
})

export type UsernameInput = z.infer<typeof usernameSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
