# Xchange - Digital Asset Marketplace

A modern, real-time marketplace for sharing and requesting digital assets built with Next.js 15, Supabase, and PWA capabilities.

## 🚀 Features

- **Real-time Chat**: Instant messaging with typing indicators and read receipts
- **Advanced Search**: Full-text search with filters and highlighting
- **PWA Ready**: Installable with offline capabilities
- **Image Upload**: Optimized image compression and storage
- **User Authentication**: Google OAuth with guest mode
- **Responsive Design**: Mobile-first with dark theme
- **Real-time Updates**: Live notifications and chat updates

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **State Management**: Zustand, TanStack Query
- **Forms**: React Hook Form, Zod validation
- **PWA**: Service Worker, Web App Manifest
- **Deployment**: Vercel

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/xchange.git
   cd xchange
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.local.example .env.local
   ```

   Fill in your environment variables:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # NextAuth (optional, for additional auth providers)
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000

   # Optional: Analytics, monitoring, etc.
   ```

4. **Database & Storage Setup**
   ```bash
   # Run the setup script to create storage bucket
   node setup-supabase.js

   # Then manually create database tables:
   # 1. Go to https://supabase.com/dashboard/project/imveiimfzvhzadbjdxki
   # 2. Navigate to SQL Editor
   # 3. Copy and paste contents of supabase/migrations/20240101000000_initial_schema.sql
   # 4. Run the SQL to create all tables and RLS policies
   ```

5. **Seed Database** (optional)
   ```bash
   # In Supabase SQL Editor, run:
   # Copy and paste contents of supabase/seed.sql
   ```

## 🚀 Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type checking
npm run type-check
```

## 📱 PWA Setup

The app includes full PWA support:

- **Service Worker**: Caches static assets and API responses
- **Web App Manifest**: Defines app metadata and icons
- **Install Prompt**: Prompts users to install the app
- **Offline Support**: Graceful offline fallback

### Icon Generation

Generate PWA icons using a tool like [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator) or [RealFaviconGenerator](https://realfavicongenerator.net/).

Place generated icons in `public/icons/` directory.

## 🚀 Deployment

### Vercel + Supabase

1. **Connect Repository**
   - Import your GitHub repository to Vercel
   - Configure build settings

2. **Environment Variables**
   Set these in Vercel dashboard:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXTAUTH_SECRET
   NEXTAUTH_URL
   ```

3. **Supabase Configuration**
   - Enable Row Level Security (RLS) policies
   - Configure storage buckets
   - Set up authentication providers

4. **Domain Setup**
   - Add custom domain in Vercel
   - Update Supabase site URL
   - Configure CORS settings

### Manual Deployment

```bash
# Build the application
npm run build

# Export for static hosting (optional)
npm run export
```

## 🧪 Testing

```bash
# Run tests
npm test

# E2E testing with Playwright
npm run test:e2e

# Lighthouse PWA audit
npm run lighthouse
```

## 📊 Performance

- **Lighthouse Score**: Target ≥95 for PWA
- **Core Web Vitals**: Optimized for all metrics
- **Bundle Size**: Tree-shaken and optimized
- **Image Optimization**: WebP/AVIF with responsive loading

## 🔒 Security

- **Row Level Security**: All database queries protected
- **Input Validation**: Zod schemas for all forms
- **Rate Limiting**: API endpoints protected
- **HTTPS Only**: Enforced in production
- **CSP Headers**: Content Security Policy configured

## 📈 Monitoring

- **Error Tracking**: Sentry integration ready
- **Analytics**: Vercel Analytics configured
- **Performance**: Real User Monitoring (RUM)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React framework
- [Supabase](https://supabase.com/) - Backend as a Service
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Vercel](https://vercel.com/) - Deployment platform

## 📞 Support

For support, email support@xchange.app or join our Discord community.

---

Built with ❤️ using modern web technologies.
