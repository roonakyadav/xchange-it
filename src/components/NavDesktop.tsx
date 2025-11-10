'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { getChatPreviews } from '@/lib/db'
import { subscribeToChatUpdates } from '@/lib/realtime'
import { useUser } from '@/hooks/useUser'

import SellingToggle from './SellingToggle'

export default function NavDesktop() {
    const pathname = usePathname()
    const { user } = useUser()
    const [sellingMode, setSellingMode] = useState<'Selling' | 'Requesting'>('Selling')
    const [activeCategory, setActiveCategory] = useState('All')
    const [searchTerm, setSearchTerm] = useState('')
    const [hasUnread, setHasUnread] = useState(false)
    const [isSearchActive, setIsSearchActive] = useState(false)
    const [isDesktop, setIsDesktop] = useState(false)
    const [hidden, setHidden] = useState(false)

    // Check if desktop and handle scroll
    useEffect(() => {
        let lastScrollY = 0

        const checkDesktop = () => {
            const desktop = window.innerWidth >= 768
            setIsDesktop(desktop)
        }

        const handleScroll = () => {
            const currentScrollY = window.scrollY

            if (Math.abs(currentScrollY - lastScrollY) < 10) return

            if (currentScrollY > lastScrollY && currentScrollY > 80) {
                setHidden(true)
            } else {
                setHidden(false)
            }

            lastScrollY = currentScrollY
        }

        checkDesktop()
        window.addEventListener('resize', checkDesktop)
        window.addEventListener('scroll', handleScroll, { passive: true })

        return () => {
            window.removeEventListener('resize', checkDesktop)
            window.removeEventListener('scroll', handleScroll)
        }
    }, [])

    const navItems = [
        { href: '/feed', label: 'Feed' },
        { href: '/post/new', label: 'New Post' },
        { href: '/chats', label: 'Chats', hasUnread },
        { href: '/profile', label: 'Profile' },
    ]

    const categories = ['All', 'Subscription', 'Templates', 'Coupon Code', 'Art', 'Others']

    const isActive = (href: string) => {
        if (href === '/feed') {
            return pathname === '/feed'
        }
        return pathname.startsWith(href)
    }

    // Load selected mode from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('feed-mode')
        if (saved === 'selling' || saved === 'requesting') {
            setSellingMode(saved === 'selling' ? 'Selling' : 'Requesting')
        }
    }, [])

    const handleModeChange = (mode: 'Selling' | 'Requesting') => {
        setSellingMode(mode)
        const modeValue = mode.toLowerCase() as 'selling' | 'requesting'
        localStorage.setItem('feed-mode', modeValue)
        // Dispatch custom event to notify feed page
        window.dispatchEvent(new CustomEvent('feed-mode-change', { detail: modeValue }))
    }

    const handleSearchChange = (value: string) => {
        setSearchTerm(value)
        // Dispatch search event
        window.dispatchEvent(new CustomEvent('feed-search-change', { detail: value }))
    }

    const handleCategoryChange = (category: string) => {
        setActiveCategory(category)
        // Dispatch category event
        window.dispatchEvent(new CustomEvent('feed-category-change', { detail: category }))
    }

    // Check for unread messages
    useEffect(() => {
        if (!user) return

        const checkUnread = async () => {
            try {
                const chats = await getChatPreviews(user.username)
                const totalUnread = chats.reduce((total, chat) => total + chat.unreadCount, 0)
                setHasUnread(totalUnread > 0)
            } catch (error) {
                console.error('Failed to check unread:', error)
            }
        }

        checkUnread()

        // Subscribe to realtime updates
        const chatChannel = subscribeToChatUpdates(user.username, checkUnread)

        return () => {
            chatChannel.unsubscribe()
        }
    }, [user])

    // Hide all navbars on landing page
    if (pathname === '/') {
        return null
    }

    return (
        <>
            {/* Mobile Navbar - Two-level layout */}
            {pathname !== '/' && (
                <header className="block md:hidden fixed top-0 left-0 right-0 z-40 bg-black border-b border-gray-800 text-white">
                    {/* First level: xChange (left) + Toggle (right) */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <Link
                            href="/feed"
                            className="text-xl font-bold cursor-pointer hover:text-red-500 transition-colors"
                        >
                            xChange
                        </Link>
                        {pathname === '/feed' && (
                            <SellingToggle
                                sellingMode={sellingMode}
                                setSellingMode={handleModeChange}
                            />
                        )}
                    </div>

                    {/* Second level: Search bar - Only on /feed */}
                    {pathname === '/feed' && (
                        <div className="px-4 pb-3 relative">
                            {/* Search input */}
                            <input
                                type="text"
                                placeholder="Search posts..."
                                value={searchTerm}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                onFocus={() => setIsSearchActive(true)}
                                onBlur={() => setTimeout(() => setIsSearchActive(false), 200)}
                                className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-300"
                            />

                            {/* Animated category bar on search focus */}
                            <AnimatePresence>
                                {isSearchActive && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex overflow-x-auto no-scrollbar gap-2 mt-2 px-1 pb-1 bg-black/95 rounded-lg border border-gray-800"
                                    >
                                        {categories.map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => {
                                                    handleCategoryChange(cat)
                                                    setIsSearchActive(false)
                                                }}
                                                className={`flex-shrink-0 px-4 py-1 rounded-full text-sm border transition-all duration-200 ${activeCategory === cat
                                                    ? 'bg-blue-600 text-white'
                                                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </header>
            )}

            {/* Desktop Navbar - Only visible on desktop */}
            <motion.header
                initial={{ y: 0 }}
                animate={{
                    y: hidden && isDesktop ? -100 : 0,
                    transition: { duration: 0.3, ease: 'easeInOut' },
                }}
                className={`hidden md:flex sticky top-0 z-40 flex-col border-b border-gray-800 bg-black text-white transition-all duration-300 ${!hidden ? 'shadow-md shadow-black/50' : 'shadow-none'
                    }`}
            >
                {/* Level 1: Top Navbar */}
                <div className="flex justify-between items-center px-6 py-4">
                    <Link
                        href="/feed"
                        className="text-2xl font-bold cursor-pointer hover:text-red-500 transition-colors"
                    >
                        Xchange
                    </Link>
                    <nav className="flex gap-6">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`px-4 py-2 rounded-full transition-all duration-300 relative ${isActive(item.href)
                                    ? 'bg-red-600 text-white'
                                    : 'hover:bg-gray-800'
                                    }`}
                            >
                                {item.label}
                                {item.hasUnread && (
                                    <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                                )}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* Level 2: Bottom Navbar - Only on /feed */}
                {pathname === '/feed' && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-4 px-6 py-3 border-t border-gray-800"
                    >
                        {/* Selling Toggle */}
                        <SellingToggle
                            sellingMode={sellingMode}
                            setSellingMode={handleModeChange}
                        />

                        {/* Search Bar with Focus Categories */}
                        <div className="flex-1 ml-4">
                            <div className="relative w-full">
                                {/* Search input */}
                                <input
                                    type="text"
                                    placeholder="Search posts..."
                                    value={searchTerm}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onFocus={() => setIsSearchActive(true)}
                                    onBlur={() => setTimeout(() => setIsSearchActive(false), 150)}
                                    className="w-full bg-gray-800 text-gray-200 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-300"
                                />

                                {/* Category buttons (shown only when search active) */}
                                <AnimatePresence>
                                    {isSearchActive && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute left-0 right-0 mt-2 flex overflow-x-auto no-scrollbar gap-2 px-2 py-1 bg-black/90 rounded-lg border border-gray-800 z-20"
                                        >
                                            {categories.map((cat) => (
                                                <button
                                                    key={cat}
                                                    onClick={() => {
                                                        handleCategoryChange(cat)
                                                        setIsSearchActive(false)
                                                    }}
                                                    className={`flex-shrink-0 px-4 py-1 rounded-full text-sm border transition-all duration-200 ${activeCategory === cat
                                                        ? 'bg-blue-600 text-white'
                                                        : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                                                        }`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                )}


            </motion.header>
        </>
    )
}
