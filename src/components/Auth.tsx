import { useState } from 'react';
import { Mail, Loader2, CheckCircle, LogOut, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Auth() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithOtp, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const { error: signInError } = await signInWithOtp(email.trim());

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
    } else {
      setEmailSent(true);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-8 h-8 text-[#58a6ff] animate-spin" />
      </div>
    );
  }

  if (emailSent) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1117]">
        <div className="w-full max-w-sm px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-[#161b22] border border-[#30363d]">
            <CheckCircle size={32} className="text-[#238636]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#c9d1d9] mb-2">Check your email</h1>
          <p className="text-sm text-[#8b949e] mb-6">
            We sent a magic link to <span className="text-[#c9d1d9]">{email}</span>.<br />
            Click it to sign in.
          </p>
          <button
            onClick={() => {
              setEmailSent(false);
              setEmail('');
            }}
            className="text-sm text-[#58a6ff] hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1117]">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-[#161b22] border border-[#30363d]">
            <Logo size={32} />
          </div>
          <h1 className="text-2xl font-semibold text-[#c9d1d9] mb-1">Master Mausam</h1>
          <p className="text-sm text-[#8b949e]">Sign in with your email</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-[#f85149]/10 border border-[#f85149]/30 rounded-lg text-sm text-[#f85149]">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6e7681]" size={20} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-12 pr-4 py-4 bg-[#161b22] border-2 border-[#30363d] rounded-xl text-[#c9d1d9] placeholder:text-[#484f58] transition-all focus:border-[#58a6ff] focus:outline-none"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={!email.trim() || isSubmitting}
            className="w-full py-3.5 bg-[#238636] text-white rounded-xl font-medium hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Sending link...</span>
              </>
            ) : (
              <span>Send Magic Link</span>
            )}
          </button>

          <p className="text-center text-xs text-[#6e7681] mt-4">
            We'll send you a secure login link.<br />
            No password needed.
          </p>
        </form>
      </div>
    </div>
  );
}

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

export function LogoutButton() {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d] rounded-lg transition-colors"
    >
      {isSigningOut ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <LogOut size={16} />
      )}
      <span className="hidden sm:inline">Sign Out</span>
    </button>
  );
}
