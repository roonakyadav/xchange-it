'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { profileUpdateSchema, type ProfileUpdateInput } from '@/lib/validations'
import { checkRateLimit } from '@/lib/rate-limit'
import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateProfile(formData: FormData) {
    try {
        const supabase = await createServerSupabaseClient()

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            throw new Error('Unauthorized')
        }

        // Rate limiting: 10 updates per hour
        const rateLimit = await checkRateLimit(user.id, 'profile_update', 10, 60)
        if (!rateLimit.allowed) {
            throw new Error(`Rate limit exceeded. Try again after ${rateLimit.resetTime.toLocaleTimeString()}`)
        }

        // Parse form data
        const rawData = {
            username: formData.get('username') as string,
            full_name: formData.get('full_name') as string,
            bio: formData.get('bio') as string,
            location: formData.get('location') as string,
            links: {
                website: formData.get('website') as string,
                twitter: formData.get('twitter') as string,
                github: formData.get('github') as string,
                telegram: formData.get('telegram') as string,
            },
        }

        // Validate data
        const validatedData = profileUpdateSchema.parse(rawData)

        // Check username availability if changed
        const { data: currentProfile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single()

        if (currentProfile?.username !== validatedData.username) {
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', validatedData.username)
                .neq('id', user.id)
                .single()

            if (existingUser) {
                throw new Error('Username is already taken')
            }
        }

        // Handle avatar upload if provided
        const avatarFile = formData.get('avatar') as File
        let avatarUrl = formData.get('currentAvatar') as string

        if (avatarFile && avatarFile.size > 0) {
            // Upload avatar to storage
            const fileExt = avatarFile.name.split('.').pop()
            const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`
            const filePath = fileName

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, avatarFile, {
                    upsert: true
                })

            if (uploadError) {
                throw new Error(`Failed to upload avatar: ${uploadError.message}`)
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            avatarUrl = publicUrl
        }

        // Update profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                username: validatedData.username,
                full_name: validatedData.full_name || null,
                bio: validatedData.bio || null,
                location: validatedData.location || null,
                avatar_url: avatarUrl || null,
                links: validatedData.links,
            })
            .eq('id', user.id)

        if (updateError) {
            throw new Error(`Failed to update profile: ${updateError.message}`)
        }

        // TODO: Revalidate cache tags

    } catch (error) {
        console.error('Profile update error:', error)
        throw error
    }

    // Redirect back to profile
    redirect(`/u/${formData.get('username') as string}`)
}
