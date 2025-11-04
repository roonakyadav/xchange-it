import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'listing' or 'request'
    const cursor = searchParams.get('cursor') // for pagination
    const limit = parseInt(searchParams.get('limit') || '20')

    try {
        const supabase = await createServerSupabaseClient()

        let query = supabase
            .from('posts')
            .select(`
        id,
        title,
        description,
        category,
        price,
        currency,
        images,
        location,
        tags,
        created_at,
        user_id,
        profiles (
          username,
          full_name,
          avatar_url
        )
      `)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (type && type !== 'all') {
            query = query.eq('type', type)
        }

        if (cursor) {
            query = query.lt('created_at', cursor)
        }

        const { data: posts, error } = await query

        if (error) {
            console.error('Error fetching posts:', error)
            return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
        }

        const nextCursor = posts.length === limit ? posts[posts.length - 1].created_at : null

        return NextResponse.json({
            posts,
            nextCursor,
        })
    } catch (error) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
