import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')

    if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    try {
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
            return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
        }

        return NextResponse.json({ comments })
    } catch (error) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const body = await request.json()
        const { postId, content } = body

        if (!postId || !content) {
            return NextResponse.json({ error: 'Post ID and content are required' }, { status: 400 })
        }

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Create comment
        const { data: comment, error } = await supabase
            .from('comments')
            .insert({
                post_id: postId,
                user_id: user.id,
                content: content.trim(),
            })
            .select(`
        *,
        profiles (
          username,
          full_name,
          avatar_url
        )
      `)
            .single()

        if (error) {
            console.error('Error creating comment:', error)
            return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
        }

        // TODO: Revalidate cache tags

        return NextResponse.json({ comment })
    } catch (error) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
