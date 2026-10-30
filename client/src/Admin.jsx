import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, ListOrdered, ShieldAlert, Copy, Flame,
  Users, Layers, BarChart3, Bell, Settings as SettingsIcon,
  Search, CheckCircle2, XCircle, ArrowUpDown, MapPin, UserCheck,
  AlertTriangle, Filter, RefreshCw, Sparkles, ExternalLink, Sliders
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import api, { toast, err } from './api';
import { Shell, Badge, getUser } from './App';
import { ComplaintMap } from './MapView';

const CATEGORIES = [
  'Road Damage',
  'Waterlogging',
  'Garbage',
  'Drainage',
  'Streetlight',
  'Public Infrastructure',
  'Other'
];

const STATUSES = [
  'Pending',
  'Under Review',
  'Assigned',
  'Accepted',
  'In Progress',
  'Completed',
  'Resolved',
  'Rejected'
];

const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];

const PIE_COLORS = ['#dc2626', '#f59e0b', '#10b981'];

export default function Admin() {
  const [activeTab, setActiveTab] = useState('overview');
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({});
  const [workers, setWorkers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Selected Complaint & Modals
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [assignWorkerId, setAssignWorkerId] = useState('');
  const [assignRemarks, setAssignRemarks] = useState('');
  const [overridePriority, setOverridePriority] = useState('HIGH');
  const [overrideReason, setOverrideReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showPriorityDialog, setShowPriorityDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, statsRes, workerRes, noteRes] = await Promise.all([
        api.get('/complaints'),
        api.get('/admin/stats'),
        api.get('/admin/workers'),
        api.get('/notifications')
      ]);
      setComplaints(compRes.data);
      setStats(statsRes.data);
      setWorkers(workerRes.data);
      setNotifications(noteRes.data);

      // Keep selected complaint in sync
      if (selectedComplaint) {
        const updated = compRes.data.find((c) => c._id === selectedComplaint._id);
        if (updated) setSelectedComplaint(updated);
      }
    } catch (e) {
      err(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (actionPromise, successMessage) => {
    try {
      await actionPromise();
      toast(successMessage);
      loadData();
    } catch (e) {
      err(e);
    }
  };

  // Re-seed Database Action
  const handleSeed = async () => {
    setSeedLoading(true);
    try {
      const { data } = await api.post('/seed');
      toast(data.message || 'Database successfully re-seeded!');
      loadData();
    } catch (e) {
      err(e);
    } finally {
      setSeedLoading(false);
    }
  };

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (filterCat && c.category !== filterCat) return false;
      if (filterPriority && c.priority !== filterPriority) return false;
      if (filterStatus && c.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          c.title?.toLowerCase().includes(q) ||
          c.complaintId?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q) ||
          c.citizen?.name?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [complaints, filterCat, filterPriority, filterStatus, searchQuery]);

  // Priority specific list
  const priorityComplaints = useMemo(() => {
    return complaints.filter((c) => c.priority === 'HIGH' && c.status !== 'Resolved');
  }, [complaints]);

  // Suspected duplicates list
  const duplicateReports = useMemo(() => {
    return complaints.filter((c) => c.duplicateStatus === 'suspected');
  }, [complaints]);

  // Chart data formatters
  const categoryChartData = Object.entries(stats.byCategory || {}).map(([key, value]) => ({
    category: key,
    count: value
  }));

  const priorityChartData = [
    { name: 'HIGH', value: stats.byPriority?.HIGH || 0, color: '#dc2626' },
    { name: 'MEDIUM', value: stats.byPriority?.MEDIUM || 0, color: '#f59e0b' },
    { name: 'LOW', value: stats.byPriority?.LOW || 0, color: '#10b981' }
  ].filter((d) => d.value > 0);

  const statusChartData = Object.entries(stats.byStatus || {}).map(([key, value]) => ({
    status: key,
    count: value
  }));

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'all-complaints', label: 'All Complaints', icon: ListOrdered },
    {
      id: 'priority',
      label: 'Priority Queue',
      icon: ShieldAlert,
      badge: priorityComplaints.length
    },
    {
      id: 'duplicates',
      label: 'Duplicate Reports',
      icon: Copy,
      badge: duplicateReports.length
    },
    { id: 'hotspot-map', label: 'Hotspot Map', icon: Flame },
    { id: 'workers', label: 'Worker Fleet', icon: Users },
    { id: 'assignments', label: 'Assignments', icon: Layers },
    { id: 'analytics', label: 'City Analytics', icon: BarChart3 },
    { id: 'notifications', label: 'System Alerts', icon: Bell },
    { id: 'settings', label: 'AI & Settings', icon: SettingsIcon }
  ];

  return (
    <Shell
      title={navItems.find((n) => n.id === activeTab)?.label || 'Admin'}
      navItems={navItems}
      activeNav={activeTab}
      onNavChange={setActiveTab}
    >
      {/* 1. OVERVIEW VIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="card p-3 border-l-4 border-l-teal-600">
              <span className="text-[10px] uppercase font-bold text-slate-500">Total</span>
              <div className="text-xl font-black text-slate-900 mt-0.5">{stats.total ?? '-'}</div>
            </div>
            <div className="card p-3 border-l-4 border-l-slate-400">
              <span className="text-[10px] uppercase font-bold text-slate-500">Pending</span>
              <div className="text-xl font-black text-slate-700 mt-0.5">{stats.pending ?? '-'}</div>
            </div>
            <div className="card p-3 border-l-4 border-l-amber-500">
              <span className="text-[10px] uppercase font-bold text-slate-500">In Progress</span>
              <div className="text-xl font-black text-amber-700 mt-0.5">{stats.inProgress ?? '-'}</div>
            </div>
            <div className="card p-3 border-l-4 border-l-teal-500">
              <span className="text-[10px] uppercase font-bold text-slate-500">Completed</span>
              <div className="text-xl font-black text-teal-700 mt-0.5">{stats.completed ?? '-'}</div>
            </div>
            <div className="card p-3 border-l-4 border-l-emerald-600">
              <span className="text-[10px] uppercase font-bold text-slate-500">Resolved</span>
              <div className="text-xl font-black text-emerald-700 mt-0.5">{stats.resolved ?? '-'}</div>
            </div>
            <div className="card p-3 border-l-4 border-l-rose-600 bg-rose-50/20">
              <span className="text-[10px] uppercase font-bold text-rose-600">High Risk</span>
              <div className="text-xl font-black text-rose-700 mt-0.5">{stats.highPriority ?? '-'}</div>
            </div>
            <div className="card p-3 border-l-4 border-l-amber-600">
              <span className="text-[10px] uppercase font-bold text-amber-600">Duplicates</span>
              <div className="text-xl font-black text-amber-700 mt-0.5">{stats.duplicates ?? '-'}</div>
            </div>
            <div className="card p-3 border-l-4 border-l-indigo-600">
              <span className="text-[10px] uppercase font-bold text-slate-500">Resolution</span>
              <div className="text-xl font-black text-indigo-700 mt-0.5">{stats.resolutionRate ?? 0}%</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Category Chart */}
            <div className="card">
              <h3 className="font-bold text-slate-900 text-sm mb-1">Complaints by Category</h3>
              <p className="text-xs text-slate-500 mb-4">Volume distribution across municipal services</p>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Priority Distribution Chart */}
            <div className="card">
              <h3 className="font-bold text-slate-900 text-sm mb-1">Complaints by Priority</h3>
              <p className="text-xs text-slate-500 mb-4">Severity breakdown by AI triage</p>
              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {priorityChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-around text-xs pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /> HIGH ({stats.byPriority?.HIGH || 0})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> MEDIUM ({stats.byPriority?.MEDIUM || 0})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> LOW ({stats.byPriority?.LOW || 0})</span>
              </div>
            </div>
          </div>

          {/* Hotspot Alert Banner & Recent Complaints */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Hotspots Quick Preview */}
            <div className="card bg-purple-50/40 border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-bold text-purple-900 text-sm">
                  <Flame size={16} className="text-purple-600" />
                  <span>Geographic Hotspots ({stats.hotspots?.length || 0})</span>
                </div>
                <button
                  onClick={() => setActiveTab('hotspot-map')}
                  className="text-xs text-purple-700 font-bold hover:underline"
                >
                  Open Map
                </button>
              </div>
              <div className="space-y-2 text-xs">
                {(stats.hotspots || []).slice(0, 3).map((h, i) => (
                  <div key={i} className="p-2.5 bg-white rounded border border-purple-100 space-y-1">
                    <div className="flex justify-between items-center font-bold text-slate-800">
                      <span>{h.label}</span>
                      <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px]">
                        {h.count} incidents
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Primary: <b>{h.topCategory}</b> • <span className="text-red-600 font-semibold">{h.highPriority} High Priority</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Trends Chart */}
            <div className="card md:col-span-2">
              <h3 className="font-bold text-slate-900 text-sm mb-1">Daily Incident Influx (Last 7 Days)</h3>
              <p className="text-xs text-slate-500 mb-3">Incoming citizen reports timeline</p>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.dailyTrends || []} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="complaints" stroke="#0d9488" fill="#ccfbf1" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ALL COMPLAINTS TABLE VIEW */}
      {activeTab === 'all-complaints' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="card p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  className="inp pl-8 text-xs"
                  placeholder="Search by ID, citizen, title, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="inp w-auto text-xs"
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                className="inp w-auto text-xs"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="">All Priorities</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <select
                className="inp w-auto text-xs"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <button onClick={loadData} className="btn alt text-xs" title="Refresh">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Master Table */}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Complaint ID</th>
                    <th className="p-3">Citizen</th>
                    <th className="p-3">Title & Category</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Duplicates</th>
                    <th className="p-3">Assigned Worker</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredComplaints.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-slate-400">
                        No complaints match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredComplaints.map((c) => (
                      <tr
                        key={c._id}
                        className={`hover:bg-slate-50 transition-colors ${
                          c.priority === 'HIGH' && c.status !== 'Resolved' ? 'bg-red-50/20' : ''
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-teal-800 whitespace-nowrap">
                          {c.complaintId}
                        </td>
                        <td className="p-3 font-medium text-slate-900 whitespace-nowrap">
                          {c.citizen?.name || 'Citizen'}
                        </td>
                        <td className="p-3 max-w-[240px]">
                          <div className="font-semibold text-slate-900 truncate">{c.title}</div>
                          <div className="text-[10px] text-slate-500">{c.category}</div>
                        </td>
                        <td className="p-3 max-w-[160px] truncate" title={c.address}>
                          {c.address}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge v={c.priority} />
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {c.duplicateStatus === 'suspected' ? (
                            <span className="text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px]">
                              ⚠️ Suspected
                            </span>
                          ) : c.duplicateStatus === 'confirmed' ? (
                            <span className="text-red-700 font-semibold bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px]">
                              Confirmed
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">None</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {c.assignedWorker ? (
                            <span className="font-medium text-slate-800">{c.assignedWorker.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge v={c.status} />
                        </td>
                        <td className="p-3 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => setSelectedComplaint(c)}
                            className="btn btn-sm alt"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. PRIORITY COMPLAINTS VIEW */}
      {activeTab === 'priority' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert size={24} className="text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-red-900 text-sm">Emergency & High-Priority Hazard Queue</h3>
                <p className="text-xs text-red-700">
                  Complaints flagged HIGH by the AI engine based on life-safety risks, vulnerable populations, or critical traffic corridors.
                </p>
              </div>
            </div>
            <span className="bg-red-600 text-white font-bold text-xs px-3 py-1 rounded-full">
              {priorityComplaints.length} Urgent Issues
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {priorityComplaints.map((c) => (
              <div key={c._id} className="card border-l-4 border-l-red-600 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-red-800">{c.complaintId}</span>
                      <Badge v={c.category} />
                      <Badge v={c.status} />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{c.title}</h4>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedComplaint(c);
                      setShowAssignDialog(true);
                    }}
                    className="btn btn-sm bg-red-600 hover:bg-red-700 text-white font-bold"
                  >
                    Quick Dispatch
                  </button>
                </div>

                <p className="text-xs text-slate-600">{c.description}</p>

                {/* AI Safety Explanation */}
                <div className="bg-red-50/60 p-3 rounded-lg border border-red-200 text-xs space-y-1.5">
                  <div className="font-semibold text-red-900 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-red-600" />
                    <span>AI Reasoning: Why this is High Priority</span>
                  </div>
                  <p className="text-slate-700">{c.priorityExplanation}</p>
                  {c.priorityFactors?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {c.priorityFactors.map((f, i) => (
                        <span key={i} className="bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded font-semibold">
                          ⚠️ {f}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.actionBrief && (
                    <div className="pt-1.5 border-t border-red-200 text-slate-800">
                      <b>Recommended Action:</b> {c.actionBrief}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>Location: <b>{c.address}</b></span>
                  <span>Citizen: {c.citizen?.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. DUPLICATE REPORTS VIEW */}
      {activeTab === 'duplicates' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="font-bold text-amber-900 text-sm">Suspected Duplicate Reports Review Gate</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              CivicAI cross-references incident text embeddings, keywords, and geographic Haversine distance (180m radius).
              Review and confirm or dismiss before field dispatch.
            </p>
          </div>

          {duplicateReports.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 text-xs">
              No suspected duplicates pending review. All clear!
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateReports.map((c) => (
                <div key={c._id} className="card border-l-4 border-l-amber-500 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-800">{c.complaintId}</span>
                      <h4 className="font-bold text-slate-900 text-sm">{c.title}</h4>
                      <p className="text-xs text-slate-500">{c.address} • Reported by {c.citizen?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleAction(
                            () => api.patch(`/complaints/${c._id}/duplicate`, { action: 'confirm' }),
                            'Confirmed duplicate report.'
                          )
                        }
                        className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      >
                        <CheckCircle2 size={13} /> Confirm Duplicate
                      </button>
                      <button
                        onClick={() =>
                          handleAction(
                            () => api.patch(`/complaints/${c._id}/duplicate`, { action: 'dismiss' }),
                            'Dismissed duplicate flag. Marked as unique.'
                          )
                        }
                        className="btn btn-sm alt font-bold"
                      >
                        <XCircle size={13} /> Dismiss (Unique)
                      </button>
                    </div>
                  </div>

                  {/* Duplicate Matching Info */}
                  <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-900">
                        Match Score: {Math.round((c.similarityScore || 0.65) * 100)}% Similarity
                      </span>
                      <span className="text-slate-500">
                        Status: <b className="text-amber-800 uppercase">{c.duplicateStatus}</b>
                      </span>
                    </div>
                    <p className="text-slate-700">
                      <b>AI Duplicate Match Reason:</b> {c.duplicateReason || 'High spatial closeness within 180m with overlapping symptom keywords.'}
                    </p>

                    {/* Matched Reports List */}
                    {c.possibleDuplicates?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[11px] font-bold text-slate-700">Existing Target Candidates:</span>
                        {c.possibleDuplicates.map((match, idx) => (
                          <div key={idx} className="bg-white p-2 rounded border border-amber-200 text-[11px] flex justify-between">
                            <div>
                              <span className="font-mono font-bold text-slate-800">{match.complaint?.complaintId}</span>{' '}
                              <span>{match.complaint?.title}</span>
                              <div className="text-[10px] text-slate-400">Distance: {match.distanceM}m away</div>
                            </div>
                            <span className="font-bold text-teal-700">{Math.round((match.score || 0.6) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. HOTSPOT MAP VIEW */}
      {activeTab === 'hotspot-map' && (
        <div className="space-y-4">
          <div className="card p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Geographic Hotspot & Cluster Map</h3>
              <p className="text-xs text-slate-500">
                Visualizing active complaints and automated density clusters (~380m radius).
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 font-semibold text-red-600">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> High Priority
              </span>
              <span className="flex items-center gap-1 font-semibold text-amber-600">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Medium
              </span>
              <span className="flex items-center gap-1 font-semibold text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low
              </span>
              <span className="flex items-center gap-1 font-semibold text-purple-700">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Hotspot Ring
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Map Container */}
            <div className="md:col-span-2 card p-1 h-[520px]">
              <ComplaintMap
                complaints={filteredComplaints}
                hotspots={stats.hotspots || []}
                selectedComplaintId={selectedComplaint?._id}
                onSelectComplaint={(c) => setSelectedComplaint(c)}
              />
            </div>

            {/* Hotspots Side List */}
            <div className="card h-[520px] overflow-y-auto space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Detected City Clusters ({stats.hotspots?.length || 0})
              </h4>
              {(stats.hotspots || []).length === 0 ? (
                <p className="text-xs text-slate-400">No clusters detected.</p>
              ) : (
                (stats.hotspots || []).map((h, i) => (
                  <div key={i} className="p-3 bg-purple-50/60 rounded-lg border border-purple-200 text-xs space-y-1.5">
                    <div className="flex justify-between items-center font-bold text-purple-950">
                      <span>{h.label}</span>
                      <span className="bg-purple-600 text-white px-2 py-0.5 rounded-full text-[10px]">
                        {h.count} incidents
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Primary Issue: <b className="text-slate-800">{h.topCategory}</b>
                    </div>
                    <div className="text-[11px] text-red-600 font-semibold">
                      ⚠️ {h.highPriority} High Priority reports
                    </div>
                    <p className="text-[11px] text-purple-900 italic bg-white p-2 rounded border border-purple-100">
                      {h.recommendation}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. WORKER FLEET MANAGEMENT */}
      {activeTab === 'workers' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-slate-900 text-sm mb-1">Municipal Field Squad Fleet</h3>
            <p className="text-xs text-slate-500 mb-4">
              Active departmental maintenance workers and their assigned workloads.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b">
                  <tr>
                    <th className="p-3">Worker Name</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Active Tasks</th>
                    <th className="p-3">Completed</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workers.map((w) => (
                    <tr key={w._id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{w.name}</td>
                      <td className="p-3">{w.department || 'General'}</td>
                      <td className="p-3 text-slate-500">{w.email}</td>
                      <td className="p-3">{w.phone || '-'}</td>
                      <td className="p-3">
                        <span className="font-bold text-amber-700">{w.activeTasks}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-emerald-700">{w.completedTasks}</span>
                      </td>
                      <td className="p-3">
                        {w.activeTasks > 5 ? (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            High Load
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Available
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. ASSIGNMENTS VIEW */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-slate-900 text-sm mb-1">Active Work Assignments</h3>
            <p className="text-xs text-slate-500 mb-4">Tracking task progression from dispatch to resolution.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b">
                  <tr>
                    <th className="p-3">Complaint ID</th>
                    <th className="p-3">Assigned Worker</th>
                    <th className="p-3">Title & Category</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Stage</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints
                    .filter((c) => c.assignedWorker)
                    .map((c) => (
                      <tr key={c._id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-teal-800">{c.complaintId}</td>
                        <td className="p-3 font-semibold text-slate-900">{c.assignedWorker?.name}</td>
                        <td className="p-3 max-w-[200px] truncate">{c.title}</td>
                        <td className="p-3 max-w-[160px] truncate">{c.address}</td>
                        <td className="p-3"><Badge v={c.priority} /></td>
                        <td className="p-3"><Badge v={c.status} /></td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedComplaint(c)}
                            className="btn btn-sm alt"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. ANALYTICS VIEW */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card">
              <h4 className="font-bold text-slate-900 text-sm mb-2">Resolution Efficiency</h4>
              <div className="text-3xl font-black text-emerald-700 mb-1">{stats.resolutionRate || 0}%</div>
              <p className="text-xs text-slate-500">Overall municipal complaint resolution rate</p>
            </div>
            <div className="card">
              <h4 className="font-bold text-slate-900 text-sm mb-2">Active Field Personnel</h4>
              <div className="text-3xl font-black text-indigo-700 mb-1">{workers.length}</div>
              <p className="text-xs text-slate-500">Civil Works, Electrical, and Sanitation specialists</p>
            </div>
            <div className="card">
              <h4 className="font-bold text-slate-900 text-sm mb-2">Identified Clusters</h4>
              <div className="text-3xl font-black text-purple-700 mb-1">{stats.hotspots?.length || 0}</div>
              <p className="text-xs text-slate-500">High-density multi-incident zones</p>
            </div>
          </div>

          <div className="card">
            <h3 className="font-bold text-slate-900 text-sm mb-1">Status Distribution Across Platform</h3>
            <div className="h-56 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 9. NOTIFICATIONS VIEW */}
      {activeTab === 'notifications' && (
        <div className="card space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">System Administrative Alerts</h3>
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div key={n._id} className="py-3 flex items-start gap-3 text-xs">
                <Bell size={16} className="text-teal-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{n.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 10. SETTINGS & AI ENGINE STATUS */}
      {activeTab === 'settings' && (
        <div className="card max-w-xl space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base">CivicAI Engine Configuration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect backend AI triage settings, duplicate thresholds, and synthetic demo datasets.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">AI Operational Mode:</span>
              <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Duplicate Closeness Radius:</span>
              <span className="font-mono text-slate-800 font-bold">180 meters</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Duplicate Similarity Threshold:</span>
              <span className="font-mono text-slate-800 font-bold">38% combined score</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Hotspot Cluster Grid:</span>
              <span className="font-mono text-slate-800 font-bold">~380 meters (3+ complaints)</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Hackathon Demonstration Reset
            </h4>
            <p className="text-xs text-slate-500">
              Reload the initial 40+ synthetic complaints across Bangalore wards (Lakeview Circle, Market Street, Green Park Gate) with sample duplicates and safety hazards.
            </p>
            <button
              onClick={handleSeed}
              disabled={seedLoading}
              className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              <RefreshCw size={14} className={seedLoading ? 'animate-spin' : ''} />
              {seedLoading ? 'Re-seeding Database...' : 'Re-Seed Demo Dataset (43 Complaints)'}
            </button>
          </div>
        </div>
      )}

      {/* COMPLAINT MANAGEMENT MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-teal-800">{selectedComplaint.complaintId}</span>
                  <Badge v={selectedComplaint.priority} />
                  <Badge v={selectedComplaint.status} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{selectedComplaint.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Citizen: <b>{selectedComplaint.citizen?.name}</b> • Phone: {selectedComplaint.citizen?.phone || 'N/A'} • {selectedComplaint.address}
                </p>
              </div>
              <button onClick={() => setSelectedComplaint(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {selectedComplaint.imageUrl && (
              <img
                src={selectedComplaint.imageUrl}
                alt="Complaint"
                className="w-full h-48 object-cover rounded-lg"
              />
            )}

            {/* AI Action Brief & Analysis Card */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-teal-900">
                <Sparkles size={14} className="text-teal-600" />
                <span>AI Intake Assessment ({selectedComplaint.aiMode})</span>
              </div>
              <p><b>Summary:</b> {selectedComplaint.aiSummary}</p>
              <p><b>Priority Reason:</b> {selectedComplaint.priorityExplanation}</p>
              {selectedComplaint.actionBrief && (
                <div className="p-2 bg-teal-50 border border-teal-200 rounded text-teal-900">
                  <b>AI Action Brief:</b> {selectedComplaint.actionBrief}
                </div>
              )}
            </div>

            {/* Worker Remarks if completed */}
            {selectedComplaint.completionRemarks && (
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                <b>Field Worker Remarks:</b> {selectedComplaint.completionRemarks}
              </div>
            )}

            {/* Actions Toolbar */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Administrative Actions</h4>

              {/* Assign Worker */}
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="inp w-auto text-xs"
                  value={assignWorkerId}
                  onChange={(e) => setAssignWorkerId(e.target.value)}
                >
                  <option value="">Select Municipal Worker...</option>
                  {workers.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name} ({w.department}) - {w.activeTasks} active tasks
                    </option>
                  ))}
                </select>

                <button
                  disabled={!assignWorkerId}
                  onClick={() =>
                    handleAction(
                      () => api.patch(`/complaints/${selectedComplaint._id}/assign`, { workerId: assignWorkerId }),
                      'Worker assigned successfully.'
                    )
                  }
                  className="btn btn-sm font-bold"
                >
                  <UserCheck size={14} /> Assign Worker
                </button>
              </div>

              {/* Status Update & Priority Override */}
              <div className="flex flex-wrap gap-2 items-center pt-2">
                <select
                  className="inp w-auto text-xs"
                  value={selectedComplaint.status}
                  onChange={(e) =>
                    handleAction(
                      () => api.patch(`/complaints/${selectedComplaint._id}/status`, { status: e.target.value }),
                      `Status changed to ${e.target.value}`
                    )
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <button
                  onClick={() =>
                    handleAction(
                      () => api.patch(`/complaints/${selectedComplaint._id}/status`, { status: 'Resolved' }),
                      'Complaint verified and marked Resolved!'
                    )
                  }
                  className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <CheckCircle2 size={14} /> Mark Resolved
                </button>

                <button
                  onClick={() => setShowRejectDialog(true)}
                  className="btn btn-sm danger font-bold"
                >
                  <XCircle size={14} /> Reject
                </button>
              </div>

              {/* Rejection Reason Form */}
              {showRejectDialog && (
                <div className="p-3 bg-red-50 rounded border border-red-200 text-xs space-y-2 mt-2">
                  <label className="font-bold text-red-900 block">Specify Rejection Reason:</label>
                  <input
                    className="inp text-xs"
                    placeholder="e.g. Jurisdiction belongs to private layout; invalid phone number"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={!rejectReason}
                      onClick={() => {
                        handleAction(
                          () => api.patch(`/complaints/${selectedComplaint._id}/reject`, { reason: rejectReason }),
                          'Complaint rejected.'
                        );
                        setShowRejectDialog(false);
                      }}
                      className="btn btn-sm danger"
                    >
                      Confirm Rejection
                    </button>
                    <button onClick={() => setShowRejectDialog(false)} className="btn btn-sm alt">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t flex justify-end">
              <button onClick={() => setSelectedComplaint(null)} className="btn alt text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
