require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  User,
  Complaint,
  WorkerAssignment,
  Notification,
  ComplaintHistory,
  CATEGORIES,
  STATUSES,
  PRIORITIES
} = require('./models');

const { intake, hotspots, analyze, findDuplicates } = require('./ai');

const app = express();

// Security and middleware
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Local image storage
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^\w.-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e5)}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

// Async wrapper to catch errors
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
  });

const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};

// Authentication Middleware
const auth = (...allowedRoles) => (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
  if (!token) return res.status(401).json({ message: 'Authorization token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'civicai-secret-key-default');
    req.user = decoded;
  } catch (e) {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }

  if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: `Access denied. Role '${req.user.role}' not permitted.` });
  }

  next();
};

// Helper: send notification
const notify = async (userId, complaintId, title, message, type = 'info') => {
  try {
    return await Notification.create({
      user: userId,
      complaint: complaintId,
      title,
      message,
      type
    });
  } catch (err) {
    console.error('Failed to save notification:', err.message);
  }
};

// Helper: record history
const recordHistory = async (complaintId, prevStatus, newStatus, userId, remarks = '') => {
  try {
    return await ComplaintHistory.create({
      complaint: complaintId,
      previousStatus: prevStatus,
      newStatus,
      updatedBy: userId,
      remarks,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Failed to record history:', err.message);
  }
};

// Token generator
const generateAuthResponse = (user) => ({
  token: jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET || 'civicai-secret-key-default',
    { expiresIn: '7d' }
  ),
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || ''
  }
});

// ==========================================
// 1. AUTHENTICATION & DEMO ROUTES
// ==========================================

app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    throw fail(400, 'Name, email, and password are required.');
  }
  if (password.length < 6) {
    throw fail(400, 'Password must be at least 6 characters.');
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw fail(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: passwordHash,
    phone: phone || '',
    role: 'citizen' // Public registration is strictly citizen
  });

  res.status(201).json(generateAuthResponse(user));
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw fail(400, 'Email and password required');

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw fail(401, 'Invalid email or password.');
  }

  res.json(generateAuthResponse(user));
}));

app.get('/api/auth/me', auth(), wrap(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) throw fail(404, 'User not found');
  res.json(user);
}));

app.patch('/api/auth/profile', auth(), wrap(async (req, res) => {
  const { name, phone } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { ...(name && { name }), ...(phone !== undefined && { phone }) },
    { new: true }
  ).select('-password');
  res.json(user);
}));

// Quick Demo Login for instant hackathon evaluation
app.post('/api/auth/demo-login', wrap(async (req, res) => {
  const { role } = req.body;
  let targetEmail = 'admin@civicai.test';
  if (role === 'worker') targetEmail = 'worker1@civicai.test';
  if (role === 'citizen') targetEmail = 'citizen1@civicai.test';

  let user = await User.findOne({ email: targetEmail });
  if (!user) {
    // If not seeded yet, seed quickly
    await seedDatabaseInternal();
    user = await User.findOne({ email: targetEmail });
  }

  res.json(generateAuthResponse(user));
}));

// ==========================================
// 2. SEED DATA GENERATOR (INTERNAL & API)
// ==========================================

