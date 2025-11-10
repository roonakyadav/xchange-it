'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface MediaViewerProps {
    isOpen: boolean
    onClose: () => void
    mediaUrl: string
    isVideo?: boolean
}

export default function MediaViewer({ isOpen, onClose, mediaUrl, isVideo }: MediaViewerProps) {
    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    {/* Close button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onClose()
                        }}
                        className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                        aria-label="Close media viewer"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Media content */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative max-w-full max-h-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isVideo ? (
                            <video
                                src={mediaUrl}
                                controls
                                autoPlay
                                className="max-w-full max-h-full object-contain rounded-lg"
                                style={{ maxHeight: '90vh', maxWidth: '90vw' }}
                            />
                        ) : (
                            <img
                                src={mediaUrl}
                                alt="Full size media"
                                className="max-w-full max-h-full object-contain rounded-lg"
                                style={{ maxHeight: '90vh', maxWidth: '90vw' }}
                            />
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
