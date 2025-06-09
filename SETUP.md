# Pure Golf App - Setup Guide

This guide will help you set up the Pure golf swing analysis platform for development.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   Create a `.env.local` file in the project root with the following variables:

   ```bash
   # Supabase Configuration
   PUBLIC_SUPABASE_URL=your_supabase_project_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # OpenAI API
   OPENAI_API_KEY=your_openai_api_key

   # Cloudflare R2 Storage
   R2_ACCESS_KEY=your_r2_access_key  
   R2_SECRET_KEY=your_r2_secret_key

   # JWT Secret (generate a random string)
   JWT_SECRET=your_jwt_secret_key
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open Your Browser**
   Navigate to `http://localhost:5173`

## Setting Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your Supabase dashboard:
   - Go to Settings → API to get your URL and anon key
   - Go to Settings → Database to set up your tables

3. **Create Database Tables**
   
   Run these SQL commands in your Supabase SQL editor:

   ```sql
   -- Users table
   CREATE TABLE users (
     id UUID PRIMARY KEY DEFAULT auth.uid(),
     email TEXT UNIQUE NOT NULL,
     name TEXT,
     handicap NUMERIC,
     goals JSONB,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Swings table  
   CREATE TABLE swings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     category TEXT NOT NULL CHECK (category IN ('wood', 'iron', 'wedge', 'chip', 'putt')),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     video_urls JSONB,
     ai_pose JSONB,
     ai_flaws JSONB,
     ai_summary TEXT
   );

   -- Drills table
   CREATE TABLE drills (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     title TEXT NOT NULL,
     description TEXT NOT NULL,
     tags TEXT[] DEFAULT '{}',
     demo_url TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Practice logs table
   CREATE TABLE practice_logs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
     completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     notes TEXT
   );

   -- Enable Row Level Security
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE swings ENABLE ROW LEVEL SECURITY;
   ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
   ALTER TABLE practice_logs ENABLE ROW LEVEL SECURITY;

   -- Create policies
   CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
   CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
   CREATE POLICY "Users can view own swings" ON swings FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own swings" ON swings FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "All users can view drills" ON drills FOR SELECT TO authenticated;
   CREATE POLICY "Users can view own practice logs" ON practice_logs FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own practice logs" ON practice_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
   ```

4. **Set up Authentication**
   - In Supabase Dashboard → Authentication → Settings
   - Configure your site URL: `http://localhost:5173`
   - Enable email authentication
   - Optional: Enable OAuth providers (Google, Apple)

## Project Structure

```
src/
├── routes/                 # SvelteKit pages
│   ├── +page.svelte       # Homepage
│   ├── +layout.svelte     # Main layout
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # User dashboard
│   └── swing/             # Swing recording/analysis
├── services/              # Business logic
│   └── auth.ts           # Authentication service
├── components/            # Reusable UI components
├── lib/                  # Utilities and configurations
│   └── supabase.ts      # Supabase client setup
└── app.css              # Global styles
```

## Development Guidelines

This project follows strict governance guidelines (see `planningdoc.md`):

- **File Size Limits**: Components max 200 LOC, Services max 300 LOC
- **No `any` types**: Use proper TypeScript types
- **Consistent formatting**: Use Prettier (will be added)
- **Security first**: All auth routes protected, RLS enabled

## Next Steps

1. **Set up your environment variables** (most important!)
2. **Create your Supabase project and tables**
3. **Test the authentication flow**
4. **Start building the swing recording workflow**

## Troubleshooting

- **Build errors**: Make sure all environment variables are set
- **Auth issues**: Check your Supabase URL and keys
- **TypeScript errors**: Ensure all dependencies are installed
- **Styling issues**: Restart the dev server after CSS changes

## Features Implemented

✅ Homepage with hero section and features  
✅ Authentication (login/signup with email + OAuth)  
✅ Dashboard with swing categories  
✅ Responsive design with Tailwind CSS  
✅ TypeScript types for database schemas  
✅ Supabase integration ready  

## Features Coming Next

🔄 Swing recording workflow (3-angle video capture)  
🔄 AI integration for pose analysis  
🔄 Chat interface with Coach Sarah  
🔄 Drill library and recommendations  
🔄 Progress tracking and analytics  

---

**Need help?** Check the planning document (`planningdoc.md`) for complete technical specifications. 