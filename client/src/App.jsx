import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import {
  Landmark, LogOut, ShieldAlert, CheckCircle2, Clock, AlertTriangle,
  User, Bell, MapPin, FileText, BarChart3, Users, Flame, Copy,
  Layers, Settings, ChevronRight, X, Sparkles, RefreshCw
} from 'lucide-react';
import api, { toast, err } from './api';
import Citizen from './Citizen';
import Admin from './Admin';
import Worker from './Worker';

// Priority and Status Badges
export const Badge = ({ v, type }) => {
  const styles = {
    HIGH: 'bg-red-100 text-red-700 border-red-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Pending: 'bg-slate-100 text-slate-700 border-slate-300',
    'Under Review': 'bg-blue-100 text-blue-700 border-blue-200',
    Assigned: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    Accepted: 'bg-purple-100 text-purple-700 border-purple-200',
    'In Progress': 'bg-amber-100 text-amber-800 border-amber-300',
    Completed: 'bg-teal-100 text-teal-700 border-teal-200',
    Resolved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
    suspected: 'bg-amber-50 text-amber-700 border-amber-300',
    confirmed: 'bg-red-50 text-red-700 border-red-300',
    dismissed: 'bg-slate-100 text-slate-600 border-slate-200',
    none: 'bg-slate-50 text-slate-500 border-slate-200'
  };

  const currentStyle = styles[v] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentStyle}`}>
      {v}
    </span>
  );
};

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

// Global Toast System
export function Toasts() {
  const [list, setList] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const id = Math.random();
      setList((prev) => [...prev, { id, ...e.detail }]);
      setTimeout(() => {
        setList((prev) => prev.filter((item) => item.id !== id));
      }, 4000);
    };

    window.addEventListener('toast', handleToast);
    return () => window.removeEventListener('toast', handleToast);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm pointer-events-none">
      {list.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg pointer-events-auto flex items-center justify-between gap-2 border ${
            t.type === 'bad'
              ? 'bg-rose-600 text-white border-rose-700'
              : t.type === 'warning'
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-teal-700 text-white border-teal-800'
          }`}
        >
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// Master Layout with Role Sidebar and Navigation
export function Shell({ title, navItems = [], activeNav, onNavChange, children }) {
  const navigate = useNavigate();
  const currentUser = getUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadNotes, setUnreadNotes] = useState(0);

  useEffect(() => {
    api.get('/notifications')
      .then((res) => {
        setUnreadNotes(res.data.filter((n) => !n.read).length);
      })
      .catch(() => {});
  }, [activeNav]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar for Desktop */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col justify-between hidden md:flex border-r border-slate-800">
        <div>
          {/* Logo & Platform Info */}
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-black shadow-md">
                <Landmark size={20} />
              </div>
              <div>
                <h1 className="font-bold text-white text-base leading-tight">CivicAI</h1>
                <p className="text-[11px] text-teal-400 font-medium">From Complaints to Action</p>
              </div>
            </div>
            <div className="mt-3 px-2 py-1 bg-slate-800/80 rounded border border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Role</span>
              <span className="text-xs font-bold text-teal-400 capitalize">{currentUser?.role}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon || FileText;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-xs uppercase">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{currentUser?.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-900/40 transition-colors"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-teal-600 text-white flex items-center justify-center">
                <Landmark size={18} />
              </div>
              <span className="font-bold text-slate-900">CivicAI</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="text-slate-400 font-medium">CivicAI</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-800 capitalize">{currentUser?.role} Portal</span>
              <span className="text-slate-300">/</span>
              <span className="text-teal-700 font-bold">{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* AI Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles size={13} className="text-emerald-600" />
              <span>AI Engine: Active</span>
            </div>

            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-900">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{currentUser?.role}</p>
            </div>

            {/* Mobile Nav Toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                <Layers size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 text-white p-3 space-y-1 border-b border-slate-800">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  activeNav === item.id ? 'bg-teal-600 font-bold' : 'text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded text-sm text-rose-400 font-semibold"
            >
              Log Out
            </button>
          </div>
        )}

        {/* Page Content View */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// Interactive Login & Demo Quick Access Screen
function Login() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const { data } = await api.post(endpoint, formData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast(`Welcome, ${data.user.name}!`);
      navigate(`/${data.user.role}`);
    } catch (errObj) {
      err(errObj);
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Login for instant hackathon evaluation
  const handleDemoLogin = async (role) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/demo-login', { role });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast(`Logged in as ${data.user.name} (${data.user.role})`);
      navigate(`/${data.user.role}`);
    } catch (errObj) {
      err(errObj);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      const { data } = await api.post('/seed');
      toast(data.message || 'Database seeded successfully!');
    } catch (errObj) {
      err(errObj);
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-teal-400 text-slate-950 font-black shadow-lg shadow-teal-500/20 mb-3">
            <Landmark size={30} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">CivicAI</h1>
          <p className="text-slate-400 text-sm mt-1">From Citizen Complaints to Intelligent Action</p>
          <div className="inline-block mt-2 px-3 py-0.5 rounded-full bg-slate-800 text-teal-400 border border-slate-700 text-xs font-semibold">
            PromptWars x ASTRA | AI for Civic Impact
          </div>
        </div>

        {/* Main Auth Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            {isRegister ? 'Register Citizen Account' : 'Sign In to Portal'}
          </h2>
          <p className="text-xs text-slate-500 mb-5">
            {isRegister
              ? 'Join your community in reporting and tracking civic problems.'
              : 'Enter your credentials to access the CivicAI platform.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  className="inp"
                  placeholder="e.g. Priya Nair"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                className="inp"
                type="email"
                placeholder="citizen1@civicai.test"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  className="inp"
                  placeholder="+91 91234 56789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                className="inp"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn w-full py-2.5 mt-2">
              {loading ? 'Authenticating...' : isRegister ? 'Create Citizen Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline"
            >
              {isRegister ? 'Already have an account? Sign in here' : 'New citizen? Register for an account'}
            </button>
          </div>

          {/* Quick Demo Access Bar */}
          <div className="mt-5 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                ⚡ Quick Demo Roles (1-Click)
              </span>
              <button
                type="button"
                onClick={handleSeed}
                disabled={seedLoading}
                className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                title="Reset synthetic data"
              >
                <RefreshCw size={11} className={seedLoading ? 'animate-spin' : ''} />
                {seedLoading ? 'Seeding...' : 'Seed Data'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('citizen')}
                disabled={loading}
                className="py-1.5 px-2 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded text-xs font-semibold text-slate-700 text-center transition-all"
              >
                👤 Citizen
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                disabled={loading}
                className="py-1.5 px-2 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded text-xs font-semibold text-slate-700 text-center transition-all"
              >
                🏛️ Admin
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('worker')}
                disabled={loading}
                className="py-1.5 px-2 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded text-xs font-semibold text-slate-700 text-center transition-all"
              >
                👷 Worker
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Demo passwords default to: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">Password@123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Protected Route Guard
const ProtectedRoute = ({ role, children }) => {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={`/${user.role}`} replace />;
  }
  return children;
};

const RootRedirect = () => {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Toasts />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/citizen/*"
          element={
            <ProtectedRoute role="citizen">
              <Citizen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute role="admin">
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/worker/*"
          element={
            <ProtectedRoute role="worker">
              <Worker />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
