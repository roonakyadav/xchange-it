'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

export default function NavDesktop() {
    const pathname = usePathname()

    const navItems = [
        { href: '/feed', label: 'Feed' },
        { href: '/post/new', label: 'New Post' },
        { href: '/chats', label: 'Chats' },
        { href: '/profile', label: 'Profile' },
    ]

    const isActive = (href: string) => {
        if (href === '/feed') {
            return pathname === '/feed'
        }
        return pathname.startsWith(href)
    }

    return (
        <motion.nav
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="sticky top-0 z-40 hidden md:flex items-center justify-between px-4 h-14 border-b border-white/10 bg-black/80 backdrop-blur"
        >
            <Link
                href="/feed"
                className="text-white text-lg font-bold tracking-wide hover:text-red-500 transition-colors"
                aria-label="Feed"
            >
                Xchange
            </Link>

            <div className="flex items-center space-x-1">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`px-3 py-1.5 rounded-2xl transition ${isActive(item.href)
                            ? 'bg-red-600 text-white'
                            : 'hover:bg-white/10'
                            }`}
                        aria-current={isActive(item.href) ? 'page' : undefined}
                        aria-label={item.label}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </motion.nav>
    )
}
