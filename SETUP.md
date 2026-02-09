# Mausam Master Dashboard - Complete Setup Guide

## 🚀 Quick Deploy Status

| Service | Status | URL |
|---------|--------|-----|
| **GitHub Repo** | ✅ Ready | https://github.com/mclawd-lgtm/mausam-master-dashboard |
| **Netlify Site** | ✅ Deployed | https://gilded-gingersnap-8b9306.netlify.app |
| **Supabase** | ⏳ Needs Config | Pending URL setup |

---

## 📋 Prerequisites

1. **Supabase Account** - Sign up at https://supabase.com
2. **GitHub Token** - Already configured ✅
3. **Netlify Token** - Already configured ✅

---

## 🔧 Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click **"New Project"**
3. Fill in:
   - **Name:** `mausam-master-dashboard`
   - **Database Password:** (Generate strong password)
   - **Region:** Mumbai (India) or closest to you
4. Click **"Create new project"**
5. Wait ~2 minutes for project to initialize

---

## 🔑 Step 2: Get Supabase Credentials

1. In your Supabase dashboard, go to **Project Settings > API**
2. Copy these values:
   - **URL:** `https://xxxxxx.supabase.co`
   - **anon public:** `eyJhbGciOiJIUzI1NiIs...`

---

## 🗄️ Step 3: Run Database Migrations

1. In Supabase dashboard, go to **SQL Editor > New query**
2. Copy the entire contents of:
   ```
   /workspace/mausam-master-dashboard/supabase/migrations/001_initial_schema.sql
   ```
3. Paste into SQL Editor
4. Click **"Run"**
5. Verify all tables created successfully

---

## ⚙️ Step 4: Configure Environment Variables

### Local Development (.env file)

```bash
cd mausam-master-dashboard
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Netlify Production

Already configured ✅
- `VITE_SUPABASE_URL` - Set via Netlify CLI
- `VITE_SUPABASE_ANON_KEY` - Set via Netlify CLI

**To update:**
```bash
cd mausam-master-dashboard
export NETLIFY_AUTH_TOKEN="nfp_sGp7h12xdpHy617KpoZehkB2heRHgHu68aa8"
netlify env:set VITE_SUPABASE_URL "https://your-new-url.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "your-new-key"
```

---

## 🔐 Step 5: Configure Authentication

1. In Supabase dashboard, go to **Authentication > Providers**
2. Enable **Email** provider:
   - ✅ Enable Email Signup
   - ✅ Enable Email confirmations (optional)
   - ✅ Enable Custom SMTP (recommended for production)

3. Configure **Site URL**:
   - Go to **Authentication > URL Configuration**
   - **Site URL:** `https://gilded-gingersnap-8b9306.netlify.app`
   - **Redirect URLs:** Add `https://gilded-gingersnap-8b9306.netlify.app/**`

---

## 🧪 Step 6: Test Locally

```bash
cd mausam-master-dashboard
npm install
npm run dev
```

Test checklist:
- [ ] Open http://localhost:5173
- [ ] Sign up with email
- [ ] Check confirmation email
- [ ] Log in
- [ ] Add a habit
- [ ] Toggle habit completion
- [ ] Verify data persists after refresh

---

## 🚀 Step 7: Deploy to Production

```bash
cd mausam-master-dashboard
export NETLIFY_AUTH_TOKEN="nfp_sGp7h12xdpHy617KpoZehkB2heRHgHu68aa8"

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

Or push to GitHub for auto-deploy:
```bash
git add -A
git commit -m "Add Supabase integration"
git push origin main
```

---

## 📊 Database Schema Overview

### Tables

| Table | Purpose |
|-------|---------|
| `habits` | User habit definitions |
| `habit_entries` | Daily habit tracking data |
| `gold_rates` | Cached gold/silver prices |
| `user_tasks` | Task management |
| `user_settings` | User preferences |
| `sync_log` | Debug sync operations |

### Security (RLS)

- ✅ Users can only access their own data
- ✅ Gold rates are public read
- ✅ Authenticated writes only
- ✅ Row Level Security enabled on all tables

---

## 🔧 Troubleshooting

### Auth not working
- Check Site URL in Supabase Auth settings
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Check browser console for CORS errors

### Database errors
- Verify migrations ran successfully
- Check RLS policies are enabled
- Confirm user is authenticated before writing

### Sync issues
- Check `sync_log` table for errors
- Verify network connectivity to Supabase
- Check browser console for fetch errors

---

## 📁 Project Structure

```
mausam-master-dashboard/
├── .env                    # Local environment variables
├── .env.example            # Template for env vars
├── src/
│   ├── lib/
│   │   └── supabase.ts     # Supabase client config
│   ├── hooks/
│   │   └── useSync.ts      # Sync logic
│   └── modules/
│       └── health/         # Health tracking module
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
└── netlify.toml            # Netlify config
```

---

## 🔄 CI/CD Pipeline

### GitHub → Netlify Auto-Deploy

1. Push to `main` branch
2. GitHub Actions runs tests (if configured)
3. Netlify auto-builds and deploys
4. Environment variables injected from Netlify dashboard

### Manual Deploy

```bash
npm run build
netlify deploy --prod --dir=dist
```

---

## 🔒 Security Checklist

- [x] Supabase Row Level Security enabled
- [x] Environment variables not in GitHub
- [x] Credentials stored in `.credentials` file (600 permissions)
- [ ] Enable 2FA on Supabase account
- [ ] Enable 2FA on GitHub account
- [ ] Enable 2FA on Netlify account
- [ ] Regularly rotate API keys

---

## 📞 Support

- **Supabase Docs:** https://supabase.com/docs
- **Netlify Docs:** https://docs.netlify.com
- **GitHub Issues:** Create issue in repo

---

## ✅ Post-Deploy Verification

1. Visit https://gilded-gingersnap-8b9306.netlify.app
2. Sign up with test email
3. Verify email confirmation works
4. Add test habit
5. Toggle completion
6. Log out and back in
7. Verify data persisted
8. Check Supabase dashboard for data

**All green? You're live! 🎉**
