"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Lock,
  ArrowRight,
  Hexagon,
  Eye,
  EyeOff,
  AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    // Check if already logged in
    const token = api.getToken();
    if (token) {
      api.verifyToken()
        .then(() => router.push(callbackUrl))
        .catch(() => api.clearToken());
    }
  }, [router, callbackUrl]);

  const backgroundGridStyle = {
    backgroundImage: `
      linear-gradient(rgba(124,255,78,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124,255,78,0.035) 1px, transparent 1px)
    `,
    backgroundSize: "48px 48px",
    maskImage:
      "radial-gradient(circle at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 80%)",
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await api.login(formData.email, formData.password);
      router.push(callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSubmitting(true);
    setForgotMessage(null);
    try {
      await api.post<{ sent: boolean }>("/api/auth/forgot-password", { email: forgotEmail });
      setForgotMessage("If that email exists, a reset link has been sent.");
    } catch (err) {
      setForgotMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative bg-[#0b0f14] overflow-hidden perspective-container text-slate-300">

      {/* ================= BACKGROUND EFFECTS ================= */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={backgroundGridStyle} />
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-[#7cff4e]/5 blur-[150px] animate-float" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-blue-600/10 blur-[130px] animate-float-delayed" />
      </div>

      {/* ================= LOGIN CARD ================= */}
      <div className="relative z-10 w-full max-w-sm p-8 bg-[#0f141b]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-fade-in-up delay-0 card-3d-hover">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0b0f14] border border-[#7cff4e]/50 mb-6 shadow-[0_0_25px_rgba(124,255,78,0.15)] relative group">
            <Hexagon className="w-7 h-7 text-[#7cff4e] group-hover:rotate-180 transition-transform duration-700" />
            <div className="absolute inset-0 rounded-full border border-[#7cff4e] animate-ping opacity-20" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Welcome Back</h1>
          <p className="text-xs text-[#94a3b8] uppercase tracking-widest">Identify yourself to proceed</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-fade-in-up">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6">

          {/* Email */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#94a3b8] ml-1 uppercase tracking-wider">Identity Code / Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-4 h-4 text-[#64748b] group-focus-within:text-[#7cff4e] transition-colors" />
              </div>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full bg-[#0b0f14] border border-white/10 text-sm text-white rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-[#7cff4e]/50 focus:ring-1 focus:ring-[#7cff4e]/30 transition-all placeholder:text-slate-700"
                placeholder="agent@analyzehive.com"
                value={formData.email}
                onChange={e => {
                  setFormData({ ...formData, email: e.target.value });
                  setError(null);
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Access Key</label>
              <button
                type="button"
                onClick={() => { setShowForgot((s) => !s); setForgotMessage(null); }}
                className="text-[10px] text-[#7cff4e] hover:underline hover:text-[#4ade80] transition-colors"
              >
                Forgot Key?
              </button>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-[#64748b] group-focus-within:text-[#7cff4e] transition-colors" />
              </div>
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#64748b] hover:text-[#94a3b8] transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="w-full bg-[#0b0f14] border border-white/10 text-sm text-white rounded-xl pl-11 pr-10 py-3.5 focus:outline-none focus:border-[#7cff4e]/50 focus:ring-1 focus:ring-[#7cff4e]/30 transition-all placeholder:text-slate-700 font-mono"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => {
                  setFormData({ ...formData, password: e.target.value });
                  setError(null);
                }}
              />
            </div>
          </div>

          {showForgot && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <p className="text-xs text-[#94a3b8]">Enter your email to receive a reset link.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="agent@analyzehive.com"
                  className="flex-1 bg-[#0b0f14] border border-white/10 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#7cff4e]/50"
                />
                <button
                  type="button"
                  onClick={handleForgotSubmit}
                  disabled={forgotSubmitting || !forgotEmail}
                  className="px-3 py-2 rounded-lg bg-[#7cff4e] text-[#0b0f14] text-xs font-bold hover:bg-[#4ade80] transition disabled:opacity-50"
                >
                  {forgotSubmitting ? "…" : "Send"}
                </button>
              </div>
              {forgotMessage && <p className="text-[10px] text-[#7cff4e]">{forgotMessage}</p>}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#7cff4e] hover:bg-[#4ade80] text-[#0b0f14] font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(124,255,78,0.25)] hover:shadow-[0_0_40px_rgba(124,255,78,0.4)] transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-8 group"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-[#0b0f14] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Initialize Session <ArrowRight className="w-5 h-5 text-black group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

        </form>

        {/* Footer - Contact Admin */}
        <div className="mt-10 text-center">
          <p className="text-xs text-[#64748b]">
            Need access? <span className="text-white font-medium">Contact your administrator</span>
          </p>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 text-center w-full z-10 flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#7cff4e]/50" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#7cff4e] animate-pulse" />
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#7cff4e]/50" />
        </div>
        <p className="text-[9px] text-[#475569] tracking-[0.2em] uppercase font-medium">Restricted Operational Area</p>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0b0f14]">
        <div className="w-8 h-8 border-2 border-[#7cff4e] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
