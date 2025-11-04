import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')

    if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    try {
        const supabase = await createServerSupabaseClient()

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: wishlistItem, error } = await supabase
            .from('wishlist')
            .select('*')
            .eq('user_id', user.id)
            .eq('post_id', postId)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking wishlist:', error)
            return NextResponse.json({ error: 'Failed to check wishlist' }, { status: 500 })
        }

        return NextResponse.json({ isWishlisted: !!wishlistItem })
    } catch (error) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
        const body = await request.json()
        const { postId, action } = body // action: 'add' or 'remove'

        if (!postId || !action) {
            return NextResponse.json({ error: 'Post ID and action are required' }, { status: 400 })
        }

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (action === 'add') {
            const { error } = await supabase
                .from('wishlist')
                .insert({
                    user_id: user.id,
                    post_id: postId,
                })

            if (error) {
                console.error('Error adding to wishlist:', error)
                return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 })
            }

            return NextResponse.json({ success: true, action: 'added' })
        } else if (action === 'remove') {
            const { error } = await supabase
                .from('wishlist')
                .delete()
                .eq('user_id', user.id)
                .eq('post_id', postId)

            if (error) {
                console.error('Error removing from wishlist:', error)
                return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 })
            }

            return NextResponse.json({ success: true, action: 'removed' })
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }
    } catch (error) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
