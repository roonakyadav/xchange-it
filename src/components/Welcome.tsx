'use client'

import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Welcome() {
    const router = useRouter()

    useEffect(() => {
        const timer = setTimeout(() => {
            // Mark welcome as seen
            localStorage.setItem('x_seen_welcome', 'true')
            router.push('/auth')
        }, 1500) // 1.5 seconds as specified

        return () => clearTimeout(timer)
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="text-center"
            >
                <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="text-6xl font-bold mb-4 text-white"
                >
                    Xchange
                </motion.h1>
                <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="text-xl text-gray-400 mb-8"
                >
                    Buy and sell locally
                </motion.p>
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.9, duration: 0.8 }}
                    className="w-32 h-1 bg-red-500 mx-auto rounded-full"
                />
            </motion.div>
        </div>
    )
}
