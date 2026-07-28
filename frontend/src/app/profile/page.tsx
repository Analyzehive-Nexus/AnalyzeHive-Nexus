"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  MapPin,
  Mail,
  Phone,
  Shield,
  Key,
  Bell,
  Activity,
  Clock,
  ChevronRight,
  LogOut,
  Zap,
  Briefcase,
  Award,
  Layers,
  Settings
} from "lucide-react";
import { api } from "@/lib/api";

// --- Mock Data ---
const userProfile = {
  name: "Alex Chen",
  role: "Senior Supply Chain Architect",
  location: "San Francisco, CA",
  email: "alex.chen@analyzehive.com",
  phone: "+1 (555) 012-3456",
  clearance: "Level 4 (High Security)",
  tasksCompleted: 142,
  efficiency: "98.5%",
  rank: "Elite",
  joined: "March 2024",
  bio: "Specializing in predictive logistics and autonomous supply chain optimization. Leading the implementation of AI-driven distribution models across the APAC region."
};

interface ActivityEntry {
  id: number;
  action: string;
  time: string;
  type: string;
}

const skills = ["Logistics AI", "Risk Management", "Demand Forecasting", "Network Security"];

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(true);

  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityExpanded, setActivityExpanded] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  const loadActivity = (limit: number) => {
    api
      .get<{ activity: ActivityEntry[]; total: number }>(`/api/profile/activity?limit=${limit}`)
      .then((data) => {
        setActivityLog(data.activity);
        setActivityTotal(data.total);
      })
      .catch(() => setActivityLog([]));
  };

  useEffect(() => {
    loadActivity(4);
  }, []);

  const handleViewAll = () => {
    setActivityExpanded(true);
    loadActivity(activityTotal || 20);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSubmitting(true);
    setPasswordMessage(null);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      setPasswordMessage({ type: "success", text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password.",
      });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-transparent w-full text-slate-300 p-8 animate-fade-in-up">
      
      {/* Header */}
      <header className="flex justify-between items-center pb-6 border-b border-white/5 mb-8">
          <div className="flex items-center gap-2 text-sm text-[#94a3b8]">
            <span className="hover:text-white transition-colors cursor-pointer">Dashboard</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-[#e6eaf0] font-medium">Operative Profile</span>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-xs font-mono text-green-400 bg-green-500/10 px-3 py-1 rounded border border-green-500/20">
                SYSTEM STATUS: OPTIMAL
             </span>
          </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Column: Identity Card */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-[#0f141b] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
               {/* Background detail */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full" />
               
               <div className="flex flex-col items-center text-center relative z-10">
                  <div className="w-24 h-24 rounded-full border-2 border-[#7cff4e] p-1 mb-4 relative shadow-[0_0_20px_rgba(124,255,78,0.2)]">
                      <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                          <User className="w-10 h-10 text-white opacity-80" />
                          {/* Simulated Avatar Image would go here */}
                      </div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 bg-[#0b0f14] rounded-full flex items-center justify-center border border-[#7cff4e]">
                          <div className="w-2 h-2 rounded-full bg-[#7cff4e] animate-pulse" />
                      </div>
                  </div>
                  
                  <h2 className="text-xl font-bold text-white mb-1">{userProfile.name}</h2>
                  <p className="text-sm text-[#7cff4e] font-medium mb-4">{userProfile.role}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-[#94a3b8] mb-6 bg-white/5 px-3 py-1.5 rounded-full">
                      <MapPin className="w-3 h-3" /> {userProfile.location}
                  </div>

                  <div className="w-full space-y-3 pt-6 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs">
                          <span className="text-[#64748b]">Clearance</span>
                          <span className="text-white font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[10px]">{userProfile.clearance}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                          <span className="text-[#64748b]">Member Since</span>
                          <span className="text-white">{userProfile.joined}</span>
                      </div>
                  </div>
               </div>
           </div>

           {/* Skills Card */}
           <div className="bg-[#0f141b] border border-white/10 rounded-2xl p-6">
               <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                   <Zap className="w-4 h-4 text-yellow-400" /> Expertise
               </h3>
               <div className="flex flex-wrap gap-2">
                   {skills.map((skill) => (
                       <span key={skill} className="text-xs text-[#94a3b8] bg-white/5 px-2 py-1 rounded hover:bg-white/10 transition cursor-default border border-white/5">
                           {skill}
                       </span>
                   ))}
               </div>
           </div>
        </div>

        {/* Right Column: Main Content */}
        <div className="lg:col-span-3 space-y-6">
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0f141b] border border-white/10 rounded-xl p-5 hover:border-[#7cff4e]/30 transition group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition">
                        <Briefcase className="w-12 h-12 text-[#7cff4e]" />
                    </div>
                    <p className="text-xs text-[#94a3b8] mb-1">Total Missions</p>
                    <h3 className="text-2xl font-bold text-white">{userProfile.tasksCompleted}</h3>
                    <div className="mt-2 text-[10px] text-green-400 flex items-center gap-1">
                        <span>+12 this week</span>
                    </div>
                </div>
                
                <div className="bg-[#0f141b] border border-white/10 rounded-xl p-5 hover:border-blue-500/30 transition group relative overflow-hidden">
                     <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition">
                        <Activity className="w-12 h-12 text-blue-500" />
                    </div>
                    <p className="text-xs text-[#94a3b8] mb-1">Efficiency Rating</p>
                    <h3 className="text-2xl font-bold text-white">{userProfile.efficiency}</h3>
                    <div className="mt-2 text-[10px] text-blue-400 flex items-center gap-1">
                        <span>Top 2% of agents</span>
                    </div>
                </div>

                <div className="bg-[#0f141b] border border-white/10 rounded-xl p-5 hover:border-purple-500/30 transition group relative overflow-hidden">
                     <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition">
                        <Award className="w-12 h-12 text-purple-500" />
                    </div>
                    <p className="text-xs text-[#94a3b8] mb-1">Current Rank</p>
                    <h3 className="text-2xl font-bold text-white">{userProfile.rank}</h3>
                    <div className="mt-2 text-[10px] text-purple-400 flex items-center gap-1">
                        <span>Next: Master</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/5 pb-1">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`pb-3 px-1 text-sm font-medium transition-all relative ${activeTab === 'overview' ? 'text-[#7cff4e]' : 'text-[#94a3b8] hover:text-white'}`}
                >
                    Overview
                    {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#7cff4e]" />}
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`pb-3 px-1 text-sm font-medium transition-all relative ${activeTab === 'settings' ? 'text-[#7cff4e]' : 'text-[#94a3b8] hover:text-white'}`}
                >
                    Settings
                    {activeTab === 'settings' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#7cff4e]" />}
                </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[300px]">
                {activeTab === 'overview' ? (
                    <div className="space-y-6 animate-fade-in-up">
                        {/* Bio */}
                        <div className="bg-[#0f141b] border border-white/10 rounded-xl p-6">
                            <h3 className="text-sm font-bold text-white mb-3">Professional Summary</h3>
                            <p className="text-sm text-[#94a3b8] leading-relaxed">{userProfile.bio}</p>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-[#0f141b] border border-white/10 rounded-xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-[#64748b]" /> Recent Activity
                                </h3>
                                {!activityExpanded && (
                                    <button onClick={handleViewAll} className="text-xs text-[#7cff4e] hover:text-[#4ade80]">
                                        View All
                                    </button>
                                )}
                            </div>
                            <div className="space-y-4">
                                {activityLog.map((log) => (
                                    <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                                        <div className={`mt-1 w-2 h-2 rounded-full ${
                                            log.type === 'success' ? 'bg-green-500' : 
                                            log.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                                        }`} />
                                        <div className="flex-1">
                                            <p className="text-sm text-[#e6eaf0]">{log.action}</p>
                                            <p className="text-xs text-[#64748b] mt-0.5">{log.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in-up">
                        {/* Settings Panel */}
                        <div className="bg-[#0f141b] border border-white/10 rounded-xl p-6 space-y-6">
                            
                            <div className="flex items-center justify-between pb-4 border-b border-white/5">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded text-blue-400">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Notifications</h4>
                                        <p className="text-xs text-[#94a3b8]">Receive alerts for critical supply chain events</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setNotifications(!notifications)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${notifications ? 'bg-blue-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${notifications ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between pb-4 border-b border-white/5">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-purple-500/10 rounded text-purple-400">
                                        <Shield className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Two-Factor Auth</h4>
                                        <p className="text-xs text-[#94a3b8]">Secure your account with biometric logic</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setTwoFactor(!twoFactor)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${twoFactor ? 'bg-[#7cff4e]' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${twoFactor ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            <div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-red-500/10 rounded text-red-400">
                                            <Key className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-white">Change Password</h4>
                                            <p className="text-xs text-[#94a3b8]">Update your system access credentials</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setShowPasswordForm((s) => !s); setPasswordMessage(null); }}
                                        className="px-3 py-1.5 rounded border border-white/10 text-xs text-white hover:bg-white/5 transition"
                                    >
                                        {showPasswordForm ? "Cancel" : "Update"}
                                    </button>
                                </div>

                                {showPasswordForm && (
                                    <form onSubmit={handleChangePassword} className="mt-4 space-y-3 pl-11">
                                        <input
                                            type="password"
                                            required
                                            placeholder="Current password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full bg-[#0b0f14] border border-white/10 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#7cff4e]/50"
                                        />
                                        <input
                                            type="password"
                                            required
                                            minLength={8}
                                            placeholder="New password (min 8 characters)"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full bg-[#0b0f14] border border-white/10 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#7cff4e]/50"
                                        />
                                        <button
                                            type="submit"
                                            disabled={passwordSubmitting}
                                            className="px-4 py-2 rounded-lg bg-[#7cff4e] text-[#0b0f14] text-xs font-bold hover:bg-[#4ade80] transition disabled:opacity-50"
                                        >
                                            {passwordSubmitting ? "Updating…" : "Confirm Change"}
                                        </button>
                                    </form>
                                )}

                                {passwordMessage && (
                                    <p className={`mt-3 pl-11 text-xs ${passwordMessage.type === "success" ? "text-[#7cff4e]" : "text-red-400"}`}>
                                        {passwordMessage.text}
                                    </p>
                                )}
                            </div>

                        </div>

                        {/* Danger Zone */}
                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 flex justify-between items-center">
                            <div>
                                <h4 className="text-sm font-bold text-red-500 mb-1">End Session</h4>
                                <p className="text-xs text-red-400/70">Securely logout from all active terminals</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                disabled={loggingOut}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition border border-red-500/20 disabled:opacity-50"
                            >
                                <LogOut className="w-4 h-4" /> {loggingOut ? "SIGNING OUT…" : "LOGOUT"}
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </div>

      </div>
    </div>
  );
}