const SAMPLE_TEMPLATES = {
  'Road Damage': [
    'Deep dangerous pothole on {p} main road causing severe bike skidding and traffic jam',
    'Massive road crater near {p} intersection, car bumpers scraping daily',
    'Road surface cracked and broken near {p}, pedestrians tripping regularly',
    'Dangerous sunken asphalt trench at {p} after recent utility digging'
  ],
  Drainage: [
    'Open storm drainage beside {p} school footpath, extreme hazard for children',
    'Severely blocked drain at {p}, foul sewage water flooding the entire roadway',
    'Broken concrete manhole slab at {p}, foul stench and risk of stepping in',
    'Underground drainage overflow bubbling onto pavement at {p}'
  ],
  Waterlogging: [
    'Knee-deep stagnant rainwater at {p} after rain, blocking vehicle passage',
    'Submerged street at {p}, residents unable to exit gates without wading',
    'Heavy waterlogging at {p} curve, water entering storefronts',
    'Severe stagnant rain pool at {p} turning into mosquito breeding ground'
  ],
  Garbage: [
    'Massive overflowing garbage dump at {p} corner, waste spilled into roadway',
    'Rotting trash dumped along footpath at {p}, unbearable stench and stray animals',
    'Public municipal dustbin overturned at {p}, debris scattered across 50 meters',
    'Illegal construction debris and domestic garbage piled high at {p}'
  ],
  Streetlight: [
    'Complete blackout on {p} stretch, 6 consecutive streetlights dead',
    'Flickering streetlight and pitch-dark alley near {p} bus stop, unsafe at night',
    'Damaged lamp pole hanging precariously near {p}',
    'Broken LED luminaire at {p} junction leaving crossing completely dark'
  ],
  'Public Infrastructure': [
    'Exposed live electrical cable dangling from pole near {p} bus shelter',
    'Collapsed footpath slab with protruding rebar near {p}',
    'Damaged pedestrian crossing railing at {p} flyover entry',
    'Broken concrete bench and shattered glass in municipal park at {p}'
  ]
};

const BENGALURU_HOTSPOTS = [
  { p: 'Lakeview Circle, Koramangala', lat: 12.9352, lng: 77.6245, counts: [['Road Damage', 5], ['Drainage', 3], ['Waterlogging', 3]] },
  { p: 'Market Street, Chickpet', lat: 12.9800, lng: 77.5700, counts: [['Garbage', 6], ['Drainage', 3]] },
  { p: 'Green Park Gate, Indiranagar', lat: 12.9500, lng: 77.5900, counts: [['Streetlight', 4], ['Public Infrastructure', 2]] },
  { p: 'Silk Board Junction, Outer Ring Rd', lat: 12.9175, lng: 77.6234, counts: [['Road Damage', 4], ['Waterlogging', 2]] }
];

const CRITICAL_SAFETY_INCIDENTS = [
  {
    title: 'Open manhole near primary school gate',
    description: 'Completely open uncovered manhole beside Ward 12 primary school. A 7-year-old child nearly fell inside this morning. Extreme danger.',
    category: 'Drainage',
    lat: 12.9355,
    lng: 77.6249,
    address: 'Lakeview Circle, Koramangala'
  },
  {
    title: 'Live high-voltage electric wire hanging down',
    description: 'Electric wire sparking and dangling low at Green Park Gate bus shelter. Imminent electric shock hazard for commuters in the rain.',
    category: 'Public Infrastructure',
    lat: 12.9503,
    lng: 77.5902,
    address: 'Green Park Gate, Indiranagar'
  },
  {
    title: 'Severe two-wheeler accident at road crater',
    description: 'Yesterday night a motorcycle rider flipped over a 2-foot wide pothole on Market Street and was rushed to hospital. Road must be repaired immediately.',
    category: 'Road Damage',
    lat: 12.9803,
    lng: 77.5703,
    address: 'Market Street, Chickpet'
  }
];

