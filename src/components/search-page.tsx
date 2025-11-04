'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BottomNav } from '@/components/bottom-nav'
import { PostCard } from '@/components/post-card'
import { toast } from 'sonner'
import {
    Search,
    Filter,
    X,
    TrendingUp,
    Clock,
    Heart,
    ArrowLeft,
    Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Post } from '@/lib/types'

interface SearchFilters {
    type: 'all' | 'listing' | 'request'
    category: string
    minPrice: number
    maxPrice: number
    location: string
    sortBy: 'recent' | 'trending' | 'saved'
}

interface SearchSuggestion {
    type: 'recent' | 'trending'
    text: string
    count?: number
}

const initialFilters: SearchFilters = {
    type: 'all',
    category: '',
    minPrice: 0,
    maxPrice: 10000,
    location: '',
    sortBy: 'recent'
}

const categories = [
    'Electronics', 'Clothing', 'Books', 'Sports', 'Home', 'Automotive',
    'Music', 'Art', 'Tools', 'Games', 'Collectibles', 'Other'
]

export function SearchPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [query, setQuery] = useState(searchParams.get('q') || '')
    const [filters, setFilters] = useState<SearchFilters>(initialFilters)
    const [showFilters, setShowFilters] = useState(false)
    const [recentSearches, setRecentSearches] = useState<string[]>([])
    const [isLoadingMore, setIsLoadingMore] = useState(false)

    const debouncedQuery = useDebounce(query, 300)

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('recentSearches')
        if (saved) {
            try {
                setRecentSearches(JSON.parse(saved))
            } catch (error) {
                console.error('Error parsing recent searches:', error)
            }
        }
    }, [])

    // Save search to recent searches
    const saveRecentSearch = useCallback((searchQuery: string) => {
        if (!searchQuery.trim()) return

        const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10)
        setRecentSearches(updated)
        localStorage.setItem('recentSearches', JSON.stringify(updated))
    }, [recentSearches])

    // Fetch trending searches
    const { data: trendingSearches } = useQuery({
        queryKey: ['trending-searches'],
        queryFn: async () => {
            // In a real app, this would come from analytics/aggregated data
            // For now, return some mock trending searches
            return [
                { text: 'iPhone', count: 1250 },
                { text: 'MacBook', count: 890 },
                { text: 'camera', count: 654 },
                { text: 'guitar', count: 432 },
                { text: 'bicycle', count: 321 }
            ] as SearchSuggestion[]
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // Search posts
    const {
        data: searchData,
        isLoading,
        error,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['search', debouncedQuery, filters],
        queryFn: async ({ pageParam = null }) => {
            const params = new URLSearchParams()

            if (debouncedQuery) params.set('q', debouncedQuery)
            if (filters.type !== 'all') params.set('type', filters.type)
            if (filters.category) params.set('category', filters.category)
            if (filters.minPrice > 0) params.set('minPrice', filters.minPrice.toString())
            if (filters.maxPrice < 10000) params.set('maxPrice', filters.maxPrice.toString())
            if (filters.location) params.set('location', filters.location)
            if (filters.sortBy !== 'recent') params.set('sortBy', filters.sortBy)
            if (pageParam) params.set('cursor', pageParam)

            const response = await fetch(`/api/search?${params}`)
            if (!response.ok) throw new Error('Search failed')

            return response.json()
        },
        enabled: !!debouncedQuery.trim() || Object.values(filters).some(v =>
            v !== initialFilters[Object.keys(filters).find(k => filters[k as keyof SearchFilters] === v) as keyof SearchFilters]
        ),
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: null,
    })

    const posts = useMemo(() => {
        return searchData?.pages?.flatMap(page => page.posts) || []
    }, [searchData])

    const handleSearch = useCallback((searchQuery: string) => {
        setQuery(searchQuery)
        if (searchQuery.trim()) {
            saveRecentSearch(searchQuery.trim())
        }
    }, [saveRecentSearch])

    const clearFilters = useCallback(() => {
        setFilters(initialFilters)
    }, [])

    const hasActiveFilters = useMemo(() => {
        return Object.entries(filters).some(([key, value]) => {
            return value !== initialFilters[key as keyof SearchFilters]
        })
    }, [filters])

    const suggestions: SearchSuggestion[] = useMemo(() => {
        const allSuggestions: SearchSuggestion[] = []

        // Recent searches
        recentSearches.forEach(search => {
            allSuggestions.push({ type: 'recent', text: search })
        })

        // Trending searches
        trendingSearches?.forEach(trending => {
            allSuggestions.push({ type: 'trending', text: trending.text, count: trending.count })
        })

        return allSuggestions.slice(0, 8)
    }, [recentSearches, trendingSearches])

    const highlightText = (text: string, highlights: string[]) => {
        if (!highlights.length) return text

        let result = text
        highlights.forEach(highlight => {
            const regex = new RegExp(`(${highlight})`, 'gi')
            result = result.replace(regex, '<mark>$1</mark>')
        })

        return result
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                        <Button
                            variant="ghost"
                            onClick={() => router.back()}
                            className="p-2"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>

                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search posts, users, tags..."
                                className="pl-10 pr-4"
                                autoFocus
                            />
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => setShowFilters(!showFilters)}
                            className={hasActiveFilters ? 'border-primary' : ''}
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="pb-20">
                {/* Filters Panel */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-b border-border bg-muted/30"
                        >
                            <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium">Filters</h3>
                                    {hasActiveFilters && (
                                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                                            Clear all
                                        </Button>
                                    )}
                                </div>

                                {/* Type Filter */}
                                <div>
                                    <label className="text-sm font-medium">Type</label>
                                    <div className="flex space-x-2 mt-2">
                                        {['all', 'listing', 'request'].map((type) => (
                                            <Button
                                                key={type}
                                                variant={filters.type === type ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setFilters(prev => ({ ...prev, type: type as any }))}
                                            >
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Category Filter */}
                                <div>
                                    <label className="text-sm font-medium">Category</label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {categories.map((category) => (
                                            <Badge
                                                key={category}
                                                variant={filters.category === category ? 'default' : 'outline'}
                                                className="cursor-pointer"
                                                onClick={() => setFilters(prev => ({
                                                    ...prev,
                                                    category: prev.category === category ? '' : category
                                                }))}
                                            >
                                                {category}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Price Range */}
                                <div>
                                    <label className="text-sm font-medium">Price Range</label>
                                    <div className="flex space-x-2 mt-2">
                                        <Input
                                            type="number"
                                            placeholder="Min"
                                            value={filters.minPrice || ''}
                                            onChange={(e) => setFilters(prev => ({
                                                ...prev,
                                                minPrice: Number(e.target.value) || 0
                                            }))}
                                            className="w-20"
                                        />
                                        <span className="self-center">-</span>
                                        <Input
                                            type="number"
                                            placeholder="Max"
                                            value={filters.maxPrice || ''}
                                            onChange={(e) => setFilters(prev => ({
                                                ...prev,
                                                maxPrice: Number(e.target.value) || 10000
                                            }))}
                                            className="w-20"
                                        />
                                    </div>
                                </div>

                                {/* Location */}
                                <div>
                                    <label className="text-sm font-medium">Location</label>
                                    <Input
                                        placeholder="City, State"
                                        value={filters.location}
                                        onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                                        className="mt-2"
                                    />
                                </div>

                                {/* Sort By */}
                                <div>
                                    <label className="text-sm font-medium">Sort by</label>
                                    <div className="flex space-x-2 mt-2">
                                        {[
                                            { value: 'recent', label: 'Recent', icon: Clock },
                                            { value: 'trending', label: 'Trending', icon: TrendingUp },
                                            { value: 'saved', label: 'Most Saved', icon: Heart }
                                        ].map(({ value, label, icon: Icon }) => (
                                            <Button
                                                key={value}
                                                variant={filters.sortBy === value ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setFilters(prev => ({ ...prev, sortBy: value as any }))}
                                            >
                                                <Icon className="h-4 w-4 mr-1" />
                                                {label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search Suggestions */}
                {!debouncedQuery && !hasActiveFilters && (
                    <div className="p-4">
                        <h3 className="font-medium mb-4">Explore</h3>

                        {suggestions.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm text-muted-foreground">Suggestions</h4>
                                {suggestions.map((suggestion, index) => (
                                    <button
                                        key={`${suggestion.type}-${index}`}
                                        onClick={() => handleSearch(suggestion.text)}
                                        className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                {suggestion.type === 'trending' ? (
                                                    <TrendingUp className="h-4 w-4 text-orange-500" />
                                                ) : (
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span>{suggestion.text}</span>
                                            </div>
                                            {suggestion.count && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {suggestion.count}
                                                </Badge>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Search Results */}
                {(debouncedQuery || hasActiveFilters) && (
                    <div className="p-4">
                        {isLoading ? (
                            <div className="space-y-4">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Card key={i}>
                                        <CardContent className="p-4">
                                            <div className="flex space-x-3">
                                                <Skeleton className="h-12 w-12 rounded-full" />
                                                <div className="flex-1 space-y-2">
                                                    <Skeleton className="h-4 w-1/4" />
                                                    <Skeleton className="h-4 w-3/4" />
                                                    <Skeleton className="h-20 w-full" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="text-center text-muted-foreground py-12">
                                <p>Search failed. Please try again.</p>
                            </div>
                        ) : posts.length > 0 ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        {posts.length} result{posts.length !== 1 ? 's' : ''} found
                                    </p>
                                    {hasActiveFilters && (
                                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                                            <X className="h-4 w-4 mr-1" />
                                            Clear filters
                                        </Button>
                                    )}
                                </div>

                                <div className="divide-y divide-border">
                                    {posts.map((post: any) => (
                                        <PostCard
                                            key={post.id}
                                            post={post}
                                            highlights={post.highlights}
                                        />
                                    ))}
                                </div>

                                {hasNextPage && (
                                    <div className="text-center pt-4">
                                        <Button
                                            variant="outline"
                                            onClick={() => fetchNextPage()}
                                            disabled={isFetchingNextPage}
                                        >
                                            {isFetchingNextPage ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    Loading...
                                                </>
                                            ) : (
                                                'Load more'
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-12">
                                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-2">No results found</p>
                                <p className="text-sm">Try adjusting your search or filters</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    )
}
