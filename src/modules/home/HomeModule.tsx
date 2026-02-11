export function HomeModule() {
  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-[#1f6feb]/20 to-transparent border border-[#30363d] rounded-xl p-6">
        <h1 className="text-2xl font-bold text-[#c9d1d9]">Welcome back, Mausam! 👋</h1>
        <p className="text-[#8b949e] mt-1">Here's your personal overview for today.</p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#c9d1d9]">Dashboard</h2>
        <span className="text-sm text-[#8b949e]">Your daily progress</span>
      </div>

      {/* Quick Stats Row - Personal Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-sm text-[#8b949e] mb-1">Current Streak</div>
          <div className="text-xl font-bold text-[#c9d1d9]">12 days</div>
          <div className="text-xs text-green-400">🔥 Keep it up!</div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-sm text-[#8b949e] mb-1">Habits Today</div>
          <div className="text-xl font-bold text-[#c9d1d9]">5/8</div>
          <div className="text-xs text-[#58a6ff]">62% complete</div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-sm text-[#8b949e] mb-1">Weekly Rate</div>
          <div className="text-xl font-bold text-[#c9d1d9]">78%</div>
          <div className="text-xs text-green-400">↑ 5% vs last week</div>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-sm text-[#8b949e] mb-1">Monthly Progress</div>
          <div className="text-xl font-bold text-[#c9d1d9]">68%</div>
          <div className="text-xs text-[#6e7681]">On track 🎯</div>
        </div>
      </div>
    </div>
  );
}