async function seedDatabaseInternal() {
  await Promise.all([
    User.deleteMany({}),
    Complaint.deleteMany({}),
    WorkerAssignment.deleteMany({}),
    Notification.deleteMany({}),
    ComplaintHistory.deleteMany({})
  ]);

  const defaultPassword = await bcrypt.hash('Password@123', 10);

  // 1. Create Core Users
  const admin = await User.create({
    name: 'Asha Sharma (Municipal Commissioner)',
    email: 'admin@civicai.test',
    password: defaultPassword,
    phone: '+91 98450 11223',
    role: 'admin',
    department: 'Urban Development Authority'
  });

  const workerNames = [
    { name: 'Ramesh Kumar (Roads & Civil Works)', dep: 'Civil Works' },
    { name: 'Suresh Patil (Sanitation & Drainage)', dep: 'Sanitation' },
    { name: 'David Fernandes (Electrical & Lighting)', dep: 'Electrical' }
  ];

  const workers = await Promise.all(
    workerNames.map((w, idx) =>
      User.create({
        name: w.name,
        email: `worker${idx + 1}@civicai.test`,
        password: defaultPassword,
        phone: `+91 98765 4321${idx}`,
        role: 'worker',
        department: w.dep
      })
    )
  );

  const citizenNames = ['Priya Nair', 'Arun Swamy', 'Deepa Rao', 'Karthik Menon', 'Fatima Banu'];
  const citizens = await Promise.all(
    citizenNames.map((name, idx) =>
      User.create({
        name,
        email: `citizen${idx + 1}@civicai.test`,
        password: defaultPassword,
        phone: `+91 91234 5678${idx}`,
        role: 'citizen'
      })
    )
  );

  const jobsToCreate = [];

  // Hotspot Clusters
  BENGALURU_HOTSPOTS.forEach((spot) => {
    spot.counts.forEach(([cat, count]) => {
      for (let i = 0; i < count; i++) {
        const templateList = SAMPLE_TEMPLATES[cat];
        const text = templateList[i % templateList.length].replace('{p}', spot.p);
        const jitterLat = (Math.random() - 0.5) * 0.0012;
        const jitterLng = (Math.random() - 0.5) * 0.0012;
        jobsToCreate.push({
          title: text.split(',')[0],
          description: text,
          category: cat,
          latitude: spot.lat + jitterLat,
          longitude: spot.lng + jitterLng,
          address: spot.p
        });
      }
    });
  });

  // Critical Safety Incidents
  CRITICAL_SAFETY_INCIDENTS.forEach((item) => {
    jobsToCreate.push({
      title: item.title,
      description: item.description,
      category: item.category,
      latitude: item.lat,
      longitude: item.lng,
      address: item.address
    });
  });

  // Additional scattered citywide reports
  const allCatKeys = Object.keys(SAMPLE_TEMPLATES);
  for (let i = 0; i < 8; i++) {
    const cat = allCatKeys[i % allCatKeys.length];
    const wardName = `Ward ${i + 22}, Bengaluru East`;
    const text = SAMPLE_TEMPLATES[cat][0].replace('{p}', wardName);
    jobsToCreate.push({
      title: text.split(',')[0],
      description: text,
      category: cat,
      latitude: 12.91 + Math.random() * 0.11,
      longitude: 77.53 + Math.random() * 0.13,
      address: wardName
    });
  }

  // Create complaints with realistic workflow distribution
  const statusFlow = ['Pending', 'Under Review', 'Assigned', 'Accepted', 'In Progress', 'Completed', 'Resolved'];
  let countCreated = 0;

  for (let i = 0; i < jobsToCreate.length; i++) {
    const job = jobsToCreate[i];
    const citizen = citizens[i % citizens.length];

    const complaint = await intake(job, citizen._id, { offline: true });
    const targetStatus = statusFlow[i % statusFlow.length];

    if (targetStatus !== 'Pending') {
      const assignedWorker = workers[i % workers.length];
      complaint.status = targetStatus;
      complaint.assignedWorker = assignedWorker._id;

      if (['Completed', 'Resolved'].includes(targetStatus)) {
        complaint.completionRemarks = 'Work successfully inspected and repaired by municipal field squad.';
      }

      await complaint.save();

      await WorkerAssignment.create({
        complaint: complaint._id,
        worker: assignedWorker._id,
        assignedBy: admin._id,
        assignmentDate: new Date(Date.now() - 86400000 * 2),
        ...( ['Accepted', 'In Progress', 'Completed', 'Resolved'].includes(targetStatus) && { acceptedAt: new Date(Date.now() - 86400000) }),
        ...( ['In Progress', 'Completed', 'Resolved'].includes(targetStatus) && { inProgressAt: new Date(Date.now() - 43200000) }),
        ...( ['Completed', 'Resolved'].includes(targetStatus) && { completedAt: new Date(), remarks: complaint.completionRemarks })
      });

      await recordHistory(complaint._id, 'Pending', targetStatus, admin._id, 'Seeded workflow stage');
    }

    countCreated++;
  }

  // Welcome notifications
  await notify(admin._id, null, 'System Initialized', `CivicAI loaded with ${countCreated} civic reports ready for triage.`, 'info');

  return { usersCount: 9, complaintsCount: countCreated };
}

app.post('/api/seed', wrap(async (req, res) => {
  const result = await seedDatabaseInternal();
  res.json({
    success: true,
    message: `Database successfully seeded with ${result.complaintsCount} complaints across 4 Bangalore hotspots!`,
    details: result
  });
}));

