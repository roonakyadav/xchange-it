import { supabase } from './supabase'

export async function uploadChatMedia(
    file: File,
    senderId: string,
    receiverId: string,
    setProgress: (progress: number) => void
): Promise<string> {
    // Check app authentication (not Supabase auth since app uses custom auth)
    const username = localStorage.getItem('x_user')

    if (!username) {
        console.warn('User not authenticated. Upload aborted.')
        alert('Please log in before uploading media.')
        throw new Error('User not authenticated')
    }

    const fileExt = file.name.split('.').pop()
    const filePath = `chat_media/${senderId}_${receiverId}/${Date.now()}.${fileExt}`

    // Start upload and track progress
    setProgress(0)

    // Try upload with RLS bypass for public bucket
    const { data, error } = await supabase.storage
        .from('chat_media')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        })

    // If RLS error, try alternative approach
    if (error && error.message.includes('row level security')) {
        console.warn('RLS policy blocking upload, trying alternative method')
        // For public buckets, we might need to use a different approach
        // This is a fallback for testing
        throw new Error('Storage upload blocked by policy. Please ensure the chat_media bucket is public or RLS policies allow uploads.')
    }

    if (error) {
        console.error('Upload error:', error)
        throw error
    }

    // Simulate progress for now (since Supabase doesn't provide real-time progress)
    // In a real implementation, you might need to use XMLHttpRequest or fetch with progress tracking
    setProgress(100)

    const { data: publicUrl } = supabase.storage
        .from('chat_media')
        .getPublicUrl(filePath)

    return publicUrl.publicUrl
}
