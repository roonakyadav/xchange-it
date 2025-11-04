'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore, useUIStore } from '@/lib/store'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { profileUpdateSchema, type ProfileUpdateInput } from '@/lib/validations'
import { updateProfile } from '@/app/settings/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BottomNav } from '@/components/bottom-nav'
import { toast } from 'sonner'
import {
    ArrowLeft,
    Camera,
    X,
    Check,
    Loader2,
    AlertCircle,
    CheckCircle2
} from 'lucide-react'
import { motion } from 'framer-motion'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface Profile {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
    bio: string | null
    location: string | null
    links: {
        website?: string
        twitter?: string
        github?: string
        telegram?: string
    }
}

export function SettingsPage() {
    const router = useRouter()
    const { user } = useAuthStore()
    const { setAuthModalOpen } = useUIStore()

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [cropModalOpen, setCropModalOpen] = useState(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [crop, setCrop] = useState<Crop>()
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
    const [usernameChecking, setUsernameChecking] = useState(false)

    const imgRef = useRef<HTMLImageElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const form = useForm<ProfileUpdateInput>({
        resolver: zodResolver(profileUpdateSchema),
        defaultValues: {
            username: '',
            full_name: '',
            bio: '',
            location: '',
            links: {
                website: '',
                twitter: '',
                github: '',
                telegram: '',
            },
        },
    })

    // Fetch current profile
    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user) return null
            const supabase = createBrowserSupabaseClient()
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (error) throw error
            return data as Profile
        },
        enabled: !!user,
    })

    // Update form when profile loads
    useEffect(() => {
        if (profile) {
            form.reset({
                username: profile.username || '',
                full_name: profile.full_name || '',
                bio: profile.bio || '',
                location: profile.location || '',
                links: {
                    website: profile.links?.website || '',
                    twitter: profile.links?.twitter || '',
                    github: profile.links?.github || '',
                    telegram: profile.links?.telegram || '',
                },
            })
            setAvatarPreview(profile.avatar_url)
        }
    }, [profile, form])

    // Check username availability
    const checkUsername = async (username: string) => {
        if (!username || username.length < 3) {
            setUsernameAvailable(null)
            return
        }

        setUsernameChecking(true)
        try {
            const response = await fetch(`/api/username/availability?u=${encodeURIComponent(username)}`)
            const data = await response.json()
            setUsernameAvailable(data.available)
        } catch (error) {
            console.error('Error checking username:', error)
            setUsernameAvailable(null)
        } finally {
            setUsernameChecking(false)
        }
    }

    // Debounced username checking
    useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (name === 'username') {
                const timeoutId = setTimeout(() => {
                    checkUsername(value.username || '')
                }, 500)
                return () => clearTimeout(timeoutId)
            }
        })
        return () => subscription.unsubscribe()
    }, [form])

    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = () => {
                setSelectedImage(reader.result as string)
                setCropModalOpen(true)
            }
            reader.readAsDataURL(file)
        }
    }

    const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
            throw new Error('No 2d context')
        }

        const scaleX = image.naturalWidth / image.width
        const scaleY = image.naturalHeight / image.height

        canvas.width = crop.width
        canvas.height = crop.height

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width,
            crop.height
        )

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob)
            }, 'image/jpeg', 0.95)
        })
    }

    const handleCropComplete = async () => {
        if (!completedCrop || !imgRef.current) return

        try {
            const croppedBlob = await getCroppedImg(imgRef.current, completedCrop)
            const croppedUrl = URL.createObjectURL(croppedBlob)
            setAvatarPreview(croppedUrl)
            setCropModalOpen(false)
            setSelectedImage(null)

            // Store the cropped image for form submission
            const file = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' })
            setAvatarFile(file)
        } catch (error) {
            console.error('Error cropping image:', error)
            toast.error('Failed to crop image')
        }
    }

    const removeAvatar = () => {
        setAvatarPreview(null)
        // Remove avatar from form data
        const formData = new FormData()
        formData.append('removeAvatar', 'true')
    }

    const onSubmit = async (data: ProfileUpdateInput) => {
        if (!user) {
            setAuthModalOpen(true)
            return
        }

        try {
            const formData = new FormData()

            // Add form fields
            Object.entries(data).forEach(([key, value]) => {
                if (key === 'links') {
                    Object.entries(value as any).forEach(([linkKey, linkValue]) => {
                        formData.append(linkKey, linkValue as string)
                    })
                } else {
                    formData.append(key, value as string)
                }
            })

            // Add current avatar URL
            formData.append('currentAvatar', avatarPreview || '')

            // Add cropped avatar if exists
            if (avatarFile) {
                formData.append('avatar', avatarFile)
            }

            await updateProfile(formData)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update profile')
        }
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground mb-4">Please sign in to edit your profile</p>
                        <Button onClick={() => setAuthModalOpen(true)}>Sign In</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (profileLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    const currentUsername = form.watch('username')
    const usernameError = form.formState.errors.username

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
                <div className="px-4 py-3 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="p-2"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-semibold">Settings</h1>
                    <div className="w-10" />
                </div>
            </div>

            <div className="p-4 pb-20">
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Avatar Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Profile Picture</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center space-x-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={avatarPreview || undefined} />
                                    <AvatarFallback>
                                        {(profile?.username || 'U').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex space-x-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Camera className="h-4 w-4 mr-2" />
                                        Change
                                    </Button>
                                    {avatarPreview && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={removeAvatar}
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                            />
                        </CardContent>
                    </Card>

                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Username */}
                            <div>
                                <Label htmlFor="username">Username</Label>
                                <div className="relative">
                                    <Input
                                        id="username"
                                        {...form.register('username')}
                                        className="pl-8"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                                    {usernameChecking && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                                    )}
                                    {!usernameChecking && currentUsername && currentUsername.length >= 3 && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {usernameAvailable === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                            {usernameAvailable === false && <AlertCircle className="h-4 w-4 text-red-500" />}
                                        </div>
                                    )}
                                </div>
                                {usernameError && (
                                    <p className="text-sm text-destructive mt-1">{usernameError.message}</p>
                                )}
                                {!usernameError && currentUsername && currentUsername.length >= 3 && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {usernameAvailable === true && 'Username is available'}
                                        {usernameAvailable === false && 'Username is already taken'}
                                    </p>
                                )}
                            </div>

                            {/* Full Name */}
                            <div>
                                <Label htmlFor="full_name">Full Name</Label>
                                <Input
                                    id="full_name"
                                    {...form.register('full_name')}
                                />
                                {form.formState.errors.full_name && (
                                    <p className="text-sm text-destructive mt-1">
                                        {form.formState.errors.full_name.message}
                                    </p>
                                )}
                            </div>

                            {/* Bio */}
                            <div>
                                <Label htmlFor="bio">Bio</Label>
                                <Textarea
                                    id="bio"
                                    rows={3}
                                    {...form.register('bio')}
                                    placeholder="Tell us about yourself..."
                                />
                                <p className="text-sm text-muted-foreground mt-1">
                                    {form.watch('bio')?.length || 0}/280 characters
                                </p>
                                {form.formState.errors.bio && (
                                    <p className="text-sm text-destructive mt-1">
                                        {form.formState.errors.bio.message}
                                    </p>
                                )}
                            </div>

                            {/* Location */}
                            <div>
                                <Label htmlFor="location">Location</Label>
                                <Input
                                    id="location"
                                    {...form.register('location')}
                                    placeholder="City, Country"
                                />
                                {form.formState.errors.location && (
                                    <p className="text-sm text-destructive mt-1">
                                        {form.formState.errors.location.message}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Social Links */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Social Links</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Website */}
                            <div>
                                <Label htmlFor="website">Website</Label>
                                <Input
                                    id="website"
                                    type="url"
                                    {...form.register('links.website')}
                                    placeholder="https://yourwebsite.com"
                                />
                                {form.formState.errors.links?.website && (
                                    <p className="text-sm text-destructive mt-1">
                                        {form.formState.errors.links.website.message}
                                    </p>
                                )}
                            </div>

                            {/* Twitter */}
                            <div>
                                <Label htmlFor="twitter">Twitter</Label>
                                <div className="relative">
                                    <Input
                                        id="twitter"
                                        {...form.register('links.twitter')}
                                        className="pl-12"
                                        placeholder="username"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                                </div>
                                {form.formState.errors.links?.twitter && (
                                    <p className="text-sm text-destructive mt-1">
                                        {form.formState.errors.links.twitter.message}
                                    </p>
                                )}
                            </div>

                            {/* GitHub */}
                            <div>
                                <Label htmlFor="github">GitHub</Label>
                                <div className="relative">
                                    <Input
                                        id="github"
                                        {...form.register('links.github')}
                                        className="pl-12"
                                        placeholder="username"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">github.com/</span>
                                </div>
                                {form.formState.errors.links?.github && (
                                    <p className="text-sm text-destructive mt-1">
                                        {form.formState.errors.links.github.message}
                                    </p>
                                )}
                            </div>

                            {/* Telegram */}
                            <div>
                                <Label htmlFor="telegram">Telegram</Label>
                                <div className="relative">
                                    <Input
                                        id="telegram"
                                        {...form.register('links.telegram')}
                                        className="pl-8"
                                        placeholder="username"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                                </div>
                                {form.formState.errors.links?.telegram && (
                                    <p className="text-sm text-destructive mt-1">
                                        {form.formState.errors.links.telegram.message}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit */}
                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={form.formState.isSubmitting}
                    >
                        {form.formState.isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </form>
            </div>

            {/* Image Crop Modal */}
            {cropModalOpen && selectedImage && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-background rounded-lg p-6 max-w-md w-full"
                    >
                        <h3 className="text-lg font-semibold mb-4">Crop Avatar</h3>
                        <div className="mb-4">
                            <ReactCrop
                                crop={crop}
                                onChange={setCrop}
                                onComplete={setCompletedCrop}
                                aspect={1}
                                circularCrop
                            >
                                <img
                                    ref={imgRef}
                                    src={selectedImage}
                                    alt="Crop preview"
                                    className="max-w-full h-auto"
                                />
                            </ReactCrop>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCropModalOpen(false)
                                    setSelectedImage(null)
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleCropComplete}>
                                <Check className="h-4 w-4 mr-2" />
                                Crop
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}

            <BottomNav />
        </div>
    )
}
