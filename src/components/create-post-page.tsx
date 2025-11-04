'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import imageCompression from 'browser-image-compression'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { createPostSchema, type CreatePostInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BottomNav } from '@/components/bottom-nav'
import { toast } from 'sonner'
import { X, Upload, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompressedImage {
    file: File
    preview: string
    originalSize: number
    compressedSize: number
}

const MAX_IMAGES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const COMPRESSION_OPTIONS = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
}

async function uploadImages(images: CompressedImage[]): Promise<string[]> {
    const supabase = createBrowserSupabaseClient()
    const uploadedUrls: string[] = []

    for (const image of images) {
        const fileExt = image.file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `posts/${fileName}`

        const { error } = await supabase.storage
            .from('post-images')
            .upload(filePath, image.file)

        if (error) {
            throw new Error(`Failed to upload image: ${error.message}`)
        }

        const { data } = supabase.storage
            .from('post-images')
            .getPublicUrl(filePath)

        uploadedUrls.push(data.publicUrl)
    }

    return uploadedUrls
}

async function createPost(data: CreatePostInput & { images: string[] }) {
    const supabase = createBrowserSupabaseClient()

    const { data: post, error } = await supabase
        .from('posts')
        .insert({
            type: data.type,
            title: data.title,
            description: data.description || null,
            category: data.category || null,
            price: data.price || null,
            currency: data.currency,
            images: data.images,
            location: data.location || null,
            tags: data.tags,
        })
        .select()
        .single()

    if (error) {
        throw new Error(error.message)
    }

    return post
}

