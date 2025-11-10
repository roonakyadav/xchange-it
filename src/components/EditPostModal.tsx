'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface EditPostModalProps {
    post: any
    onClose: () => void
    onUpdate: () => void
}

export default function EditPostModal({ post, onClose, onUpdate }: EditPostModalProps) {
    const [formData, setFormData] = useState({
        title: post.title,
        description: post.description,
        price: post.price || '',
    })
    const [loading, setLoading] = useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            console.log('🔄 [EDIT_POST] Starting update for post:', post.id)
            console.log('📝 [EDIT_POST] Form data:', formData)
            console.log('👤 [EDIT_POST] Post owner:', post.username)

            // First check if post exists and user owns it
            const { data: existingPost, error: fetchError } = await supabase
                .from('posts')
                .select('*')
                .eq('id', post.id)
                .single()

            if (fetchError) {
                console.error('❌ [EDIT_POST] Error fetching post:', fetchError)
                toast.error('Failed to verify post ownership')
                return
            }

            if (!existingPost) {
                console.error('❌ [EDIT_POST] Post not found')
                toast.error('Post not found')
                return
            }

            console.log('✅ [EDIT_POST] Post exists, owner:', existingPost.username)

            if (existingPost.username !== post.username) {
                console.error('❌ [EDIT_POST] Ownership mismatch')
                toast.error('You can only edit your own posts')
                return
            }

            console.log('🔄 [EDIT_POST] Updating post...')

            // Update the post
            const { data, error } = await supabase
                .from('posts')
                .update({
                    title: formData.title,
                    description: formData.description,
                    price: formData.price,
                })
                .eq('id', post.id)
                .select()

            if (error) {
                console.error('❌ [EDIT_POST] Update error:', error)
                console.error('❌ [EDIT_POST] Error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                })
                toast.error(`Failed to update post: ${error.message}`)
            } else {
                console.log('✅ [EDIT_POST] Update successful:', data)
                toast.success('Post updated successfully!')
                onUpdate()
                onClose()
            }
        } catch (error: any) {
            console.error('❌ [EDIT_POST] Unexpected error:', error)
            toast.error(`Failed to update post: ${error.message || 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 p-6 rounded-xl w-[90%] md:w-[500px] border border-gray-800 shadow-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-semibold mb-4 text-white">Edit Post</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Title</label>
                        <input
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="Post title"
                            className="w-full p-3 bg-gray-800 text-gray-100 border border-gray-700 rounded-xl focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Post description"
                            className="w-full p-3 rounded-xl bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 h-32 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Price</label>
                        <input
                            name="price"
                            value={formData.price}
                            onChange={handleChange}
                            placeholder="Price (optional)"
                            className="w-full p-3 bg-gray-800 text-gray-100 border border-gray-700 rounded-xl focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-600 rounded-xl hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white rounded-xl font-medium transition-colors disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}
