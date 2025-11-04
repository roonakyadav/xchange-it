'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/store'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Home, Search, Plus, MessageCircle, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const navItems = [
    { href: '/feed', label: 'Home', icon: Home },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/create', label: 'Create', icon: Plus },
    { href: '/chat', label: 'Chat', icon: MessageCircle },
    { href: '/settings', label: 'Profile', icon: User },
]

export function BottomNav() {
    const pathname = usePathname()
    const { user } = useAuthStore()

    // Fetch unread message count
    const { data: unreadCount } = useQuery({
        queryKey: ['unread-messages', user?.id],
        queryFn: async () => {
            if (!user) return 0

            const supabase = createBrowserSupabaseClient()

            // Get chats where user is participant
            const { data: chats, error: chatsError } = await supabase
                .from('chats')
                .select('id')
                .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)

            if (chatsError) return 0

            if (!chats || chats.length === 0) return 0

            // Count unread messages in those chats
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .in('chat_id', chats.map(c => c.id))
                .neq('sender_id', user.id)
                .is('read_at', null)

            if (error) return 0
            return count || 0
        },
        enabled: !!user,
        refetchInterval: 30000, // Refetch every 30 seconds
    })

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
            <div className="flex items-center justify-around h-16 px-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href === '/feed' && pathname === '/')
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center justify-center space-y-1 p-2 rounded-lg transition-colors relative',
                                isActive
                                    ? 'text-accent'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <div className="relative">
                                <Icon className="h-5 w-5" />
                                {item.href === '/chat' && unreadCount && unreadCount > 0 && (
                                    <Badge
                                        variant="destructive"
                                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                                    >
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </Badge>
                                )}
                            </div>
                            <span className="text-xs font-medium">{item.label}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