export function CreatePostPage() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [images, setImages] = useState<CompressedImage[]>([])
    const [uploadProgress, setUploadProgress] = useState(0)
    const [tagInput, setTagInput] = useState('')

    const form = useForm<CreatePostInput>({
        resolver: zodResolver(createPostSchema),
        defaultValues: {
            type: 'listing',
            currency: 'USD',
            tags: [],
        },
    })

    const createPostMutation = useMutation({
        mutationFn: async (data: CreatePostInput) => {
            setUploadProgress(10)

            // Upload images if any
            let imageUrls: string[] = []
            if (images.length > 0) {
                setUploadProgress(30)
                imageUrls = await uploadImages(images)
                setUploadProgress(70)
            }

            // Create post
            const post = await createPost({ ...data, images: imageUrls })
            setUploadProgress(100)

            return post
        },
        onSuccess: () => {
            toast.success('Post created successfully!')
            router.push('/feed')
        },
        onError: (error) => {
            toast.error(`Failed to create post: ${error.message}`)
            setUploadProgress(0)
        },
    })

    const handleImageSelect = async (files: FileList | null) => {
        if (!files) return

        const newImages: CompressedImage[] = []

        for (const file of Array.from(files)) {
            if (images.length + newImages.length >= MAX_IMAGES) {
                toast.error(`Maximum ${MAX_IMAGES} images allowed`)
                break
            }

            if (file.size > MAX_FILE_SIZE) {
                toast.error(`File ${file.name} is too large. Maximum size is 10MB.`)
                continue
            }

            if (!file.type.startsWith('image/')) {
                toast.error(`File ${file.name} is not an image`)
                continue
            }

            try {
                const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS)
                const preview = URL.createObjectURL(compressedFile)

                newImages.push({
                    file: compressedFile,
                    preview,
                    originalSize: file.size,
                    compressedSize: compressedFile.size,
                })
            } catch (error) {
                toast.error(`Failed to compress ${file.name}`)
            }
        }

        setImages(prev => [...prev, ...newImages])
    }

    const removeImage = (index: number) => {
        setImages(prev => {
            const newImages = [...prev]
            URL.revokeObjectURL(newImages[index].preview)
            newImages.splice(index, 1)
            return newImages
        })
    }

    const addTag = () => {
        const tag = tagInput.trim().toLowerCase()
        if (!tag) return

        const currentTags = form.getValues('tags') || []
        if (currentTags.includes(tag)) {
            toast.error('Tag already exists')
            return
        }

        if (currentTags.length >= 10) {
            toast.error('Maximum 10 tags allowed')
            return
        }

        form.setValue('tags', [...currentTags, tag])
        setTagInput('')
    }

    const removeTag = (tagToRemove: string) => {
        const currentTags = form.getValues('tags') || []
        form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove))
    }

    const onSubmit = (data: CreatePostInput) => {
        createPostMutation.mutate(data)
    }

    const currentTags = form.watch('tags') || []

    return (
        <div className="min-h-screen bg-background">
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
                <div className="px-4 py-3 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="p-2"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Create Post</h1>
                    <div className="w-10" />
                </div>
            </div>

            <div className="p-4 pb-20">
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Post Type */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Post Type</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4">
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        value="listing"
                                        {...form.register('type')}
                                        className="text-accent"
                                    />
                                    <span>Listing (I'm offering)</span>
                                </label>
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        value="request"
                                        {...form.register('type')}
                                        className="text-accent"
                                    />
                                    <span>Request (I'm looking for)</span>
                                </label>
                            </div>
                            {form.formState.errors.type && (
                                <p className="text-sm text-destructive mt-1">
                                    {form.formState.errors.type.message}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Title */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Title</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="What are you offering/requesting?"
                                {...form.register('title')}
                                className="text-base"
                            />
                            {form.formState.errors.title && (
                                <p className="text-sm text-destructive mt-1">
                                    {form.formState.errors.title.message}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Description */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="Provide more details..."
                                rows={4}
                                {...form.register('description')}
                            />
                            {form.formState.errors.description && (
                                <p className="text-sm text-destructive mt-1">
                                    {form.formState.errors.description.message}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Images */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Images (Optional)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Image Grid */}
                                {images.length > 0 && (
                                    <div className="grid grid-cols-2 gap-4">
                                        {images.map((image, index) => (
                                            <div key={index} className="relative">
                                                <img
                                                    src={image.preview}
                                                    alt={`Upload ${index + 1}`}
                                                    className="w-full h-32 object-cover rounded-lg"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    className="absolute top-2 right-2 h-6 w-6 p-0"
                                                    onClick={() => removeImage(index)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                                <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                                                    {(image.compressedSize / 1024 / 1024).toFixed(1)}MB
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Upload Button */}
                                {images.length < MAX_IMAGES && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-32 border-2 border-dashed"
                                    >
                                        <div className="flex flex-col items-center space-y-2">
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">
                                                Add Images ({images.length}/{MAX_IMAGES})
                                            </span>
                                        </div>
                                    </Button>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => handleImageSelect(e.target.files)}
                                    className="hidden"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Price */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Price (Optional)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    {...form.register('price', { valueAsNumber: true })}
                                />
                                <select
                                    {...form.register('currency')}
                                    className="px-3 py-2 border border-border rounded-md bg-background"
                                >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                </select>
                            </div>
                            {form.formState.errors.price && (
                                <p className="text-sm text-destructive mt-1">
                                    {form.formState.errors.price.message}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Category */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Category (Optional)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <select
                                {...form.register('category')}
                                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                            >
                                <option value="">Select a category</option>
                                <option value="subscription">Subscription</option>
                                <option value="api-credits">API Credits</option>
                                <option value="software">Software</option>
                                <option value="digital-goods">Digital Goods</option>
                                <option value="other">Other</option>
                            </select>
                        </CardContent>
                    </Card>

                    {/* Location */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Location (Optional)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="City, Country or Remote"
                                {...form.register('location')}
                            />
                        </CardContent>
                    </Card>

                    {/* Tags */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Tags (Optional)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add a tag..."
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                    />
                                    <Button type="button" onClick={addTag} size="sm">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                {currentTags.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {currentTags.map((tag) => (
                                            <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                                                {tag} <X className="h-3 w-3 ml-1" />
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Progress */}
                    {uploadProgress > 0 && (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Creating post...</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <Progress value={uploadProgress} className="w-full" />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Submit */}
                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={createPostMutation.isPending}
                    >
                        {createPostMutation.isPending ? 'Creating...' : 'Create Post'}
                    </Button>
                </form>
            </div>

            <BottomNav />
        </div>
    )
}