app.get('/api/seed/status', wrap(async (req, res) => {
  const [complaintsCount, usersCount] = await Promise.all([
    Complaint.countDocuments(),
    User.countDocuments()
  ]);
  res.json({ complaintsCount, usersCount, isSeeded: complaintsCount > 0 });
}));

// ==========================================
// 3. COMPLAINTS API
// ==========================================

const handleUpload = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    upload.single('image')(req, res, next);
  } else {
    next();
  }
};

// Submit a new complaint (Citizen)
app.post('/api/complaints', auth('citizen'), handleUpload, wrap(async (req, res) => {
  const { title, description, category, address } = req.body;
  const latitude = parseFloat(req.body.latitude);
  const longitude = parseFloat(req.body.longitude);

  if (!title || !description || isNaN(latitude) || isNaN(longitude)) {
    throw fail(400, 'Title, description, and valid map coordinates are required.');
  }

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const imageDiskPath = req.file ? req.file.path : null;

  const complaint = await intake(
    {
      title: title.trim(),
      description: description.trim(),
      category: category || 'Other',
      address: address?.trim() || 'Selected map location',
      latitude,
      longitude,
      imageUrl,
      imagePath: imageDiskPath
    },
    req.user.id
  );

  // Notify citizen
  await notify(
    req.user.id,
    complaint._id,
    'Complaint Received',
    `Complaint ${complaint.complaintId} logged. AI categorized as '${complaint.category}' (${complaint.priority} priority).`,
    complaint.priority === 'HIGH' ? 'warning' : 'info'
  );

  // Record initial history
  await recordHistory(complaint._id, 'None', 'Pending', req.user.id, 'Citizen submission');

  // Notify admins if high priority
  if (complaint.priority === 'HIGH') {
    const admins = await User.find({ role: 'admin' });
    for (const a of admins) {
      await notify(
        a._id,
        complaint._id,
        'High Priority Alert',
        `Urgent hazard reported: ${complaint.title} at ${complaint.address}.`,
        'alert'
      );
    }
  }

  res.status(201).json(complaint);
}));

// Query complaints with filtering & role scoping
app.get('/api/complaints', auth(), wrap(async (req, res) => {
  const { category, priority, status, duplicateStatus, search, sort = '-createdAt' } = req.query;

  const filter = {};

  // Role scoping
  if (req.user.role === 'citizen') {
    filter.citizen = req.user.id;
  } else if (req.user.role === 'worker') {
    filter.assignedWorker = req.user.id;
  }

  if (category) filter.category = category;
  if (priority) filter.priority = priority;
  if (status) filter.status = status;
  if (duplicateStatus) filter.duplicateStatus = duplicateStatus;

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { title: regex },
      { description: regex },
      { complaintId: regex },
      { address: regex }
    ];
  }

  const complaints = await Complaint.find(filter)
    .populate('citizen', 'name email phone')
    .populate('assignedWorker', 'name email department phone')
    .populate('possibleDuplicates.complaint', 'complaintId title category status priority latitude longitude address')
    .populate('duplicateOf', 'complaintId title category status')
    .sort(sort);

  res.json(complaints);
}));

// Public/Citizen tracking by Complaint ID
app.get('/api/complaints/track/:complaintId', wrap(async (req, res) => {
  const { complaintId } = req.params;
  const complaint = await Complaint.findOne({ complaintId: complaintId.trim().toUpperCase() })
    .populate('citizen', 'name')
    .populate('assignedWorker', 'name department');

  if (!complaint) {
    throw fail(404, `No complaint found with ID '${complaintId}'.`);
  }

  const history = await ComplaintHistory.find({ complaint: complaint._id })
    .populate('updatedBy', 'name role')
    .sort('timestamp');

  res.json({ complaint, history });
}));

// Get single complaint details
app.get('/api/complaints/:id', auth(), wrap(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id)
    .populate('citizen', 'name email phone')
    .populate('assignedWorker', 'name email department phone')
    .populate('possibleDuplicates.complaint', 'complaintId title category status priority address')
    .populate('duplicateOf', 'complaintId title category status');

  if (!complaint) throw fail(404, 'Complaint not found');

  const history = await ComplaintHistory.find({ complaint: complaint._id })
    .populate('updatedBy', 'name role')
    .sort('timestamp');

  res.json({ complaint, history });
}));

