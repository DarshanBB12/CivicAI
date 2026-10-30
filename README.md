# CivicAI: From Citizen Complaints to Intelligent Action
> **PromptWars x ASTRA | AI for Civic Impact | Official Problem Statement Solution**  
> An enterprise-grade full-stack civic complaint management platform that transforms scattered citizen reports into prioritized, explainable, and trackable action.

---

## Table of Contents
1. [Executive Summary & Problem Statement](#executive-summary--problem-statement)
2. [Key Capabilities & AI Engine](#key-capabilities--ai-engine)
3. [Technology Stack](#technology-stack)
4. [User Roles & Dashboard Experiences](#user-roles--dashboard-experiences)
5. [End-to-End Complaint Lifecycle](#end-to-end-complaint-lifecycle)
6. [Architecture & System Design](#architecture--system-design)
7. [Database Schema (MongoDB)](#database-schema-mongodb)
8. [REST API Documentation](#rest-api-documentation)
9. [Environment Setup & Installation](#environment-setup--installation)
10. [Automated Verification & Test Suite](#automated-verification--test-suite)
11. [5-Minute Live Hackathon Demonstration Script](#5-minute-live-hackathon-demonstration-script)
12. [Limitations, Honesty & Future Roadmap](#limitations-honesty--future-roadmap)

---

## Executive Summary & Problem Statement

Every day, communities face waterlogging, damaged roads, overflowing waste bins, broken streetlights, and disrupted public services. Reports reach authorities through calls, messages, social media, and walk-ins. The same issue is often reported ten times, urgent hazards sit in the same queue as routine requests, and decision-makers cannot tell what needs attention first. Citizens rarely see what happened to their complaint.

**CivicAI solves this four-stage lifecycle**:
1. **Capture**: Sub-minute citizen reporting with interactive map pin drops, GPS geolocation, category selection, and photo upload.
2. **Understand**: Multi-model AI categorization, short summary extraction, spatial duplicate detection (180m radius + text overlap), and explainable safety prioritization.
3. **Reveal**: Interactive GIS map displaying priority-colored markers, cluster density rings (~380m radius), and proactive infrastructure action recommendations.
4. **Act**: Complete closed-loop workflow: Citizen submission $\rightarrow$ AI triage $\rightarrow$ Admin duplicate review $\rightarrow$ Worker dispatch $\rightarrow$ On-site acceptance/progress $\rightarrow$ Completion remarks $\rightarrow$ Admin verification $\rightarrow$ Live citizen timeline tracking.

---

## Key Capabilities & AI Engine

CivicAI operates with a **dual-mode AI engine** (Backend-only; API keys are never exposed to the frontend):

### 1. Automatic Categorization & Problem Extraction
- **Input**: Complaint title, description, and optional photo.
- **Output**: Validated category (`Road Damage`, `Waterlogging`, `Garbage`, `Drainage`, `Streetlight`, `Public Infrastructure`, `Other`), concise 1-sentence administrator summary, and confidence score.

### 2. Explainable Priority Detection
- Prioritization is evaluated across **five objective factors**:
  1. *Public safety risk* (imminent danger, live wire, open manhole, traffic accidents)
  2. *Vulnerable population proximity* (schools, hospitals, bus shelters)
  3. *Community disruption* (traffic gridlock, commute delay)
  4. *Sanitation & health hazards* (sewage overflow, stagnant water, mosquito breeding)
  5. *Persistence & severity*
- Evaluates levels: `HIGH`, `MEDIUM`, `LOW`.
- Generates plain-language reasoning explaining **why** the complaint was assigned that priority.

### 3. Spatial Duplicate Detection (No LLM hallucinations)
- Computes weighted similarity against open complaints in the same category:
  $$\text{Score} = 0.6 \times \text{Jaccard Similarity}(\text{tokens}_A, \text{tokens}_B) + 0.4 \times \left(1 - \frac{\text{Distance (m)}}{180}\right)$$
- If distance $\le 180\text{m}$ and $\text{Score} \ge 0.38$, flagged as `suspected` duplicate.
- **Administrative Gate**: Admins must confirm or dismiss the duplicate before field dispatch to prevent duplicate crew deployments.

### 4. Automated Action Briefs
- Generates an executive directive for decision-makers:
  *Example*: *"Deploy emergency suction truck and secure exposed drain/manhole with high-visibility barricade immediately."*

### 5. Density-Based Geographic Hotspot Clustering
- Aggregates active complaints into ~380m spatial grid buckets.
- Detects areas with $\ge 3$ active incidents and highlights them on the interactive Leaflet map with purple perimeter rings, identifying primary category clusters and emergency safety warnings.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS v4, React Router DOM 6, Axios, Lucide React, Recharts, Leaflet, React-Leaflet |
| **Backend** | Node.js, Express.js, REST API, JSON Web Tokens (JWT), bcryptjs, Multer (Local & Cloud image pipeline), Helmet, CORS |
| **Database** | MongoDB & Mongoose ODM (Indexes on geospatial coordinates and query statuses) |
| **AI Integration** | Google Gemini 2.0 Flash REST API + Built-in Heuristic Rule Engine Fallback |
| **Maps & GIS** | Leaflet with OpenStreetMap tiles (Custom priority circle markers, Hotspot density buffers) |

---

## User Roles & Dashboard Experiences

### 1. Citizen Portal
- **Dashboard**: Metric cards (Total reports, Pending, In Progress, Resolved), complaint status chart, recent reports.
- **Report a Problem**: Sub-60-second form with auto-GPS or map pin drop, category selector, photo upload, and instant AI feedback card upon submission.
- **My Complaints**: Searchable and filterable list with full details modal.
- **Track Complaint**: Live 5-stage timeline (`Submitted` $\rightarrow$ `Under Review` $\rightarrow$ `Assigned` $\rightarrow$ `In Progress` $\rightarrow$ `Resolved`) with status transition timestamps and worker remarks.
- **Notifications**: In-app alerts for status updates and field assignments.
- **Profile**: Manage citizen contact details.

### 2. Government Admin Portal
- **Overview**: Real-time KPI metrics, Category Distribution bar chart, Priority breakdown donut chart, 7-Day Influx trend chart.
- **All Complaints**: Comprehensive table with category, priority, status, and search filters.
- **Priority Queue**: Filtered view of urgent HIGH priority hazards with AI safety factors.
- **Duplicate Reports**: Side-by-side comparison of suspected duplicates with distance (meters), match score %, and confirm/dismiss actions.
- **Hotspot Map**: Interactive citywide map featuring color-coded priority pins and purple cluster density rings.
- **Worker Fleet**: Worker workload management and task distribution.
- **Assignments**: Stage tracking of all dispatched maintenance squads.
- **Analytics**: Citywide resolution efficiency and hotspot summaries.
- **Settings & Demo Reset**: Real-time AI mode inspection and 1-click dataset re-seeding button.

### 3. Field Worker Portal
- **Dashboard**: Task load summary (Assigned, Accepted, In Progress, Completed).
- **My Assigned Tasks**: Structured workflow:
  1. `Accept Assignment` ($\rightarrow$ Accepted)
  2. `Start On-Site Work` ($\rightarrow$ In Progress)
  3. `Submit Completion Report` ($\rightarrow$ Completed with mandatory remarks & completion photo)
- **Completed Tasks**: History archive of resolved municipal interventions.
- **Notifications**: Instant dispatch alerts.

---

## End-to-End Complaint Lifecycle

```
[ Citizen ] ──( 1. Submits Complaint + Pin + Photo )──> [ Backend API ]
                                                              │
                                            ┌─────────────────┴─────────────────┐
                                            ▼                                   ▼
                                   [ AI Categorization &              [ Spatial Duplicate Check ]
                                   Priority Detection ]               (Haversine Distance <= 180m)
                                            │                                   │
                                            └─────────────────┬─────────────────┘
                                                              ▼
                                                   [ Saved in MongoDB ]
                                                              │
                                                              ▼
[ Admin Dashboard ] <───────────────( 2. Triage & Review Suspected Duplicates )
        │
        ├──────( 3. Assigns Field Worker )──────> [ Field Worker App ]
        │                                                │
        │                                                ├─ 4. Accepts Task
        │                                                ├─ 5. Starts Work (In Progress)
        │                                                └─ 6. Submits Completion Remarks
        │                                                        │
        ▼                                                        ▼
[ 7. Admin Verifies Work & Marks Resolved ] <────────────────────┘
        │
        ▼
[ Citizen Real-Time Tracking ] ──> ( Status updated to "Resolved" with Audit History )
```

---

## Database Schema (MongoDB)

### 1. `User`
- `name` (String, required)
- `email` (String, unique, lowercase)
- `password` (String, bcrypt hash)
- `phone` (String)
- `role` (`citizen` | `admin` | `worker`)
- `department` (String, e.g., 'Civil Works', 'Sanitation', 'Electrical')

### 2. `Complaint`
- `complaintId` (String, unique indexed e.g. `CMP-MVUT706W710`)
- `citizen` (ObjectId ref User)
- `title` (String, max 140 chars)
- `description` (String, max 3000 chars)
- `imageUrl` (String)
- `userCategory` (String, chosen by citizen)
- `category` (String, validated by AI)
- `aiSummary` (String)
- `priority` (`HIGH` | `MEDIUM` | `LOW`)
- `priorityExplanation` (String)
- `priorityFactors` ([String])
- `actionBrief` (String)
- `aiMode` (`gemini` | `fallback-rules` | `seed-rules`)
- `latitude` (Number, indexed)
- `longitude` (Number, indexed)
- `address` (String)
- `duplicateOf` (ObjectId ref Complaint)
- `similarityScore` (Number)
- `duplicateStatus` (`none` | `suspected` | `confirmed` | `dismissed`)
- `duplicateReason` (String)
- `possibleDuplicates` (Array of { complaint, score, distanceM, reason })
- `status` (`Pending` | `Under Review` | `Assigned` | `Accepted` | `In Progress` | `Completed` | `Resolved` | `Rejected`)
- `assignedWorker` (ObjectId ref User)
- `completionRemarks` (String)
- `completionImageUrl` (String)

### 3. `WorkerAssignment`
- `complaint` (ObjectId ref Complaint)
- `worker` (ObjectId ref User)
- `assignedBy` (ObjectId ref User)
- `assignmentDate`, `acceptedAt`, `inProgressAt`, `completedAt` (Date)
- `remarks` (String), `completionImage` (String)

### 4. `Notification`
- `user` (ObjectId ref User)
- `complaint` (ObjectId ref Complaint)
- `title` (String), `message` (String), `type` (String), `read` (Boolean)

### 5. `ComplaintHistory`
- `complaint` (ObjectId ref Complaint)
- `previousStatus` (String), `newStatus` (String)
- `updatedBy` (ObjectId ref User)
- `remarks` (String), `timestamp` (Date)

---

## REST API Documentation

### Auth
- `POST /api/auth/register`: Public registration (Citizen).
- `POST /api/auth/login`: Email/password login returning JWT and user profile.
- `GET /api/auth/me`: Current authenticated user.
- `POST /api/auth/demo-login`: 1-Click login for hackathon testing (`{ role: "citizen" | "admin" | "worker" }`).

### Complaints
- `POST /api/complaints`: Create complaint (supports `multipart/form-data` with photo or `application/json`).
- `GET /api/complaints`: Filterable complaint query with role-scoping.
- `GET /api/complaints/:id`: Get full complaint details and audit history.
- `GET /api/complaints/track/:complaintId`: Public tracking endpoint returning timeline and history events.
- `PATCH /api/complaints/:id/assign`: Assign complaint to worker (requires duplicate review).
- `PATCH /api/complaints/:id/duplicate`: Confirm or dismiss suspected duplicate.
- `PATCH /api/complaints/:id/priority`: Override priority with recorded reason.
- `PATCH /api/complaints/:id/status`: Transition complaint status (Worker & Admin).
- `PATCH /api/complaints/:id/reject`: Reject complaint with reason.

### Admin & Worker
- `GET /api/admin/stats`: KPI totals, category/priority/status distributions, daily trend, hotspots.
- `GET /api/admin/workers`: Fleet list with active and completed workload metrics.
- `POST /api/seed`: Re-seed database with 43 realistic complaints and 4 hotspot clusters.

### Notifications
- `GET /api/notifications`: User notifications.
- `POST /api/notifications/read-all`: Mark all notifications as read.

---

## Environment Setup & Installation

### Prerequisites
- Node.js v18+ (tested on v24)
- MongoDB running locally on `mongodb://127.0.0.1:27017` (or MongoDB Atlas URI)

### Quick Start
```bash
# 1. Backend Server Setup
cd civicai/server
npm install
npm start
# API starts on http://localhost:5000

# 2. Frontend Client Setup (in a separate terminal)
cd civicai/client
npm install
npm run dev
# Vite UI starts on http://localhost:5173
```

### Environment Configuration (`civicai/server/.env`)
```ini
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/civicai
JWT_SECRET=civicai-secret-jwt-token-key-3928471

# Optional: Add Google Gemini API Key from Google AI Studio
# Without it, CivicAI runs in transparent, high-precision 'fallback-rules' heuristic mode
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

---

## Automated Verification & Test Suite

The repository includes a comprehensive 18-step verification test suite (`civicai/server/test_suite.js`).

Run the automated test suite:
```bash
cd civicai/server
node test_suite.js
```

**Verification Results**:
```
====================================================
🚀 CIVICAI COMPREHENSIVE END-TO-END VERIFICATION
====================================================
✅ [PASS] Backend Health Check OK
✅ [PASS] TEST 1: Citizen Registration
✅ [PASS] TEST 2: Citizen Login & JWT Generation
✅ [PASS] TEST 3: Complaint Creation
✅ [PASS] TEST 5: Coordinates Stored in MongoDB
✅ [PASS] TEST 6: AI Category Detection: Public Infrastructure
✅ [PASS] TEST 8: AI Priority Classification: HIGH
✅ [PASS]   -> AI Explanation: Immediate safety hazard identified
✅ [PASS]   -> AI Action Brief: Deploy structural engineers...
✅ [PASS] TEST 7: Duplicate Detection Triggered: status='suspected', score=1
✅ [PASS] TEST 9: Admin Authentication
✅ [PASS] TEST 10: Complaint Visible in Admin Queue
✅ [PASS] TEST 11: Worker Assignment to Ramesh Kumar
✅ [PASS] TEST 12: Worker Login for Ramesh Kumar
✅ [PASS] TEST 13A: Worker Accepted Task
✅ [PASS] TEST 13B: Task In Progress
✅ [PASS] TEST 13C: Worker Completed Work with Remarks
✅ [PASS] TEST 14: Admin Verified & Marked Resolved
✅ [PASS] TEST 15: Public / Citizen Live Tracking Resolved
✅ [PASS]   -> History Log Recorded: 7 lifecycle transitions
✅ [PASS] TEST 16: Hotspot Clustering (4 clusters detected)
✅ [PASS] TEST 17: Citizen Notifications Received
✅ [PASS] TEST 18: Dashboard Analytics (Total: 48, Resolution Rate: 17%)
====================================================
TEST SUMMARY: 23 PASSED, 0 FAILED
====================================================
```

---

## 5-Minute Live Hackathon Demonstration Script

### Demo Accounts (Password: `Password@123`)
- **Admin**: `admin@civicai.test` (Asha Sharma, Municipal Commissioner)
- **Worker**: `worker1@civicai.test` (Ramesh Kumar, Roads & Civil Works)
- **Citizen**: `citizen1@civicai.test` (Priya Nair)
*(You can also use the 1-Click Demo Login buttons directly on the login screen!)*

### Walkthrough Steps (Target: 5 Minutes)
1. **0:00 - 1:00 | Citizen Report Capture**:
   - Open [http://localhost:5173](http://localhost:5173). Click **1-Click Citizen**.
   - Navigate to **Report a Problem**.
   - Enter title: *"Deep crater pothole near Lakeview Circle"*, describe how motorcycles are skidding.
   - Tap the map near Lakeview Circle to drop the GPS pin. Click **Submit Report**.
   - Show the instant **AI Intake Card**: Notice AI automatically classified it as `Road Damage`, assigned `HIGH` priority, and created an AI Action Brief.
2. **1:00 - 2:00 | Admin Triage & Spatial Duplicate Gate**:
   - Log out and click **1-Click Admin**.
   - Show the **Executive Overview**: Total reports, resolution rate, and Recharts graphs.
   - Go to **Duplicate Reports**: Show the suspected duplicate card. Explain to the judges: *CivicAI found an existing pothole report within 180 meters. We do not automatically delete reports, but require admin review.* Click **Dismiss (Unique)**.
3. **2:00 - 3:00 | Hotspot Detection & Worker Dispatch**:
   - Click **Hotspot Map**: Point out the purple cluster rings on Bengaluru. Explain that 11 complaints clustered at Lakeview Circle, Koramangala. Show the AI recommendation.
   - Go to **Priority Queue**: Select the urgent complaint.
   - Click **Assign Worker**, select **Ramesh Kumar (Roads & Civil Works)**, and dispatch.
4. **3:00 - 4:00 | Worker Execution Lifecycle**:
   - Log out and click **1-Click Worker**.
   - In **My Assigned Tasks**, find the assigned Lakeview Circle task.
   - Click **Accept Assignment** ($\rightarrow$ Accepted).
   - Click **Start On-Site Work** ($\rightarrow$ In Progress).
   - Click **Submit Completion Report**, enter remarks: *"Pothole filled with rapid-hardening cold asphalt and compacted."* Click **Finalize & Mark Completed**.
5. **4:00 - 5:00 | Admin Verification & Citizen Tracking**:
   - Switch back to Admin: Open the complaint, verify completion remarks, and click **Mark Resolved**.
   - Switch to Citizen: Go to **Track Complaint**, enter the Complaint ID.
   - Show the green 5-stage timeline with all 5 steps complete and full audit event history!

---

## Limitations, Honesty & Future Roadmap

*(See `LIMITATIONS_AND_HONESTY.md` for the complete disclosure document required by hackathon guidelines)*

- **AI Transparency**: When running without `GEMINI_API_KEY`, CivicAI uses rule-based heuristics that are explicitly labelled as `aiMode: 'fallback-rules'`. No mock LLM responses are faked.
- **Image Storage**: Images are processed via Multer and stored on local disk under `server/uploads` for local demos. In production, Cloudinary or AWS S3 credentials are configured via environment variables.
- **Notifications**: In-app notifications are stored persistently in MongoDB. Live WebSockets or SMS (Twilio) are architectural next steps for multi-user real-time push.
