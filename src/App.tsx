import { useState, useEffect, useCallback } from 'react';
import './index.css';
import { HealthModule } from './modules/health/HealthModule';
import { useAuth } from './contexts/AuthContext';
import { runMigrations } from './lib/migrations';

// Legacy storage keys for data migration
const OLD_STORAGE_KEYS = [
  'masterMausam.health.habits.v1',
  'masterMausam.health.order.v1',
  'masterMausam.health.fastingHours.v1',
  'masterMausam.health.lastFastingHours.v1',
  'habit-tracker-v5',
];

type Tab = 'home' | 'health' | 'data' | 'settings';

function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="#238636" />
      <path d="M10 10h4v12h-4z" fill="#fff" />
      <path d="M18 10h4v12h-4z" fill="#fff" opacity="0.7" />
      <circle cx="12" cy="22" r="2" fill="#fff" />
      <circle cx="20" cy="22" r="2" fill="#fff" opacity="0.7" />
    </svg>
  );
}

function Favicon() {
  useEffect(() => {
    const svg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="6" fill="%23238636"/><path d="M10 10h4v12h-4z" fill="%23fff"/><path d="M18 10h4v12h-4z" fill="%23fff" opacity="0.7"/><circle cx="12" cy="22" r="2" fill="%23fff"/><circle cx="20" cy="22" r="2" fill="%23fff" opacity="0.7"/></svg>`;
    
    let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = svg;
    
    document.title = 'Master Mausam';
  }, []);
  
  return null;
}

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium transition-all ${
        active 
          ? 'text-[#c9d1d9]' 
          : 'text-[#8b949e] hover:text-[#c9d1d9]'
      }`}
    >
      {active && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#58a6ff] rounded-full" />
      )}
      {children}
    </button>
  );
}

function PlaceholderCard({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-xl font-semibold text-[#c9d1d9] mb-2">{title}</h2>
      <p className="text-[#8b949e]">Coming soon</p>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('health');
  const { isLoading: authLoading } = useAuth();
  const [migrationsRun, setMigrationsRun] = useState(false);

  // Run migrations on mount
  useEffect(() => {
    runMigrations().then((result) => {
      if (result.applied > 0) {
        console.log(`[Migrations] Applied ${result.applied} migration(s)`);
      }
      if (result.errors.length > 0) {
        console.error('[Migrations] Errors:', result.errors);
      }
    }).finally(() => {
      setMigrationsRun(true);
    });
    // Force render after 2s even if migrations hang
    setTimeout(() => setMigrationsRun(true), 2000);
  }, []);

  const clearLegacyData = useCallback(() => {
    if (confirm('This will clear all legacy data from old storage. Continue?')) {
      OLD_STORAGE_KEYS.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      alert('Legacy data cleared');
    }
  }, []);

  // Show loading state
  if (authLoading || !migrationsRun) {
    return (
      <>
        <Favicon />
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1117]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#58a6ff]" />
        </div>
      </>
    );
  }

  // Always show app (no login)
  return (
    <>
      <Favicon />
      <div className="min-h-screen bg-[#0d1117]">
        {/* Top Bar */}
        <header className="sticky top-0 z-50 bg-[#161b22] border-b border-[#30363d]">
          <div className="max-w-6xl mx-auto px-4">
            {/* Logo + Title */}
            <div className="flex items-center gap-3">
              <Logo size={28} />
              <span className="font-semibold text-[#c9d1d9]">Master Mausam</span>
            </div>
            
            {/* Tab Strip */}
            <div className="flex gap-1 -mb-px">
              <TabButton active={activeTab === 'home'} onClick={() => setActiveTab('home')}>
                Home
              </TabButton>
              <TabButton active={activeTab === 'health'} onClick={() => setActiveTab('health')}>
                Health
              </TabButton>
              <TabButton active={activeTab === 'data'} onClick={() => setActiveTab('data')}>
                Data
              </TabButton>
              <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
                Settings
              </TabButton>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 py-6">
          {activeTab === 'home' && <PlaceholderCard title="Home" icon="🏠" />}
          {activeTab === 'health' && <HealthModule />}
          {activeTab === 'data' && <PlaceholderCard title="Data" icon="📊" />}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#c9d1d9]">Settings</h2>
              
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                <h3 className="text-sm font-medium text-[#8b949e] mb-3">Data Management</h3>
                <button
                  onClick={clearLegacyData}
                  className="px-4 py-2 bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/30 rounded-lg text-sm hover:bg-[#f85149]/20 transition-colors"
                >
                  Clear Legacy Data
                </button>
                <p className="text-xs text-[#6e7681] mt-2">
                  Remove old localStorage data from previous versions
                </p>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                <h3 className="text-sm font-medium text-[#8b949e] mb-3">Account</h3>
                <div className="text-sm text-[#c9d1d9]">
                  <p>Guest User</p>
                  <p className="text-xs text-[#6e7681] mt-1">Local mode - no login required</p>
                </div>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
                <h3 className="text-sm font-medium text-[#8b949e] mb-3">Sync</h3>
                <p className="text-sm text-[#c9d1d9]">
                  Data automatically syncs between devices when online.
                </p>
                <p className="text-xs text-[#6e7681] mt-2">
                  Changes are saved locally first, then synced to the server.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default App;
