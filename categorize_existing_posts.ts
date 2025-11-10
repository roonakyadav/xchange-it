import { createClient } from '@supabase/supabase-js'
import { classifyCategory } from './@Integrations/geminiClient'
import { readFileSync } from 'fs'
import { config } from 'dotenv'

// Load environment variables from .env.local
config({ path: '.env.local' })

// Create Supabase client with loaded environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const geminiKey = process.env.GEMINI_API_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseKey)
    process.exit(1)
}

if (!geminiKey) {
    console.error('❌ Missing Gemini API key')
    console.error('GEMINI_API_KEY:', !!geminiKey)
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function categorizeExistingPosts() {
    console.log('🚀 Starting categorization of existing posts...')

    try {
        // Get all posts that need categorization (no category or 'Others')
        const { data: posts, error } = await supabase
            .from('posts')
            .select('id, title, description, category')
            .or('category.is.null,category.eq.Others')

        if (error) {
            console.error('❌ Error fetching posts:', error)
            return
        }

        if (!posts || posts.length === 0) {
            console.log('ℹ️ No posts need categorization')
            return
        }

        console.log(`📋 Found ${posts.length} posts to categorize`)

        let successCount = 0
        let errorCount = 0

        for (const post of posts) {
            try {
                console.log(`🔄 Categorizing post: "${post.title}"`)

                // Classify the post
                const category = await classifyCategory(post.title, post.description || '', geminiKey)

                // Update the post with the new category
                const { error: updateError } = await supabase
                    .from('posts')
                    .update({ category })
                    .eq('id', post.id)

                if (updateError) {
                    console.error(`❌ Failed to update post ${post.id}:`, updateError)
                    errorCount++
                } else {
                    console.log(`✅ Post ${post.id} categorized as: ${category}`)
                    successCount++
                }

                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100))

            } catch (err) {
                console.error(`❌ Error categorizing post ${post.id}:`, err)
                errorCount++
            }
        }

        console.log(`\n🎉 Categorization complete!`)
        console.log(`✅ Successfully categorized: ${successCount} posts`)
        console.log(`❌ Failed to categorize: ${errorCount} posts`)

    } catch (err) {
        console.error('❌ Script failed:', err)
    }
}

// Run the script
categorizeExistingPosts()
    .then(() => {
        console.log('🏁 Script finished')
        process.exit(0)
    })
    .catch((err) => {
        console.error('💥 Script crashed:', err)
        process.exit(1)
    })