// Admin assign worker
app.patch('/api/complaints/:id/assign', auth('admin'), wrap(async (req, res) => {
  const { workerId, remarks } = req.body;
  const complaint = await Complaint.findById(req.params.id);
  const worker = await User.findOne({ _id: workerId, role: 'worker' });

  if (!complaint) throw fail(404, 'Complaint not found');
  if (!worker) throw fail(404, 'Worker not found');

  if (complaint.duplicateStatus === 'suspected') {
    throw fail(409, 'Please review the suspected duplicate status (confirm or dismiss) before assigning work.');
  }

  const prevStatus = complaint.status;
  complaint.assignedWorker = worker._id;
  complaint.status = 'Assigned';
  complaint.adminRemarks = remarks || complaint.adminRemarks;
  await complaint.save();

  await WorkerAssignment.create({
    complaint: complaint._id,
    worker: worker._id,
    assignedBy: req.user.id,
    remarks: remarks || ''
  });

  await recordHistory(complaint._id, prevStatus, 'Assigned', req.user.id, `Assigned to worker ${worker.name}`);

  // Notify worker
  await notify(
    worker._id,
    complaint._id,
    'New Task Assigned',
    `You have been assigned complaint ${complaint.complaintId}: "${complaint.title}".`,
    'info'
  );

  // Notify citizen
  await notify(
    complaint.citizen,
    complaint._id,
    'Worker Assigned',
    `A municipal field officer (${worker.name}) has been assigned to address your report ${complaint.complaintId}.`,
    'info'
  );

  res.json(complaint);
}));

// Admin duplicate action (confirm / dismiss)
app.patch('/api/complaints/:id/duplicate', auth('admin'), wrap(async (req, res) => {
  const { action, originalId } = req.body; // action: 'confirm' | 'dismiss'
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw fail(404, 'Complaint not found');

  const prevStatus = complaint.duplicateStatus;
  complaint.duplicateStatus = action === 'confirm' ? 'confirmed' : 'dismissed';
  if (action === 'confirm' && originalId) {
    complaint.duplicateOf = originalId;
  }
  await complaint.save();

  await recordHistory(
    complaint._id,
    complaint.status,
    complaint.status,
    req.user.id,
    `Admin ${action === 'confirm' ? 'confirmed' : 'dismissed'} duplicate suggestion.`
  );

  res.json(complaint);
}));

// Admin override priority
app.patch('/api/complaints/:id/priority', auth('admin'), wrap(async (req, res) => {
  const { priority, reason } = req.body;
  if (!PRIORITIES.includes(priority)) throw fail(400, 'Invalid priority level');

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw fail(404, 'Complaint not found');

  const originalPriority = complaint.priority;
  complaint.priorityOverride = {
    wasOverridden: true,
    originalPriority,
    overrideReason: reason || 'Manual administrative adjustment',
    overriddenBy: req.user.id
  };
  complaint.priority = priority;
  await complaint.save();

  await recordHistory(
    complaint._id,
    complaint.status,
    complaint.status,
    req.user.id,
    `Priority changed from ${originalPriority} to ${priority}. Reason: ${reason || 'Admin discretion'}`
  );

  res.json(complaint);
}));

// Admin reject complaint
app.patch('/api/complaints/:id/reject', auth('admin'), wrap(async (req, res) => {
  const { reason } = req.body;
  if (!reason) throw fail(400, 'Rejection reason is required.');

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw fail(404, 'Complaint not found');

  const prevStatus = complaint.status;
  complaint.status = 'Rejected';
  complaint.rejectionReason = reason;
  await complaint.save();

  await recordHistory(complaint._id, prevStatus, 'Rejected', req.user.id, reason);

  await notify(
    complaint.citizen,
    complaint._id,
    'Complaint Rejected',
    `Your complaint ${complaint.complaintId} was rejected. Reason: ${reason}`,
    'warning'
  );

  res.json(complaint);
}));

