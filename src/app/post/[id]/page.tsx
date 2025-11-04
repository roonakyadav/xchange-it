import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PostDetailPage } from '@/components/post-detail-page'
import type { Post, Comment } from '@/lib/types'

interface PageProps {
    params: Promise<{ id: string }>
}

async function getPost(id: string) {
    const supabase = await createServerSupabaseClient()

    const { data: post, error } = await supabase
        .from('posts')
        .select(`
      *,
      profiles (
        username,
        full_name,
        avatar_url
      )
    `)
        .eq('id', id)
        .eq('is_active', true)
        .single()

    if (error || !post) {
        return null
    }

    return post as Post
}

async function getComments(postId: string) {
    const supabase = await createServerSupabaseClient()

    const { data: comments, error } = await supabase
        .from('comments')
        .select(`
      *,
      profiles (
        username,
        full_name,
        avatar_url
      )
    `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching comments:', error)
        return []
    }

    return comments as Comment[]
}

export async function generateMetadata({ params }: PageProps) {
    const { id } = await params
    const post = await getPost(id)

    if (!post) {
        return {
            title: 'Post Not Found',
        }
    }

    return {
        title: `${post.title} - Xchange`,
        description: post.description || `View this ${post.type} on Xchange`,
        openGraph: {
            title: post.title,
            description: post.description || `View this ${post.type} on Xchange`,
            images: post.images.length > 0 ? [post.images[0]] : [],
        },
    }
}

export default async function PostPage({ params }: PageProps) {
    const { id } = await params
    const post = await getPost(id)

    if (!post) {
        notFound()
    }

    const comments = await getComments(id)

    return <PostDetailPage post={post} initialComments={comments} />
}
