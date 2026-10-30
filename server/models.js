const mongoose = require('mongoose');
const { Schema } = mongoose;

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

const ref = (modelName) => ({ type: Schema.Types.ObjectId, ref: modelName });

const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, default: '' },
  role: { type: String, enum: ['citizen', 'admin', 'worker'], default: 'citizen' },
  department: { type: String, default: 'General' },
}, { timestamps: true });

const ComplaintSchema = new Schema({
  complaintId: { type: String, unique: true, index: true },
  citizen: { ...ref('User'), required: true },
  title: { type: String, required: true, maxlength: 140 },
  description: { type: String, required: true, maxlength: 3000 },
  imageUrl: { type: String, default: null },
  userCategory: { type: String, default: 'Other' },
  category: { type: String, enum: CATEGORIES, default: 'Other' },
  aiSummary: { type: String, default: '' },
  aiConfidence: { type: Number, default: 0.85 },
  priority: { type: String, enum: PRIORITIES, default: 'LOW' },
  priorityExplanation: { type: String, default: '' },
  priorityFactors: [{ type: String }],
  actionBrief: { type: String, default: '' },
  aiMode: { type: String, default: 'fallback-rules' }, // 'gemini' | 'fallback-rules' | 'seed-rules'
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  address: { type: String, default: 'Unspecified Address' },
  duplicateOf: ref('Complaint'),
  similarityScore: { type: Number, default: 0 },
  duplicateStatus: {
    type: String,
    enum: ['none', 'suspected', 'confirmed', 'dismissed'],
    default: 'none'
  },
  duplicateReason: { type: String, default: '' },
  possibleDuplicates: [{
    complaint: ref('Complaint'),
    score: Number,
    distanceM: Number,
    reason: String
  }],
  status: { type: String, enum: STATUSES, default: 'Pending', index: true },
  assignedWorker: ref('User'),
  adminRemarks: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  priorityOverride: {
    wasOverridden: { type: Boolean, default: false },
    originalPriority: { type: String },
    overrideReason: { type: String },
    overriddenBy: ref('User')
  },
  completionRemarks: { type: String, default: '' },
  completionImageUrl: { type: String, default: null },
}, { timestamps: true });

ComplaintSchema.index({ latitude: 1, longitude: 1 });
ComplaintSchema.index({ status: 1, priority: 1 });

const WorkerAssignmentSchema = new Schema({
  complaint: { ...ref('Complaint'), required: true },
  worker: { ...ref('User'), required: true },
  assignedBy: ref('User'),
  assignmentDate: { type: Date, default: Date.now },
  acceptedAt: Date,
  inProgressAt: Date,
  completedAt: Date,
  remarks: { type: String, default: '' },
  completionImage: { type: String, default: null },
}, { timestamps: true });

const NotificationSchema = new Schema({
  user: { ...ref('User'), required: true, index: true },
  complaint: ref('Complaint'),
  title: { type: String, default: 'Complaint Update' },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'warning', 'success', 'alert'], default: 'info' },
  read: { type: Boolean, default: false },
}, { timestamps: true });

const ComplaintHistorySchema = new Schema({
  complaint: { ...ref('Complaint'), required: true, index: true },
  previousStatus: { type: String, required: true },
  newStatus: { type: String, required: true },
  updatedBy: ref('User'),
  remarks: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Complaint = mongoose.model('Complaint', ComplaintSchema);
const WorkerAssignment = mongoose.model('WorkerAssignment', WorkerAssignmentSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const ComplaintHistory = mongoose.model('ComplaintHistory', ComplaintHistorySchema);

module.exports = {
  User,
  Complaint,
  WorkerAssignment,
  Notification,
  ComplaintHistory,
  CATEGORIES,
  STATUSES,
  PRIORITIES
};
