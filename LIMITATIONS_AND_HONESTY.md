# Limitations & Honesty Document: CivicAI
> **PromptWars x ASTRA | AI for Civic Impact**  
> Mandatory transparency note on implementation integrity, synthetic data, AI failure modes, and production roadmap.

---

## 1. What is Genuinely Implemented & Fully Operational

The following subsystems are completely built, integrated, and actively running in the application:

1. **Full-Stack MERN Architecture**:
   - Live Node.js + Express REST API on port `5000`.
   - Live React 18 + Vite frontend on port `5173`.
   - Live local MongoDB database connection with Mongoose ODM schemas, validation, and geospatial indexing.
2. **Three-Tier Role-Based Access Control**:
   - `Citizen`, `Admin`, and `Worker` portals with isolated permissions, JWT authentication, and bcrypt password hashing.
   - Public registration strictly enforces `citizen` role to prevent privilege escalation.
3. **Complete 4-Stage Complaint Lifecycle**:
   - Capture $\rightarrow$ AI Triage $\rightarrow$ Admin Review Gate $\rightarrow$ Worker Dispatch $\rightarrow$ Work Progression $\rightarrow$ Admin Resolution $\rightarrow$ Citizen Live Tracking.
   - Every state transition is recorded in the `ComplaintHistory` audit collection in MongoDB.
4. **Spatial Duplicate Detection**:
   - Uses actual Haversine distance calculations ($R = 6371\text{km}$) combined with token-based Jaccard keyword overlap within a 180m threshold.
   - Genuine administrative gate blocks crew dispatch on suspected duplicates until an administrator confirms or dismisses the flag.
5. **Geographic Hotspot & Cluster Detection**:
   - Aggregates active complaints across ~380m spatial buckets.
   - Calculates dynamic centroid coordinates, top problem category, high-priority count, and automated infrastructure directives.
6. **Interactive GIS Maps**:
   - Leaflet & OpenStreetMap integration with priority-colored circle markers and visual cluster boundary rings.
7. **End-to-End Test Suite**:
   - Automated 18-step verification suite (`test_suite.js`) executing and validating all API endpoints, transitions, and database state.

---

## 2. What Uses Sample / Synthetic Data

1. **Synthetic Initial Records**:
   - The database contains 43 realistic sample civic reports centered around four actual high-density municipal corridors in Bengaluru (Lakeview Circle Koramangala, Market Street Chickpet, Green Park Gate Indiranagar, and Silk Board Junction).
   - Contains deliberate duplicates (e.g. repeated pothole and drainage reports at the same coordinates) to validate duplicate detection.
   - Contains 3 urgent life-safety incidents (open manhole near school, live electrical cable, motorcycle crash).
   - Distributed across realistic workflow stages (`Pending`, `Under Review`, `Assigned`, `Accepted`, `In Progress`, `Completed`, `Resolved`).
2. **Synthetic Municipal Users**:
   - All sample accounts (e.g., `admin@civicai.test`, `worker1@civicai.test`, `citizen1@civicai.test`) use synthetic credentials with password `Password@123`.

---

## 3. What is Mocked or Handled with Fallbacks

1. **AI Engine Fallback (`aiMode: 'fallback-rules'`)**:
   - When no `GEMINI_API_KEY` is present in `server/.env`, the system executes our rule-based heuristic triage engine.
   - **Honesty Note**: We do NOT mock or fabricate fake LLM responses in the frontend. If running in fallback mode, every complaint is explicitly and transparently tagged with `aiMode: 'fallback-rules'` in both the database and the UI.
   - When `GEMINI_API_KEY` is supplied, the backend seamlessly routes directly to Google Gemini 2.0 Flash (`gemini-2.0-flash`) via structured JSON schema generation.
2. **Image Storage (Local Multer vs Cloudinary)**:
   - For offline hackathon demonstrations, uploaded images are stored on local server storage under `server/uploads/` via Multer.
   - Cloudinary integration requires cloud credentials. The schema and architecture are pre-configured to store URL references.
3. **Citizen Notification Channel**:
   - Notifications are stored persistently in MongoDB and surfaced within the in-app notification center.
   - Out-of-band external SMS (Twilio) and WhatsApp notifications are not live in this prototype.

---

## 4. Where AI Can Be Inaccurate & How We Mitigate It

1. **Duplicate Detection Word Variation**:
   - *Limitation*: Because our duplicate engine combines Jaccard text overlap with spatial proximity, two citizens describing the exact same problem with completely different vocabularies (e.g., *"crater in asphalt"* vs *"broken bitumen road surface"*) might score below the 38% text overlap threshold.
   - *Mitigation*: We place heavy weight (40%) on geographic proximity within 180m and enforce an administrative review gate before crews are assigned.
2. **Priority Misclassification by LLMs**:
   - *Limitation*: An LLM can occasionally overestimate priority for dramatic descriptions without acute physical danger, or underestimate hazards described with understated language.
   - *Mitigation*: CivicAI includes a dedicated **Admin Priority Override** feature where administrators can change the priority level with an audit log of their override reason.
3. **Category Boundary Ambiguity**:
   - *Limitation*: Certain incidents span multiple domains (e.g., waterlogging caused by a collapsed drain).
   - *Mitigation*: The system records both the citizen-selected category and the AI-analyzed category, and admin dashboards allow reassignment.

---

## 5. What Would Be Implemented in a Full Production Release

1. **Vector Embeddings for Duplicates**:
   - Implement `text-embedding-004` or pgvector to compute semantic cosine similarity, eliminating keyword-matching limitations.
2. **Computer Vision Inspection**:
   - Deploy multimodal Gemini Vision to measure pothole depth, crack severity, and debris volume directly from citizen photos.
3. **Real-Time Push Notifications**:
   - Integrate Socket.io / WebSockets for live status updates and Twilio for citizen SMS alerts.
4. **Cloud Media Storage**:
   - Stream citizen uploads directly to AWS S3 or Cloudinary CDN with automatic thumbnail generation.
5. **GIS Integration with Municipal CAD / ArcGIS**:
   - Export complaint hotspot clusters to standard municipal shapefiles and GIS geoJSON formats for city planning departments.
