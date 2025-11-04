import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('u')?.toLowerCase()

    if (!username) {
        return NextResponse.json({ error: 'Username parameter is required' }, { status: 400 })
    }

    // Basic validation
    if (username.length < 3 || username.length > 20) {
        return NextResponse.json({ available: false, reason: 'Username must be 3-20 characters' })
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
        return NextResponse.json({ available: false, reason: 'Username can only contain lowercase letters, numbers, and underscores' })
    }

    if (['admin', 'root', 'system', 'null', 'undefined'].includes(username)) {
        return NextResponse.json({ available: false, reason: 'This username is not allowed' })
    }

    try {
        const supabase = await createServerSupabaseClient()

        const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking username availability:', error)
            return NextResponse.json({ error: 'Failed to check username availability' }, { status: 500 })
        }

        const available = !data

        return NextResponse.json({ available })
    } catch (error) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
