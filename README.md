# Health Dashboard

A minimalist health tracking dashboard with GitHub-style habit visualization.

## Features

- **Today Check-in**: 8 configurable daily health questions
- **Fasting Grid**: GitHub-style 365-day habit visualization with streak tracking
- **Whoop Integration**: Placeholder section for sleep, HRV, recovery metrics
- **Data Portability**: Export/import JSON for backup and migration
- **Dark Mode**: Toggle between light and dark themes
- **Dual Views**:
  - `/` - Interactive dashboard (edit mode)
  - `/morning` - Read-only view (clean screenshot mode)

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS
- React Router
- LocalStorage for data persistence

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:5173

### Build for Production

```bash
npm run build
```

## Deploy to Netlify

### Option 1: Netlify CLI (Recommended)

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Login to Netlify:
```bash
netlify login
```

3. Deploy:
```bash
netlify deploy --prod
```

Build settings are pre-configured in `netlify.toml`:
- Build command: `npm run build`
- Publish directory: `dist`

### Option 2: Git-based Deployment

1. Push code to GitHub/GitLab
2. Connect repository in Netlify dashboard
3. Build settings will be auto-detected from `netlify.toml`

## Configuration

### Edit Questions

Modify `src/config/questions.json` to customize check-in questions:

```json
{
  "questions": [
    {
      "id": "fasted",
      "label": "Fasted",
      "type": "boolean"
    },
    {
      "id": "sleep",
      "label": "Sleep Quality",
      "type": "scale",
      "min": 1,
      "max": 5
    }
  ]
}
```

Question types:
- `boolean` - Yes/No toggle
- `scale` - Number range (specify min/max)
- `number` - Free number input

## How Streaks Work

- **Current Streak**: Consecutive days of fasting, counting backwards from today (or yesterday if not yet logged today)
- **Longest Streak**: Maximum consecutive fasting days in your history
- **Grid Colors**:
  - Gray: No data
  - Dark Gray: Not fasted
  - Green: Fasted

## Whoop Integration (Future)

The Whoop section currently shows mock data. To integrate real Whoop API:

1. Create a Netlify Function at `netlify/functions/whoop-proxy.ts`
2. Store Whoop API credentials in Netlify Environment Variables
3. Update `src/services/whoop.ts` to call the Netlify Function instead of mock data

Example Netlify Function structure:
```typescript
export const handler = async () => {
  const response = await fetch('https://api.whoop.com/...', {
    headers: { Authorization: `Bearer ${process.env.WHOOP_TOKEN}` }
  });
  const data = await response.json();
  return { statusCode: 200, body: JSON.stringify(data) };
};
```

## Data Portability

- **Export**: Downloads all entries as JSON file
- **Import**: Upload JSON file to merge with existing data (matched by date, overwrites on conflict)

## Screenshots with Playwright

To capture a screenshot of the morning view:

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Start dev server in one terminal
npm run dev

# Run screenshot script in another terminal
npx playwright test tests/screenshot.spec.ts
```

Screenshot saved to: `./screenshots/today.png`

## Project Structure

```
health-dashboard/
├── src/
│   ├── components/      # React components
│   ├── config/          # Configuration files
│   ├── services/        # Data services (storage, Whoop)
│   ├── utils/           # Utility functions
│   ├── types.ts         # TypeScript types
│   ├── App.tsx          # Main app with routing
│   └── main.tsx         # Entry point
├── tests/               # Playwright tests
├── screenshots/         # Screenshot output
├── netlify.toml         # Netlify configuration
└── README.md
```

## Keyboard Shortcuts

None currently. Future: Add keyboard shortcuts for quick navigation.

## License

MIT