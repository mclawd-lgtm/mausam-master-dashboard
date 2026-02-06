# Master Mausam

A multi-tab personal dashboard with Supabase authentication, offline-first sync, and drag-and-drop habit tracking.

## Features

### 🔐 Authentication
- **Email Magic Links** - Secure, passwordless authentication via Supabase Auth
- **Persistent Sessions** - Stay logged in across browser restarts
- **Row Level Security** - Your data is protected at the database level

### 🏠 App Structure
- **Chrome-like Tabs**: Home, Health, Data, Settings
- **Logo**: Minimal "MM" monogram in top-left
- **Tab Switching**: Instant, no page reload

### 💪 Health Module
- **3 columns** on large screens (lg)
- **2 columns** on medium (md)
- **1 column** on mobile
- **Drag & drop** reorder with persistence
- **Instant stats**: Weekly/Monthly/Yearly per habit
- **Offline-first**: Works without internet, syncs when reconnected

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **Auth & Backend**: Supabase (Auth + PostgreSQL)
- **Offline Storage**: IndexedDB via `idb` package
- **Drag & Drop**: @dnd-kit
- **Icons**: Lucide React

## Setup

### 1. Clone and Install

```bash
git clone <your-repo>
cd health-dashboard
npm install
```

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once the project is ready, go to **Project Settings > API**
3. Copy the **URL** and **anon public** key
4. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
5. Fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
   ```

### 3. Database Setup

Run the SQL migrations in your Supabase SQL Editor:

1. Go to **SQL Editor > New query**
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the query

This creates:
- `habits` table - Stores habit definitions
- `habit_entries` table - Stores daily completions
- `settings` table - Stores user preferences
- Row Level Security policies - Users can only access their own data

### 4. Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Production Build

```bash
npm run build
```

Output goes to `dist/` folder.

## Deploy to Netlify

### Environment Variables

In your Netlify dashboard:
1. Go to **Site settings > Build & deploy > Environment**
2. Add the following variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Deploy Settings

```
Build command: npm run build
Publish directory: dist
```

### Deploy

```bash
npx netlify deploy --prod --dir=dist
```

Or connect your GitHub repo for automatic deploys.

## Offline-First Architecture

### How It Works

1. **Local-First Writes**: All changes are saved immediately to IndexedDB
2. **Background Sync**: Changes are queued and synced to Supabase when online
3. **Conflict Resolution**: Last-write-wins based on `updated_at` timestamp
4. **Automatic Recovery**: If sync fails, changes stay queued and retry automatically

### Data Flow

```
User Action
    ↓
IndexedDB (instant, always works)
    ↓
Sync Queue (background)
    ↓
Supabase (when online)
    ↓
Other Devices (pull on next load)
```

### Offline Behavior

- ✅ Add/edit/delete habits
- ✅ Toggle habit entries
- ✅ Reorder habits
- ✅ View all data
- ⏳ Changes sync automatically when back online

### Manual Sync

Click the refresh icon in the Health module header to trigger a manual sync.

## Data Model

### Habit
```typescript
{
  id: string;           // UUID
  user_id: string;      // Supabase auth user ID
  name: string;
  icon: string;         // Emoji
  color: string;        // Hex color
  order_index: number;  // For drag-drop ordering
  is_two_step: boolean; // Half-completions supported
  created_at: string;
  updated_at: string;
  schema_version: number; // For migrations
}
```

### HabitEntry
```typescript
{
  id: string;           // user_id:habit_id:date
  user_id: string;
  habit_id: string;
  date: string;         // YYYY-MM-DD
  value: number;        // 0, 1, or 2
  fasting_hours?: number; // For fasting habit
  note?: string;
  updated_at: string;
}
```

### Settings
```typescript
{
  user_id: string;
  ui_prefs: object;     // JSONB
  last_sync_at: string; // ISO timestamp
}
```

## Migration System

The app includes an automated migration system:

- Migrations run on app startup
- Automatic backup before migrations
- Rollback support if migration fails
- Migration log stored in localStorage

### Creating New Migrations

Add to `src/lib/migrations.ts`:

```typescript
const migrations: Migration[] = [
  // ... existing migrations
  {
    version: 2,
    name: 'add_reminder_field',
    up: async () => {
      // Migration logic here
    },
  },
];
```

## Security

- **Row Level Security (RLS)** enabled on all tables
- Users can only CRUD their own data
- `user_id` is automatically set based on authenticated user
- No server-side secrets in client code (only anon key)

## Troubleshooting

### Auth not working
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly
- Verify Supabase Auth is enabled in your project

### Sync not working
- Check browser console for errors
- Verify you're authenticated
- Check network tab for Supabase API calls

### Data not persisting
- Check that IndexedDB is available (some private browsers disable it)
- Clear site data and re-authenticate

### Migration errors
- Check `localStorage` for migration log: `localStorage.getItem('migration-log')`
- Restore from backup if needed: `migrationUtils.restoreFromBackup()` in console

## Testing Checklist

Before releasing:

- [ ] Refresh doesn't lose data
- [ ] Login on second browser shows same data
- [ ] Toggle habits while offline, syncs when back online
- [ ] Reorder habits persists across sessions
- [ ] Delete habit removes it from all devices
- [ ] Logout and login restores all data

## Module Structure

```
src/
├── App.tsx                    # App shell, tabs, auth gate
├── main.tsx                   # Entry point with AuthProvider
├── index.css                  # Global styles
├── components/
│   └── Auth.tsx              # Login screen + logout button
├── contexts/
│   └── AuthContext.tsx       # Auth state management
├── hooks/
│   └── useSync.ts            # React hooks for sync layer
├── lib/
│   ├── supabase.ts           # Supabase client
│   ├── sync.ts               # IndexedDB + sync logic
│   └── migrations.ts         # Migration runner
└── modules/
    └── health/
        ├── HealthModule.tsx  # Health tab UI
        └── types.ts          # TypeScript types

supabase/
└── migrations/
    └── 001_initial_schema.sql # Database schema
```

## License

MIT
