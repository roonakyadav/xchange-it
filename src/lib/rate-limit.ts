import { createServerSupabaseClient } from './supabase-server'

export interface RateLimitResult {
    allowed: boolean
    remaining: number
    resetTime: Date
}

export async function checkRateLimit(
    userId: string,
    key: string,
    limit: number,
    windowMinutes: number
): Promise<RateLimitResult> {
    const supabase = await createServerSupabaseClient()
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

    // Get current count for this window
    const { data: existingRecord, error } = await supabase
        .from('rate_limits')
        .select('count, window_start')
        .eq('user_id', userId)
        .eq('key', key)
        .gte('window_start', windowStart.toISOString())
        .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking rate limit:', error)
        // Allow request on error to avoid blocking users
        return { allowed: true, remaining: limit - 1, resetTime: new Date(Date.now() + windowMinutes * 60 * 1000) }
    }

    const currentCount = existingRecord?.count || 0
    const resetTime = new Date((existingRecord?.window_start ? new Date(existingRecord.window_start).getTime() : Date.now()) + windowMinutes * 60 * 1000)

    if (currentCount >= limit) {
        return { allowed: false, remaining: 0, resetTime }
    }

    // Update or insert the rate limit record
    const { error: upsertError } = await supabase
        .from('rate_limits')
        .upsert({
            user_id: userId,
            key,
            count: currentCount + 1,
            window_start: windowStart.toISOString(),
        }, {
            onConflict: 'user_id,key'
        })

    if (upsertError) {
        console.error('Error updating rate limit:', upsertError)
        // Allow request on error
        return { allowed: true, remaining: limit - currentCount - 1, resetTime }
    }

    return {
        allowed: true,
        remaining: limit - currentCount - 1,
        resetTime
    }
}
