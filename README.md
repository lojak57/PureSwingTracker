# Pure - Golf Swing Analysis Platform

> **Mobile-first AI golf coach for swing improvement and drill recommendations**

## 🎯 MVP Status (Week 2-3 Complete)

**Current Implementation:** Production-ready backend with working video capture, cloud storage, and AI chat interface.

### ✅ **Completed Features**

#### **Core Platform (Week 1-2)**
- ✅ **Authentication System**: Email/password + OAuth with Supabase
- ✅ **Database Schema**: Complete with RLS policies and seed data
- ✅ **Video Recording**: Three-angle capture (down-line, face-on, overhead)
- ✅ **Cloud Storage**: Real Cloudflare R2 integration with presigned URLs
- ✅ **Upload Pipeline**: Progress tracking, validation, error handling

#### **API Backend (Week 2-3)**
- ✅ **Swing Management**: Submit, retrieve, list swings with pagination
- ✅ **Drill Library**: Searchable catalog with tags and categories
- ✅ **Practice Tracking**: Log drill completions with notes
- ✅ **AI Chat Interface**: GPT-4o powered Coach Sarah persona
- ✅ **Real-time Status**: Processing state tracking and updates

#### **Enterprise Governance**
- ✅ **Code Quality**: Conventional commits, ESLint, TypeScript strict mode
- ✅ **PR Automation**: DangerJS, commitlint, CODEOWNERS routing
- ✅ **File Size Limits**: Components <150 LOC, services <300 LOC
- ✅ **Security**: JWT auth, CORS, rate limiting, input validation

---

## 🏗️ Architecture

### **Tech Stack**
```
Frontend:  SvelteKit + TypeScript + Tailwind CSS
Auth:      Supabase Auth (email + OAuth)
Database:  PostgreSQL (Supabase) with RLS
Storage:   Cloudflare R2 (S3-compatible)
AI:        OpenAI GPT-4o (Coach Sarah persona)
Hosting:   Vercel (frontend) + Supabase (backend)
```

### **API Endpoints**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/swing/presign` | Generate upload URLs |
| POST | `/api/swing/submit` | Submit swing data |
| GET | `/api/swing/[id]` | Get swing details |
| GET | `/api/swing/list` | List user swings |
| GET | `/api/drills` | Get drill catalog |
| GET/POST | `/api/practice` | Practice log management |
| GET/POST | `/api/chat/[swing_id]` | AI coaching chat |

---

## 🚀 Setup Instructions

### **Prerequisites**
- Node.js 18+ and pnpm
- Supabase account and project
- Cloudflare R2 bucket
- OpenAI API account

### **1. Environment Setup**
Create `.env.local` with required credentials:

```env
# Supabase
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudflare R2
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
CLOUDFLARE_ACCOUNT_ID=your_account_id

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### **2. Database Setup**
Run the complete database setup script in your Supabase SQL editor:

```bash
# The file supabase-setup.sql contains:
# - All table definitions with proper relationships
# - Row Level Security policies for data protection
# - Performance indexes
# - Sample drill data for testing
```

### **3. Install and Run**
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

### **4. Required Service Configuration**

#### **Cloudflare R2 Setup**
1. Create R2 bucket in Cloudflare dashboard
2. Generate R2 API tokens with read/write permissions
3. Configure CORS policy for browser uploads

#### **Supabase Configuration**
1. Enable email authentication
2. Configure OAuth providers (optional)
3. Run database setup script
4. Set up RLS policies (included in setup script)

#### **OpenAI Setup**
1. Create OpenAI account and get API key
2. Ensure GPT-4o model access
3. Monitor usage for cost control

---

## 📱 User Flow

### **Recording a Swing**
1. **Select Category**: Woods, Irons, Wedges, Chipping, Putting
2. **Three-Angle Capture**: Setup → Record → Review workflow
3. **Upload & Submit**: Progress tracking with real-time feedback
4. **AI Analysis**: Coach Sarah provides personalized feedback

### **Getting Feedback**
1. **Chat Interface**: Ask questions about your swing
2. **Coach Sarah**: AI persona with 15+ years teaching experience
3. **Drill Recommendations**: Tailored practice suggestions
4. **Progress Tracking**: Log practice sessions and improvements

---

## 🛠️ Development Guidelines

### **File Structure Standards**
```
src/routes/+page.svelte           # <200 LOC (import components)
src/components/ui/*               # <150 LOC (UI primitives only)
src/services/*                    # <300 LOC (1 service = 1 domain)
src/routes/api/*/+server.ts       # RESTful endpoints
```

### **Code Quality**
- **TypeScript**: Strict mode, no `any` types
- **Conventional Commits**: `feat:`, `fix:`, `chore:` enforced
- **Testing**: 80% coverage requirement
- **Security**: ESLint security plugin, no secrets in code

### **PR Requirements**
- ✅ All tests passing (`pnpm test`)
- ✅ No linter errors (`pnpm lint`)
- ✅ Type checking clean (`pnpm check`)
- ✅ DangerJS checks pass (no TODOs, proper ADR links)

---

## 📈 Next Steps (Week 4-5)

### **Immediate Priorities**
1. **Swing Analysis UI**: Display AI feedback and scores
2. **Dashboard Enhancement**: Swing history and statistics
3. **Drill Detail Pages**: Video demos and instructions
4. **User Profile**: Handicap tracking and goals

### **Week 4 Focus**
- Polish existing UI components
- Add loading states and error boundaries
- Implement drill recommendation display
- Basic progress tracking dashboard

### **Week 5 Beta Prep**
- Mobile responsiveness testing
- Performance optimization
- Beta user onboarding flow
- Real user testing with exec golfers

---

## 💰 Operating Costs (Current MVP)

| Service | Monthly Cost |
|---------|--------------|
| Cloudflare R2 (500GB) | $7.50 |
| Supabase Pro | $25.00 |
| OpenAI API (est. 1k swings) | $80.00 |
| Vercel Pro | $20.00 |
| **Total** | **~$133/month** |

*Note: Costs scale with usage. Pose analysis service ($160/month VPS) not yet implemented.*

---

## 🔒 Security & Compliance

- **Authentication**: JWT with 10min access, 7-day refresh tokens
- **Authorization**: Row Level Security on all database tables
- **Data Protection**: User videos auto-purged after 90 days
- **API Security**: Rate limiting, input validation, CORS policies
- **Monitoring**: Request logging, error tracking, performance metrics

---

## 🤝 Contributing

This project follows enterprise-grade development practices:

1. **Fork & Branch**: `feat/your-feature-name`
2. **Conventional Commits**: Required for automatic changelog
3. **Test Coverage**: Maintain >80% coverage
4. **Code Review**: All PRs require approval
5. **ADR Documentation**: Architectural decisions must be documented

See `CONTRIBUTING.md` for detailed guidelines.

---

## 📞 Support

- **Documentation**: `/docs` folder contains ADRs and setup guides
- **Issues**: Use GitHub issues for bug reports and feature requests
- **Development**: Join our development Discord for real-time collaboration

---

*Built with enterprise standards for scale. Ready for beta users and investor demos.*
