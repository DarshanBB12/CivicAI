import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, CheckSquare, FileText, CheckCircle2,
  Bell, User as UserIcon, MapPin, Camera, Sparkles, AlertTriangle,
  Play, Check, ChevronRight, Upload
} from 'lucide-react';
import api, { toast, err } from './api';
import { Shell, Badge, getUser } from './App';
import { ComplaintMap } from './MapView';

const WORKER_STEPS = {
  Assigned: { next: 'Accepted', label: 'Accept Assignment', icon: CheckSquare, color: 'bg-indigo-600' },
  Accepted: { next: 'In Progress', label: 'Start On-Site Work', icon: Play, color: 'bg-amber-600' },
  'In Progress': { next: 'Completed', label: 'Mark Task Completed', icon: Check, color: 'bg-teal-600' }
};

export default function Worker() {
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Completion workflow state
  const [selectedTask, setSelectedTask] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [completionImage, setCompletionImage] = useState(null);
  const [completingTaskId, setCompletingTaskId] = useState(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([api.get('/complaints'), api.get('/notifications')])
      .then(([taskRes, noteRes]) => {
        setTasks(taskRes.data);
        setNotifications(noteRes.data);
      })
      .catch((e) => err(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusTransition = async (complaint, targetStatus) => {
    try {
      const formData = new FormData();
      formData.append('status', targetStatus);

      if (targetStatus === 'Completed') {
        const text = remarks[complaint._id];
        if (!text) {
          return toast('Please enter work completion remarks.', 'bad');
        }
        formData.append('remarks', text);
        if (completionImage) {
          formData.append('completionImage', completionImage);
        }
      }

      await api.patch(`/complaints/${complaint._id}/status`, formData);
      toast(`Task ${complaint.complaintId} updated to ${targetStatus}!`);
      setCompletingTaskId(null);
      setCompletionImage(null);
      loadData();
    } catch (e) {
      err(e);
    }
  };

  // Metrics
  const totalAssigned = tasks.length;
  const pendingAcceptance = tasks.filter((t) => t.status === 'Assigned').length;
  const inProgress = tasks.filter((t) => ['Accepted', 'In Progress'].includes(t.status)).length;
  const completed = tasks.filter((t) => ['Completed', 'Resolved'].includes(t.status)).length;

  const activeTasks = tasks.filter((t) => !['Completed', 'Resolved', 'Rejected'].includes(t.status));
  const completedTasks = tasks.filter((t) => ['Completed', 'Resolved'].includes(t.status));

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'tasks',
      label: 'My Assigned Tasks',
      icon: CheckSquare,
      badge: activeTasks.length
    },
    { id: 'completed', label: 'Completed Tasks', icon: CheckCircle2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Worker Profile', icon: UserIcon }
  ];

  return (
    <Shell
      title={navItems.find((n) => n.id === activeTab)?.label || 'Field Worker'}
      navItems={navItems}
      activeNav={activeTab}
      onNavChange={setActiveTab}
    >
      {/* 1. DASHBOARD VIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-slate-900 to-teal-900 rounded-xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Field Officer: {getUser()?.name}</h2>
              <p className="text-teal-200 text-sm mt-1">
                View your active assignments, update on-site progress, and document resolutions.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('tasks')}
              className="btn bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold"
            >
              View Active Tasks ({activeTasks.length})
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card border-l-4 border-l-indigo-600">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Tasks</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{totalAssigned}</div>
            </div>
            <div className="card border-l-4 border-l-slate-400">
              <span className="text-xs font-semibold text-slate-500 uppercase">Pending Acceptance</span>
              <div className="text-2xl font-bold text-slate-700 mt-1">{pendingAcceptance}</div>
            </div>
            <div className="card border-l-4 border-l-amber-500">
              <span className="text-xs font-semibold text-slate-500 uppercase">In Progress</span>
              <div className="text-2xl font-bold text-amber-700 mt-1">{inProgress}</div>
            </div>
            <div className="card border-l-4 border-l-emerald-600">
              <span className="text-xs font-semibold text-slate-500 uppercase">Completed</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{completed}</div>
            </div>
          </div>

          {/* Quick Task Map */}
          <div className="card h-96 p-1">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Active Field Task Locations</h3>
              <span className="text-xs text-slate-500">{activeTasks.length} Assigned Locations</span>
            </div>
            <ComplaintMap complaints={activeTasks} />
          </div>
        </div>
      )}

      {/* 2. MY ASSIGNED TASKS VIEW */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Active Field Assignments</h3>
              <p className="text-xs text-slate-500">
                Advance each task from Acceptance to In Progress and final Completion.
              </p>
            </div>
            <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
              {activeTasks.length} Active Tasks
            </span>
          </div>

          {activeTasks.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 text-xs">
              No pending tasks assigned right now. Good work!
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {activeTasks.map((c) => {
                const step = WORKER_STEPS[c.status];
                const isCompleting = completingTaskId === c._id;

                return (
                  <div
                    key={c._id}
                    className={`card flex flex-col justify-between space-y-3 ${
                      c.priority === 'HIGH' ? 'border-l-4 border-l-red-600' : 'border-l-4 border-l-teal-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-teal-800">{c.complaintId}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge v={c.priority} />
                          <Badge v={c.status} />
                        </div>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm mb-1">{c.title}</h4>
                      <p className="text-xs text-slate-600 mb-2">{c.description}</p>

                      {c.imageUrl && (
                        <img
                          src={c.imageUrl}
                          alt="Citizen uploaded"
                          className="h-32 w-full object-cover rounded-md mb-2"
                        />
                      )}

                      <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs space-y-1 mb-2">
                        <div className="flex items-center gap-1 text-slate-500">
                          <MapPin size={12} className="text-teal-700" />
                          <b>Location:</b> {c.address}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Coordinates: {c.latitude?.toFixed(4)}, {c.longitude?.toFixed(4)}
                        </div>
                        {c.actionBrief && (
                          <div className="pt-1 border-t text-teal-900 font-medium">
                            <b>AI Action Directive:</b> {c.actionBrief}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Worker Action Area */}
                    <div className="pt-3 border-t border-slate-100">
                      {c.status === 'In Progress' && !isCompleting && (
                        <button
                          onClick={() => setCompletingTaskId(c._id)}
                          className="btn w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                        >
                          <Check size={14} /> Submit Completion Report
                        </button>
                      )}

                      {c.status === 'In Progress' && isCompleting && (
                        <div className="space-y-2.5 bg-teal-50/50 p-3 rounded-lg border border-teal-200">
                          <label className="text-xs font-bold text-teal-950 block">
                            Work Completion Remarks (Required)
                          </label>
                          <input
                            className="inp text-xs"
                            placeholder="e.g. Cleared 2 tons of debris and flushed stormwater pipe..."
                            value={remarks[c._id] || ''}
                            onChange={(e) => setRemarks({ ...remarks, [c._id]: e.target.value })}
                            required
                          />

                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                              Attach Completion Photo (Optional)
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              className="text-xs text-slate-500"
                              onChange={(e) => setCompletionImage(e.target.files[0])}
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStatusTransition(c, 'Completed')}
                              className="btn btn-sm bg-teal-700 text-white font-bold"
                            >
                              Finalize & Mark Completed
                            </button>
                            <button
                              onClick={() => setCompletingTaskId(null)}
                              className="btn btn-sm alt"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {step && c.status !== 'In Progress' && (
                        <button
                          onClick={() => handleStatusTransition(c, step.next)}
                          className={`btn w-full ${step.color} hover:opacity-90 text-white font-bold text-xs`}
                        >
                          <step.icon size={14} /> {step.label}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. COMPLETED TASKS VIEW */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-slate-900 text-base mb-1">Resolved & Completed History</h3>
            <p className="text-xs text-slate-500 mb-4">
              Archive of all work items executed and documented by your unit.
            </p>

            <div className="divide-y divide-slate-100">
              {completedTasks.map((c) => (
                <div key={c._id} className="py-3 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-teal-800">{c.complaintId}</span>
                      <Badge v={c.category} />
                      <Badge v={c.status} />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{c.title}</h4>
                    <p className="text-slate-500 mt-0.5">{c.address}</p>
                    {c.completionRemarks && (
                      <p className="text-teal-800 font-medium mt-1 bg-teal-50 p-2 rounded">
                        <b>Resolution Note:</b> {c.completionRemarks}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 text-slate-400 font-mono text-[11px]">
                    Completed
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. NOTIFICATIONS VIEW */}
      {activeTab === 'notifications' && (
        <div className="card space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Task Assignments & Updates</h3>
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div key={n._id} className="py-2.5 flex items-start gap-3 text-xs">
                <Bell size={15} className="text-teal-600 mt-0.5" />
                <div>
                  <h5 className="font-bold text-slate-900">{n.title}</h5>
                  <p className="text-slate-600 mt-0.5">{n.message}</p>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. PROFILE VIEW */}
      {activeTab === 'profile' && (
        <div className="card max-w-md space-y-3">
          <h3 className="font-bold text-slate-900 text-base">Worker Profile</h3>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-500 block">Name:</span>
              <b className="text-slate-900">{getUser()?.name}</b>
            </div>
            <div>
              <span className="text-slate-500 block">Email:</span>
              <b className="text-slate-900">{getUser()?.email}</b>
            </div>
            <div>
              <span className="text-slate-500 block">Role:</span>
              <Badge v="worker" />
            </div>
            <div>
              <span className="text-slate-500 block">Completed Tasks:</span>
              <b className="text-emerald-700">{completedTasks.length} Tasks</b>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
