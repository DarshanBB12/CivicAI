import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, PlusCircle, ListChecks, Crosshair, Bell,
  User as UserIcon, MapPin, Image as ImageIcon, Trash2,
  Sparkles, AlertCircle, CheckCircle2, Clock, Search, ExternalLink,
  ChevronRight, ArrowRight, ShieldCheck, Copy
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import api, { toast, err } from './api';
import { Shell, Badge, getUser } from './App';
import { PinMap } from './MapView';

const CATEGORIES = [
  'Road Damage',
  'Waterlogging',
  'Garbage',
  'Drainage',
  'Streetlight',
  'Public Infrastructure',
  'Other'
];

export default function Citizen() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [complaints, setComplaints] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Road Damage',
    address: ''
  });
  const [coords, setCoords] = useState([12.9352, 77.6245]); // Default near Koramangala
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmissionResult, setLastSubmissionResult] = useState(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Tracking state
  const [trackIdInput, setTrackIdInput] = useState('');
  const [trackedComplaint, setTrackedComplaint] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);

  // Modal State
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  // Profile State
  const [profileForm, setProfileForm] = useState({
    name: getUser()?.name || '',
    phone: getUser()?.phone || ''
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([api.get('/complaints'), api.get('/notifications')])
      .then(([compRes, noteRes]) => {
        setComplaints(compRes.data);
        setNotifications(noteRes.data);
      })
      .catch((e) => err(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Image Selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // GPS Geolocation
  const handleUseLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords([pos.coords.latitude, pos.coords.longitude]);
          toast('Location coordinates captured from GPS.');
        },
        () => {
          toast('Location permission denied. Please tap on the map to set location.', 'warning');
        }
      );
    } else {
      toast('Geolocation not supported by your browser.', 'warning');
    }
  };

  // Submit Complaint
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coords) {
      return toast('Please select a location on the map.', 'bad');
    }
    setSubmitting(true);

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('category', form.category);
    formData.append('address', form.address || 'Selected Map Coordinates');
    formData.append('latitude', coords[0]);
    formData.append('longitude', coords[1]);
    if (imageFile) formData.append('image', imageFile);

    try {
      const { data } = await api.post('/complaints', formData);
      setLastSubmissionResult(data);
      toast(`Complaint submitted! AI classified as ${data.category} (${data.priority} priority).`);
      // Reset form
      setForm({ title: '', description: '', category: 'Road Damage', address: '' });
      setImageFile(null);
      setImagePreview(null);
      loadData();
    } catch (errObj) {
      err(errObj);
    } finally {
      setSubmitting(false);
    }
  };

  // Track Complaint by ID
  const handleTrack = async (e) => {
    if (e) e.preventDefault();
    if (!trackIdInput.trim()) return;
    setTrackLoading(true);
    try {
      const { data } = await api.get(`/complaints/track/${trackIdInput.trim()}`);
      setTrackedComplaint(data);
    } catch (errObj) {
      err(errObj);
      setTrackedComplaint(null);
    } finally {
      setTrackLoading(false);
    }
  };

  // Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.patch('/auth/profile', profileForm);
      const user = getUser();
      localStorage.setItem('user', JSON.stringify({ ...user, name: data.name, phone: data.phone }));
      toast('Profile updated successfully!');
    } catch (errObj) {
      err(errObj);
    }
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast('All notifications marked as read.');
    } catch (errObj) {
      err(errObj);
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (filterCat && c.category !== filterCat) return false;
    if (filterPriority && c.priority !== filterPriority) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        c.title?.toLowerCase().includes(q) ||
        c.complaintId?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Calculate Metrics
  const totalCount = complaints.length;
  const pendingCount = complaints.filter((c) => ['Pending', 'Under Review'].includes(c.status)).length;
  const inProgressCount = complaints.filter((c) => ['Assigned', 'Accepted', 'In Progress'].includes(c.status)).length;
  const resolvedCount = complaints.filter((c) => ['Completed', 'Resolved'].includes(c.status)).length;

  const chartData = [
    { name: 'Pending', value: pendingCount, color: '#94a3b8' },
    { name: 'In Progress', value: inProgressCount, color: '#f59e0b' },
    { name: 'Resolved', value: resolvedCount, color: '#10b981' }
  ].filter((d) => d.value > 0);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'report', label: 'Report a Problem', icon: PlusCircle },
    { id: 'complaints', label: 'My Complaints', icon: ListChecks },
    { id: 'track', label: 'Track Complaint', icon: Crosshair },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: notifications.filter((n) => !n.read).length
    },
    { id: 'profile', label: 'My Profile', icon: UserIcon }
  ];

  return (
    <Shell
      title={navItems.find((n) => n.id === activeTab)?.label || 'Citizen'}
      navItems={navItems}
      activeNav={activeTab}
      onNavChange={setActiveTab}
    >
      {/* 1. DASHBOARD VIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-teal-800 to-slate-900 rounded-xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Hello, {getUser()?.name || 'Citizen'}!</h2>
              <p className="text-teal-200 text-sm mt-1">
                Help improve your city. Report infrastructure problems and let CivicAI prioritize and resolve them.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('report')}
              className="btn bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold shadow-md flex-shrink-0"
            >
              <PlusCircle size={16} /> Report a Problem
            </button>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card border-l-4 border-l-teal-600">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Reports</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
            </div>
            <div className="card border-l-4 border-l-slate-400">
              <span className="text-xs font-semibold text-slate-500 uppercase">Pending Review</span>
              <div className="text-2xl font-bold text-slate-700 mt-1">{pendingCount}</div>
            </div>
            <div className="card border-l-4 border-l-amber-500">
              <span className="text-xs font-semibold text-slate-500 uppercase">In Progress</span>
              <div className="text-2xl font-bold text-amber-700 mt-1">{inProgressCount}</div>
            </div>
            <div className="card border-l-4 border-l-emerald-500">
              <span className="text-xs font-semibold text-slate-500 uppercase">Resolved</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{resolvedCount}</div>
            </div>
          </div>

          {/* Status Breakdown & Recent Reports */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Status Chart */}
            <div className="card flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">Complaint Status Breakdown</h3>
                <p className="text-xs text-slate-500 mb-4">Real-time status of your submissions</p>
              </div>
              {chartData.length > 0 ? (
                <div className="h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                  No complaints submitted yet.
                </div>
              )}
              <div className="flex justify-around text-xs pt-3 border-t border-slate-100">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Pending ({pendingCount})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Progress ({inProgressCount})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Resolved ({resolvedCount})</span>
              </div>
            </div>

            {/* Recent Submissions */}
            <div className="card md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-sm">Recent Complaints</h3>
                <button
                  onClick={() => setActiveTab('complaints')}
                  className="text-xs text-teal-700 font-semibold hover:underline flex items-center gap-1"
                >
                  View All <ArrowRight size={13} />
                </button>
              </div>

              {complaints.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  You haven't filed any complaints yet. Tap "Report a Problem" to begin!
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {complaints.slice(0, 4).map((c) => (
                    <div
                      key={c._id}
                      onClick={() => {
                        setSelectedComplaint(c);
                      }}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer rounded px-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs font-semibold text-slate-500">{c.complaintId}</span>
                          <Badge v={c.priority} />
                          <Badge v={c.status} />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900 truncate">{c.title}</h4>
                        <p className="text-xs text-slate-500 truncate">{c.aiSummary || c.description}</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. REPORT A PROBLEM VIEW */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* AI Result Card if just submitted */}
          {lastSubmissionResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                  <span>Report Successfully Lodged (ID: {lastSubmissionResult.complaintId})</span>
                </div>
                <button
                  onClick={() => setLastSubmissionResult(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕ Dismiss
                </button>
              </div>

              {/* AI Classification Feedback */}
              <div className="mt-3 bg-white p-4 rounded-lg border border-emerald-100 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-teal-800">
                  <Sparkles size={14} className="text-teal-600" />
                  <span>AI Intake Analysis ({lastSubmissionResult.aiMode})</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-500">Categorized As:</span>{' '}
                    <b className="text-slate-900">{lastSubmissionResult.category}</b>
                  </div>
                  <div>
                    <span className="text-slate-500">Assigned Priority:</span>{' '}
                    <Badge v={lastSubmissionResult.priority} />
                  </div>
                </div>
                <p className="text-slate-600">
                  <b>AI Summary:</b> {lastSubmissionResult.aiSummary}
                </p>
                <p className="text-slate-600">
                  <b>Priority Reason:</b> {lastSubmissionResult.priorityExplanation}
                </p>
                {lastSubmissionResult.duplicateStatus === 'suspected' && (
                  <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
                    <Copy size={14} />
                    <span>
                      <b>Possible Duplicate Detected:</b> Similar report found within 180m. An admin will review and consolidate both.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Complaint Submission Form */}
          <div className="card">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">Submit a Civic Report</h2>
              <p className="text-xs text-slate-500">
                Provide details and drop a pin on the map. Our AI engine will categorize, prioritize, and route it to municipal officers.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Left Column: Details */}
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Problem Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="inp"
                      placeholder="e.g. Deep crater pothole near Lakeview Circle"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                      maxLength={140}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Detailed Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="inp"
                      rows={4}
                      placeholder="Describe the issue, severity, any hazards to public safety, and how long it has been there..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      required
                      maxLength={3000}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Category (AI will verify)
                    </label>
                    <select
                      className="inp"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Address / Landmark
                    </label>
                    <input
                      className="inp"
                      placeholder="e.g. 100 Feet Rd, near Sony World Signal"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>

                  {/* Photo Upload with Preview */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Upload Incident Photo (JPG / PNG)
                    </label>
                    {!imagePreview ? (
                      <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-teal-50/30 transition-colors">
                        <ImageIcon size={24} className="text-slate-400 mb-1" />
                        <span className="text-xs font-medium text-slate-600">Click to attach photo or use camera</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                    ) : (
                      <div className="relative inline-block border rounded-lg overflow-hidden">
                        <img
                          src={imagePreview}
                          alt="Incident Preview"
                          className="w-48 h-32 object-cover"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow"
                          title="Remove photo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Location Map */}
                <div className="space-y-3 flex flex-col">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <MapPin size={14} className="text-teal-700" />
                      Pin Location on Map <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleUseLocation}
                      className="text-xs text-teal-700 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Crosshair size={13} /> Use Current GPS
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Tap anywhere on the map to set the exact coordinates of the issue.
                  </p>

                  <div className="h-72 w-full rounded-lg overflow-hidden border border-slate-200">
                    <PinMap
                      pos={coords}
                      onPick={(lat, lng) => setCoords([lat, lng])}
                    />
                  </div>

                  <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono">
                    Coordinates: {coords ? `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}` : 'None selected'}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button type="submit" disabled={submitting} className="btn py-2.5 px-6 font-bold shadow-md">
                  {submitting ? (
                    <>
                      <Sparkles size={16} className="animate-spin" />
                      AI is analyzing and filing report...
                    </>
                  ) : (
                    'Submit Report to Municipal Queue'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MY COMPLAINTS VIEW */}
      {activeTab === 'complaints' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="card p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  className="inp pl-8 text-xs"
                  placeholder="Search complaints by title, ID, or address..."
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
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>

              <select
                className="inp w-auto text-xs"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* Complaint Cards Grid */}
          {filteredComplaints.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 text-xs">
              No complaints match the filter criteria.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredComplaints.map((c) => (
                <div
                  key={c._id}
                  onClick={() => setSelectedComplaint(c)}
                  className="card hover:shadow-md cursor-pointer transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-teal-800">{c.complaintId}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge v={c.priority} />
                        <Badge v={c.status} />
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mb-1">{c.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2 mb-2">{c.description}</p>

                    {c.imageUrl && (
                      <div className="mb-2">
                        <img
                          src={c.imageUrl}
                          alt="Complaint photo"
                          className="h-28 w-full object-cover rounded-md"
                        />
                      </div>
                    )}

                    <div className="bg-slate-50 p-2 rounded text-[11px] text-slate-600 mb-2">
                      <b>AI Summary:</b> {c.aiSummary}
                    </div>

                    {c.duplicateStatus === 'suspected' && (
                      <div className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded flex items-center gap-1 mb-2">
                        <Copy size={12} />
                        <span>Possible duplicate report (under administrative review)</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {c.address}
                    </span>
                    <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. TRACK COMPLAINT TIMELINE VIEW */}
      {activeTab === 'track' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Track Live Complaint Progress</h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter any CivicAI Complaint ID (e.g. {complaints[0]?.complaintId || 'CMP-XXXXX'}) to view real-time lifecycle tracking.
            </p>

            <form onSubmit={handleTrack} className="flex gap-2 max-w-md">
              <input
                className="inp font-mono uppercase"
                placeholder="Enter Complaint ID..."
                value={trackIdInput}
                onChange={(e) => setTrackIdInput(e.target.value)}
                required
              />
              <button type="submit" disabled={trackLoading} className="btn flex-shrink-0">
                <Search size={14} /> {trackLoading ? 'Searching...' : 'Track'}
              </button>
            </form>
          </div>

          {/* Timeline Display */}
          {trackedComplaint && (
            <div className="card space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-teal-800">
                      {trackedComplaint.complaint.complaintId}
                    </span>
                    <Badge v={trackedComplaint.complaint.priority} />
                    <Badge v={trackedComplaint.complaint.status} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {trackedComplaint.complaint.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Category: {trackedComplaint.complaint.category} • Location: {trackedComplaint.complaint.address}
                  </p>
                </div>
                {trackedComplaint.complaint.assignedWorker && (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500 block">Assigned Municipal Worker:</span>
                    <b className="text-slate-800">{trackedComplaint.complaint.assignedWorker.name}</b>
                  </div>
                )}
              </div>

              {/* 5-Step Visual Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-4 tracking-wider">
                  Resolution Lifecycle
                </h4>
                {(() => {
                  const stages = [
                    { id: 'Pending', label: 'Submitted' },
                    { id: 'Under Review', label: 'Under Review' },
                    { id: 'Assigned', label: 'Assigned to Worker' },
                    { id: 'In Progress', label: 'Work in Progress' },
                    { id: 'Resolved', label: 'Resolved' }
                  ];

                  const statusRanks = {
                    Pending: 1,
                    'Under Review': 2,
                    Assigned: 3,
                    Accepted: 3,
                    'In Progress': 4,
                    Completed: 4,
                    Resolved: 5
                  };

                  const currentRank = statusRanks[trackedComplaint.complaint.status] || 1;

                  return (
                    <div className="grid grid-cols-5 gap-2 relative">
                      {stages.map((stage, idx) => {
                        const stageRank = idx + 1;
                        const isDone = currentRank >= stageRank;
                        const isCurrent = currentRank === stageRank;

                        return (
                          <div key={stage.id} className="flex flex-col items-center text-center">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-all ${
                                isDone
                                  ? 'bg-teal-600 text-white shadow'
                                  : 'bg-slate-200 text-slate-500'
                              } ${isCurrent ? 'ring-4 ring-teal-200 font-black' : ''}`}
                            >
                              {isDone ? <CheckCircle2 size={16} /> : idx + 1}
                            </div>
                            <span className={`text-[11px] font-semibold ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                              {stage.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* History Event Log */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-3 tracking-wider">
                  Audit History
                </h4>
                <div className="space-y-2">
                  {trackedComplaint.history?.map((h, i) => (
                    <div key={i} className="text-xs p-2.5 rounded bg-slate-50 border border-slate-200 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-800">
                          {h.previousStatus} → {h.newStatus}
                        </span>
                        {h.remarks && <p className="text-slate-500 mt-0.5">{h.remarks}</p>}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. NOTIFICATIONS VIEW */}
      {activeTab === 'notifications' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Notifications</h2>
              <p className="text-xs text-slate-500">Updates regarding your complaints and municipal action.</p>
            </div>
            <button onClick={handleMarkAllRead} className="btn alt text-xs">
              Mark All as Read
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No notifications at this time.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div
                  key={n._id}
                  className={`py-3 flex items-start gap-3 ${!n.read ? 'bg-teal-50/50 -mx-4 px-4 rounded' : ''}`}
                >
                  <Bell size={16} className={`mt-0.5 ${!n.read ? 'text-teal-600' : 'text-slate-400'}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. PROFILE VIEW */}
      {activeTab === 'profile' && (
        <div className="card max-w-lg space-y-4">
          <h2 className="text-base font-bold text-slate-900">Citizen Profile</h2>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                className="inp"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Read Only)</label>
              <input className="inp bg-slate-100 cursor-not-allowed" value={getUser()?.email} disabled />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                className="inp"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />
            </div>
            <button type="submit" className="btn">
              Save Profile Changes
            </button>
          </form>
        </div>
      )}

      {/* Complaint Detail Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-teal-800">
                    {selectedComplaint.complaintId}
                  </span>
                  <Badge v={selectedComplaint.priority} />
                  <Badge v={selectedComplaint.status} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">{selectedComplaint.title}</h3>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
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

            <div className="text-xs space-y-2 text-slate-700">
              <p><b>Description:</b> {selectedComplaint.description}</p>
              <p><b>Location:</b> {selectedComplaint.address} ({selectedComplaint.latitude?.toFixed(4)}, {selectedComplaint.longitude?.toFixed(4)})</p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <p><b>AI Summary:</b> {selectedComplaint.aiSummary}</p>
                <p><b>Priority Reason:</b> {selectedComplaint.priorityExplanation}</p>
                {selectedComplaint.actionBrief && (
                  <p><b>AI Action Brief:</b> {selectedComplaint.actionBrief}</p>
                )}
              </div>
              {selectedComplaint.completionRemarks && (
                <div className="bg-teal-50 p-3 rounded-lg border border-teal-200 text-teal-800">
                  <b>Worker Completion Remarks:</b> {selectedComplaint.completionRemarks}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between">
              <button
                onClick={() => {
                  setTrackIdInput(selectedComplaint.complaintId);
                  setActiveTab('track');
                  setSelectedComplaint(null);
                  handleTrack();
                }}
                className="btn alt text-xs"
              >
                <Crosshair size={13} /> View Timeline
              </button>
              <button onClick={() => setSelectedComplaint(null)} className="btn text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