// Status updates (Worker & Admin)
const VALID_WORKER_TRANSITIONS = {
  Assigned: ['Accepted'],
  Accepted: ['In Progress'],
  'In Progress': ['Completed']
};

app.patch('/api/complaints/:id/status', auth('admin', 'worker'), upload.single('completionImage'), wrap(async (req, res) => {
  const { status, remarks } = req.body;
  const complaint = await Complaint.findById(req.params.id);

  if (!complaint || !STATUSES.includes(status)) {
    throw fail(400, 'Invalid status update request');
  }

  if (req.user.role === 'worker') {
    if (String(complaint.assignedWorker) !== req.user.id) {
      throw fail(403, 'You are not assigned to this complaint');
    }
    const allowed = VALID_WORKER_TRANSITIONS[complaint.status] || [];
    if (!allowed.includes(status)) {
      throw fail(400, `Cannot advance task from '${complaint.status}' to '${status}'. Expected: ${allowed.join(', ') || 'None'}`);
    }
    if (status === 'Completed' && !remarks && !complaint.completionRemarks) {
      throw fail(400, 'Completion remarks are required when marking a task completed.');
    }
  }

  const prevStatus = complaint.status;
  complaint.status = status;
  if (remarks) complaint.completionRemarks = remarks;
  if (req.file) complaint.completionImageUrl = `/uploads/${req.file.filename}`;

  await complaint.save();

  // Update WorkerAssignment timestamp
  const assignmentUpdate = {};
  if (status === 'Accepted') assignmentUpdate.acceptedAt = new Date();
  if (status === 'In Progress') assignmentUpdate.inProgressAt = new Date();
  if (status === 'Completed') {
    assignmentUpdate.completedAt = new Date();
    assignmentUpdate.remarks = remarks || '';
    if (req.file) assignmentUpdate.completionImage = `/uploads/${req.file.filename}`;
  }

  if (Object.keys(assignmentUpdate).length > 0) {
    await WorkerAssignment.findOneAndUpdate(
      { complaint: complaint._id, worker: complaint.assignedWorker },
      assignmentUpdate,
      { sort: { createdAt: -1 } }
    );
  }

  await recordHistory(
    complaint._id,
    prevStatus,
    status,
    req.user.id,
    remarks || `Status transitioned to ${status}`
  );

  // Notify citizen
  await notify(
    complaint.citizen,
    complaint._id,
    `Status Updated: ${status}`,
    `Complaint ${complaint.complaintId} is now marked as "${status}".${remarks ? ` Note: ${remarks}` : ''}`,
    status === 'Resolved' ? 'success' : 'info'
  );

  // If worker completed, notify admin to verify & resolve
  if (status === 'Completed' && req.user.role === 'worker') {
    const admins = await User.find({ role: 'admin' });
    for (const a of admins) {
      await notify(
        a._id,
        complaint._id,
        'Work Completed - Verification Required',
        `Worker marked complaint ${complaint.complaintId} as Completed. Ready for admin verification.`,
        'info'
      );
    }
  }

  res.json(complaint);
}));

// ==========================================
// 4. ADMIN INSIGHTS & ANALYTICS
// ==========================================

