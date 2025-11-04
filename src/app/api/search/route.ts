import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

interface SearchFilters {
    type?: 'listing' | 'request' | 'all'
    category?: string
    minPrice?: number
    maxPrice?: number
    location?: string
    sortBy?: 'recent' | 'trending' | 'saved'
}

function parseFilters(searchParams: URLSearchParams): SearchFilters {
    const filters: SearchFilters = {}

    const type = searchParams.get('type')
    if (type && ['listing', 'request', 'all'].includes(type)) {
        filters.type = type as 'listing' | 'request' | 'all'
    }

    const category = searchParams.get('category')
    if (category) {
        filters.category = category
    }

    const minPrice = searchParams.get('minPrice')
    if (minPrice && !isNaN(Number(minPrice))) {
        filters.minPrice = Number(minPrice)
    }

    const maxPrice = searchParams.get('maxPrice')
    if (maxPrice && !isNaN(Number(maxPrice))) {
        filters.maxPrice = Number(maxPrice)
    }

    const location = searchParams.get('location')
    if (location) {
        filters.location = location
    }

    const sortBy = searchParams.get('sortBy')
    if (sortBy && ['recent', 'trending', 'saved'].includes(sortBy)) {
        filters.sortBy = sortBy as 'recent' | 'trending' | 'saved'
    }

    return filters
}

function buildSearchQuery(query: string, filters: SearchFilters) {
    const searchTerms = query.trim().split(/\s+/).filter(term => term.length > 0)

    if (searchTerms.length === 0) {
        return null
    }

    // Build full-text search query
    const tsQuery = searchTerms
        .map(term => `${term}:*`) // Prefix matching
        .join(' & ')

    return tsQuery
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const filters = parseFilters(searchParams)
    const supabase = await createServerSupabaseClient()

    try {
        let dbQuery = supabase
            .from('posts')
            .select(`
        *,
        profiles (
          username,
          full_name,
          avatar_url
        )
      `)
            .eq('is_active', true)

        // Apply search query
        if (query.trim()) {
            const tsQuery = buildSearchQuery(query, filters)

            if (tsQuery) {
                // Full-text search on title and description
                dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`)

                // Also search in tags array
                for (const term of query.split(/\s+/)) {
                    if (term.length > 0) {
                        dbQuery = dbQuery.or(`tags.cs.{${term}}`, { referencedTable: 'posts' })
                    }
                }

                // Search in username
                dbQuery = dbQuery.or(`profiles.username.ilike.%${query}%`)
            }
        }

        // Apply filters
        if (filters.type && filters.type !== 'all') {
            dbQuery = dbQuery.eq('type', filters.type)
        }

        if (filters.category) {
            dbQuery = dbQuery.ilike('category', `%${filters.category}%`)
        }

        if (filters.minPrice !== undefined) {
            dbQuery = dbQuery.gte('price', filters.minPrice)
        }

        if (filters.maxPrice !== undefined) {
            dbQuery = dbQuery.lte('price', filters.maxPrice)
        }

        if (filters.location) {
            dbQuery = dbQuery.ilike('location', `%${filters.location}%`)
        }

        // Apply sorting
        switch (filters.sortBy) {
            case 'trending':
                // For trending, we could use a combination of recent activity
                // For now, we'll sort by created_at with some randomness
                dbQuery = dbQuery.order('created_at', { ascending: false })
                break
            case 'saved':
                // This would require a join with wishlist table
                // For now, we'll sort by created_at
                dbQuery = dbQuery.order('created_at', { ascending: false })
                break
            case 'recent':
            default:
                dbQuery = dbQuery.order('created_at', { ascending: false })
                break
        }

        // Apply cursor pagination
        if (cursor) {
            dbQuery = dbQuery.lt('created_at', cursor)
        }

        // Apply limit
        dbQuery = dbQuery.limit(limit)

        const { data: posts, error } = await dbQuery

        if (error) {
            console.error('Search error:', error)
            return NextResponse.json({ error: 'Search failed' }, { status: 500 })
        }

        // Get next cursor
        const nextCursor = posts && posts.length === limit
            ? posts[posts.length - 1].created_at
            : null

        // Calculate relevance scores and highlight matches
        const processedPosts = posts?.map(post => {
            let relevanceScore = 0
            const highlights: Record<string, string[]> = {}

            if (query.trim()) {
                const lowerQuery = query.toLowerCase()

                // Title matches (highest weight)
                if (post.title?.toLowerCase().includes(lowerQuery)) {
                    relevanceScore += 10
                    highlights.title = [query]
                }

                // Description matches
                if (post.description?.toLowerCase().includes(lowerQuery)) {
                    relevanceScore += 5
                    highlights.description = [query]
                }

                // Tag matches
                const matchingTags = post.tags?.filter((tag: string) =>
                    tag.toLowerCase().includes(lowerQuery)
                ) || []
                if (matchingTags.length > 0) {
                    relevanceScore += 8
                    highlights.tags = matchingTags
                }

                // Username matches
                if (post.profiles?.username?.toLowerCase().includes(lowerQuery)) {
                    relevanceScore += 7
                    highlights.username = [post.profiles.username]
                }
            }

            return {
                ...post,
                relevance_score: relevanceScore,
                highlights
            }
        }) || []

        // Sort by relevance if searching
        if (query.trim()) {
            processedPosts.sort((a, b) => b.relevance_score - a.relevance_score)
        }

        return NextResponse.json({
            posts: processedPosts,
            nextCursor,
            hasMore: !!nextCursor,
            total: processedPosts.length
        })

    } catch (error) {
        console.error('Unexpected search error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
