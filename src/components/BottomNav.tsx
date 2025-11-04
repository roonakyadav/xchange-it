'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
    const pathname = usePathname()

    const navItems = [
        { href: '/feed', label: 'Feed', icon: '🏠' },
        { href: '/post/new', label: 'New Post', icon: '+' },
        { href: '/chats', label: 'Chats', icon: '💬' },
        { href: '/profile', label: 'Profile', icon: '👤' },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-gray-800 md:hidden">
            <div className="flex">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex-1 py-3 px-2 text-center transition-colors ${pathname === item.href
                                ? 'text-red-500'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <div className="text-lg mb-1">{item.icon}</div>
                        <div className="text-xs">{item.label}</div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