app.get('/api/admin/stats', auth('admin'), wrap(async (req, res) => {
  const allComplaints = await Complaint.find();
  const allWorkers = await User.find({ role: 'worker' });

  const total = allComplaints.length;
  const pending = allComplaints.filter((c) => c.status === 'Pending').length;
  const inProgress = allComplaints.filter((c) => ['Assigned', 'Accepted', 'In Progress'].includes(c.status)).length;
  const completed = allComplaints.filter((c) => c.status === 'Completed').length;
  const resolved = allComplaints.filter((c) => c.status === 'Resolved').length;
  const rejected = allComplaints.filter((c) => c.status === 'Rejected').length;
  const highPriority = allComplaints.filter((c) => c.priority === 'HIGH' && c.status !== 'Resolved').length;
  const duplicates = allComplaints.filter((c) => c.duplicateStatus === 'suspected').length;

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Category Breakdown
  const byCategory = {};
  CATEGORIES.forEach((c) => { byCategory[c] = 0; });
  allComplaints.forEach((c) => {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
  });

  // Priority Breakdown
  const byPriority = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  allComplaints.forEach((c) => {
    if (byPriority[c.priority] !== undefined) byPriority[c.priority]++;
  });

  // Status Breakdown
  const byStatus = {};
  STATUSES.forEach((s) => { byStatus[s] = 0; });
  allComplaints.forEach((c) => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  });

  // Hotspots detection
  const detectedHotspots = hotspots(allComplaints);

  // Daily trend (last 7 days)
  const now = new Date();
  const dailyTrends = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const dateStr = day.toISOString().slice(0, 10);
    const count = allComplaints.filter((c) => {
      const cDate = new Date(c.createdAt).toISOString().slice(0, 10);
      return cDate === dateStr;
    }).length;
    dailyTrends.push({ date: dateStr, complaints: count });
  }

  res.json({
    total,
    pending,
    inProgress,
    completed,
    resolved,
    rejected,
    highPriority,
    duplicates,
    workersCount: allWorkers.length,
    resolutionRate,
    byCategory,
    byPriority,
    byStatus,
    hotspots: detectedHotspots,
    dailyTrends
  });
}));

// Admin get workers with task load
app.get('/api/admin/workers', auth('admin'), wrap(async (req, res) => {
  const workers = await User.find({ role: 'worker' }).select('name email phone department createdAt');
  const complaints = await Complaint.find({ assignedWorker: { $ne: null } });

  const workerStats = workers.map((w) => {
    const assigned = complaints.filter((c) => String(c.assignedWorker) === String(w._id));
    const activeTasks = assigned.filter((c) => ['Assigned', 'Accepted', 'In Progress'].includes(c.status)).length;
    const completedTasks = assigned.filter((c) => ['Completed', 'Resolved'].includes(c.status)).length;
    return {
      _id: w._id,
      name: w.name,
      email: w.email,
      phone: w.phone,
      department: w.department,
      activeTasks,
      completedTasks,
      totalAssigned: assigned.length
    };
  });

  res.json(workerStats);
}));

// ==========================================
// 5. NOTIFICATIONS
// ==========================================

app.get('/api/notifications', auth(), wrap(async (req, res) => {
  const notifications = await Notification.find({ user: req.user.id })
    .sort('-createdAt')
    .limit(30);
  res.json(notifications);
}));

app.patch('/api/notifications/:id/read', auth(), wrap(async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { read: true });
  res.json({ success: true });
}));

app.post('/api/notifications/read-all', auth(), wrap(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ success: true });
}));

// ==========================================
// 6. HEALTH & STATUS
// ==========================================

app.get('/api/health', wrap(async (req, res) => {
  const complaintsCount = await Complaint.countDocuments();
  res.json({
    ok: true,
    platform: 'CivicAI - Smart Civic Complaint Management System',
    timestamp: new Date(),
    aiMode: process.env.GEMINI_API_KEY ? 'gemini' : 'fallback-rules (no GEMINI_API_KEY in .env)',
    complaintsCount
  });
}));

// Serve React frontend in production (built into server/public by render.yaml buildCommand)
const publicDir = path.join(__dirname, 'public');
if (process.env.NODE_ENV === 'production' && fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // For any non-API route, return the React app (SPA fallback)
  app.get('*', (_, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend not found. Please check build.');
    }
  });
} else {
  // Development fallback
  app.get('/', (_, res) => res.send('CivicAI API Server Running. Open frontend at http://localhost:5173'));
}

// Server Launch
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/civicai';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log(`Connected to MongoDB: ${MONGO_URI}`);
    // Check if empty, auto-seed for convenience
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('Database is empty. Auto-seeding initial synthetic data...');
      await seedDatabaseInternal();
      console.log('Auto-seed completed.');
    }

    app.listen(PORT, () => {
      console.log(`CivicAI Server listening on port ${PORT}`);
      console.log(`AI Engine mode: ${process.env.GEMINI_API_KEY ? 'Gemini 2.0 API' : 'FALLBACK RULES HEURISTICS'}`);
    });
  })
  .catch((err) => {
    console.error('Fatal MongoDB Connection Error:', err.message);
    process.exit(1);
  });
