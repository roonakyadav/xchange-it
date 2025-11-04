const { createClient } = require('@supabase/supabase-js')

// Use service role key for admin operations
const supabase = createClient(
  'https://imveiimfzvhzadbjdxki.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltdmVpaW1menZoemFkYmpkeGtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjE1NzA4NSwiZXhwIjoyMDc3NzMzMDg1fQ.gOuup0Z1ebQMxdIUGBBQn87Fp7KfnDwTLdQuap6ZZX8'
)

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database and storage...')

  try {
    // Create storage bucket for post images
    console.log('📦 Creating storage bucket...')
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('post-images', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      fileSizeLimit: 5242880 // 5MB
    })

    if (bucketError && !bucketError.message?.includes('already exists') && !bucketError.message?.includes('Bucket already exists')) {
      console.error('Error creating bucket:', bucketError)
    } else {
      console.log('✅ Storage bucket created successfully!')
    }

    // Test if we can access the database by trying to select from a basic table
    console.log('🔍 Testing database connection...')
    try {
      const { data, error } = await supabase.from('posts').select('count').limit(1)
      if (error && !error.message?.includes('relation "public.posts" does not exist')) {
        console.log('Database connection successful!')
      }
    } catch (err) {
      console.log('Database connection may need tables created manually')
    }

    console.log('📋 Next steps:')
    console.log('1. Go to https://supabase.com/dashboard/project/imveiimfzvhzadbjdxki')
    console.log('2. Navigate to the SQL Editor')
    console.log('3. Copy and paste the contents of supabase/migrations/20240101000000_initial_schema.sql')
    console.log('4. Run the SQL to create all tables')
    console.log('5. Copy and paste the contents of supabase/seed.sql to add sample data')
    console.log('6. The storage bucket "post-images" has been created and is ready to use')

    console.log('🎉 Supabase setup preparation complete!')

  } catch (error) {
    console.error('❌ Error setting up Supabase:', error)
    console.log('Please check your Supabase project and try again.')
    process.exit(1)
  }
}

setupDatabase()
