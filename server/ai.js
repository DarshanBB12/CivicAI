// AI Engine for CivicAI: Smart Complaint Management System
// 1. Categorization & Problem Extraction
// 2. Priority Detection & Reasoning
// 3. Duplicate Detection (Text + Geolocation)
// 4. Action Brief Generation
// 5. Geographic Hotspot & Cluster Detection

const fs = require('fs');
const path = require('path');
const { Complaint, CATEGORIES } = require('./models');

const KEYWORDS = {
  'Road Damage': ['pothole', 'road', 'crack', 'asphalt', 'tar', 'bike', 'vehicle', 'accident', 'crater', 'divider', 'speed breaker'],
  Waterlogging: ['waterlog', 'waterlogging', 'flood', 'flooding', 'stagnant', 'puddle', 'rain water', 'knee-deep', 'submerged'],
  Garbage: ['garbage', 'trash', 'waste', 'bin', 'dump', 'litter', 'smell', 'stench', 'debris', 'plastic', 'decaying'],
  Drainage: ['drain', 'drainage', 'sewer', 'sewage', 'manhole', 'clog', 'blocked', 'overflowing', 'gutter', 'open manhole'],
  Streetlight: ['streetlight', 'street light', 'lamp', 'dark', 'bulb', 'lighting', 'flickering', 'pole', 'pitch dark'],
  'Public Infrastructure': ['bridge', 'bench', 'signal', 'traffic light', 'footpath', 'bus stop', 'railing', 'wire', 'electric pole', 'park', 'sidewalk'],
};

const HIGH_SAFETY_KEYWORDS = [
  'accident', 'injured', 'injury', 'casualty', 'nearly fell', 'fell', 'danger', 'hazardous',
  'electric', 'live wire', 'shock', 'child', 'children', 'school', 'hospital', 'open manhole',
  'collapse', 'fire', 'elderly', 'ambulance', 'deep', 'urgent', 'critical'
];

const MEDIUM_IMPACT_KEYWORDS = [
  'traffic', 'jam', 'slow', 'struggling', 'stagnant', 'bad smell', 'smell', 'mosquitoes',
  'daily', 'days', 'weeks', 'overflow', 'crowded', 'pedestrian', 'commute', 'block'
];

// Fallback rule analyzer (always transparently labelled as fallback-rules)
function ruleAnalyze({ title, description, category }) {
  const combined = `${title || ''} ${description || ''}`.toLowerCase();

  // 1. Category Detection
  let bestCat = null;
  let maxMatches = 0;
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    const matches = words.filter((w) => combined.includes(w)).length;
    if (matches > maxMatches) {
      bestCat = cat;
      maxMatches = matches;
    }
  }
  const detectedCategory = bestCat || (CATEGORIES.includes(category) ? category : 'Other');

  // 2. Priority & Factors
  const hiMatches = HIGH_SAFETY_KEYWORDS.filter((w) => combined.includes(w));
  const medMatches = MEDIUM_IMPACT_KEYWORDS.filter((w) => combined.includes(w));

  let priority = 'LOW';
  const factors = [];
  let reason = '';

  if (hiMatches.length > 0) {
    priority = 'HIGH';
    factors.push('Public safety hazard');
    if (hiMatches.some((w) => ['school', 'hospital', 'child', 'children'].includes(w))) {
      factors.push('Vulnerable population / high traffic zone');
    }
    if (hiMatches.some((w) => ['live wire', 'open manhole', 'electric', 'fire'].includes(w))) {
      factors.push('Immediate life-safety hazard');
    }
    factors.push('High urgency');
    reason = `Immediate safety hazard identified with high-risk elements (${hiMatches.slice(0, 3).join(', ')}). Requires rapid intervention.`;
  } else if (medMatches.length > 0) {
    priority = 'MEDIUM';
    factors.push('Community disruption');
    factors.push('Moderate urgency');
    if (medMatches.some((w) => ['traffic', 'jam', 'commute'].includes(w))) {
      factors.push('Impacts daily commute & traffic');
    }
    if (medMatches.some((w) => ['smell', 'mosquitoes', 'overflow'].includes(w))) {
      factors.push('Sanitation & hygiene risk');
    }
    reason = `Moderate impact on community infrastructure (${medMatches.slice(0, 3).join(', ')}). Scheduled resolution advised within 48 hours.`;
  } else {
    priority = 'LOW';
    factors.push('Routine maintenance');
    factors.push('Standard urgency');
    reason = 'No acute safety risks or wide disruption detected. Queued for standard routine inspection.';
  }

  // 3. AI Summary
  const firstSentence = (description || title).split(/[.!?\n]/)[0].trim();
  const aiSummary = firstSentence.length > 120 ? firstSentence.slice(0, 117) + '...' : firstSentence;

  // 4. Action Brief
  const actionBrief = generateActionBrief({
    category: detectedCategory,
    priority,
    title,
    description,
    factors
  });

  return {
    category: detectedCategory,
    priority,
    priorityExplanation: `${reason} (Keyword heuristics)`,
    priorityFactors: factors,
    aiSummary: aiSummary || 'Civic infrastructure maintenance request.',
    actionBrief,
    aiConfidence: maxMatches > 0 ? 0.88 : 0.72,
    aiMode: 'fallback-rules'
  };
}

// Generate concise admin action brief
function generateActionBrief({ category, priority, title, description, factors }) {
  const isHigh = priority === 'HIGH';
  switch (category) {
    case 'Road Damage':
      return isHigh
        ? 'Dispatch rapid road crew immediately to cordon off hazard, patch crater, and prevent vehicle accidents.'
        : 'Schedule asphalt resurfacing crew and assess road sub-base within 3 business days.';
    case 'Drainage':
      return isHigh
        ? 'Deploy emergency suction truck and secure exposed drain/manhole with high-visibility barricade immediately.'
        : 'Assign local sanitation squad to clear clogged stormwater channel and inspect silt buildup.';
    case 'Waterlogging':
      return isHigh
        ? 'Deploy dewatering pumps urgently to clear standing water and ensure safe passage for pedestrians and traffic.'
        : 'Inspect drainage gradient and unclog culverts to restore natural water runoff.';
    case 'Garbage':
      return isHigh
        ? 'Urgent waste removal required due to severe health hazard and public pathway obstruction.'
        : 'Direct ward waste management compactor truck to clear overflow and sanitize bin perimeter.';
    case 'Streetlight':
      return isHigh
        ? 'Emergency electrical inspection needed for exposed wiring / dark high-risk corridor.'
        : 'Replace faulty luminaire / LED driver and verify feeder pillar breaker status.';
    case 'Public Infrastructure':
      return isHigh
        ? 'Deploy structural engineers to secure compromised asset and prevent public injury.'
        : 'Schedule field inspection for municipal property repair and repainting.';
    default:
      return 'Perform on-site assessment and assign to relevant municipal departmental supervisor.';
  }
}

// Google Gemini API integration
async function geminiAnalyze({ title, description, category, imagePath }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No GEMINI_API_KEY');

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are an expert civic triage AI assistant for municipal city management.
Analyze the citizen's complaint below and return ONLY a valid JSON object matching this exact schema:
{
  "category": "One of: ${CATEGORIES.join(', ')}",
  "title": "A short, polished 4-8 word title for municipal officers",
  "summary": "A clear, factual 1-sentence summary of the exact problem",
  "priority": "HIGH or MEDIUM or LOW",
  "priorityReason": "1-2 concise sentences explaining why this priority was assigned based on public safety, urgency, and disruption",
  "priorityFactors": ["array of 2-4 key risk factors e.g. 'Safety hazard', 'School zone proximity', 'Traffic congestion']",
  "actionBrief": "1 concise directive sentence telling the municipal officer or engineer what action to take immediately",
  "confidenceScore": 0.95
}

Citizen Submitted Details:
- Category Chosen: ${category || 'Unspecified'}
- Title: ${title}
- Description: ${description}
`;

  const contentsParts = [{ text: prompt }];

  // Optional: Attach image for multimodal vision analysis if present
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      const ext = path.extname(imagePath).toLowerCase().replace('.', '');
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const fileData = fs.readFileSync(imagePath).toString('base64');
      contentsParts.push({
        inlineData: {
          mimeType: mime,
          data: fileData
        }
      });
    } catch (e) {
      console.warn('Could not read image for Gemini vision:', e.message);
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: contentsParts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini');

  const parsed = JSON.parse(rawText);
  const validatedCat = CATEGORIES.includes(parsed.category) ? parsed.category : (CATEGORIES.includes(category) ? category : 'Other');
  const validatedPriority = ['HIGH', 'MEDIUM', 'LOW'].includes(parsed.priority) ? parsed.priority : 'MEDIUM';

  return {
    category: validatedCat,
    priority: validatedPriority,
    aiSummary: parsed.summary || title,
    priorityExplanation: parsed.priorityReason || 'Analyzed by Gemini AI',
    priorityFactors: Array.isArray(parsed.priorityFactors) ? parsed.priorityFactors : ['Assessed by Gemini LLM'],
    actionBrief: parsed.actionBrief || generateActionBrief({ category: validatedCat, priority: validatedPriority }),
    aiConfidence: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.92,
    aiMode: 'gemini'
  };
}

// Master analyzer
async function analyze(input, { offline = false } = {}) {
  if (offline || !process.env.GEMINI_API_KEY) {
    const result = ruleAnalyze(input);
    if (offline) result.aiMode = 'seed-rules';
    return result;
  }

  try {
    return await geminiAnalyze(input);
  } catch (err) {
    console.warn('Gemini AI call failed, falling back to rule engine:', err.message);
    const fallback = ruleAnalyze(input);
    fallback.priorityExplanation += ` (Note: Gemini API unavailable: ${err.message.slice(0, 50)})`;
    return fallback;
  }
}

// ---- Duplicate detection: Text Similarity (Jaccard) + Haversine Geolocation Distance ----
const STOP_WORDS = new Set([
  'the', 'and', 'near', 'there', 'very', 'with', 'for', 'this', 'that', 'are', 'has', 'have',
  'from', 'been', 'road', 'street', 'area', 'our', 'please', 'help', 'here', 'which', 'about'
]);

function tokenize(text) {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function haversineDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const DUPLICATE_MAX_DISTANCE_M = 180; // Within 180 meters
const DUPLICATE_SCORE_THRESHOLD = 0.38; // 38% combined similarity threshold

function findDuplicates(newComplaint, existingComplaints) {
  const newTokens = tokenize(`${newComplaint.title} ${newComplaint.description}`);

  const candidates = existingComplaints
    .filter((existing) => {
      // Must be open or recent and have valid coordinates
      if (existing.status === 'Resolved' || existing.status === 'Rejected') return false;
      if (existing.category !== newComplaint.category) return false;
      return true;
    })
    .map((existing) => {
      const distM = haversineDistanceM(
        newComplaint.latitude,
        newComplaint.longitude,
        existing.latitude,
        existing.longitude
      );

      if (distM > DUPLICATE_MAX_DISTANCE_M) return null;

      const existingTokens = tokenize(`${existing.title} ${existing.description}`);
      const textSim = jaccardSimilarity(newTokens, existingTokens);
      const distScore = Math.max(0, 1 - distM / DUPLICATE_MAX_DISTANCE_M);

      // Weighted score: 60% text overlap + 40% proximity closeness
      const combinedScore = 0.6 * textSim + 0.4 * distScore;

      if (combinedScore >= DUPLICATE_SCORE_THRESHOLD) {
        return {
          complaint: existing._id,
          original: existing,
          score: Math.round(combinedScore * 100) / 100,
          distanceM: Math.round(distM),
          reason: `High spatial proximity (${Math.round(distM)}m apart) with ${Math.round(textSim * 100)}% keyword overlap in ${newComplaint.category}.`
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return candidates;
}

// Intake pipeline: analyzes complaint, detects duplicates, stores record
async function intake(data, citizenId, opts = {}) {
  const ai = await analyze(data, opts);
  const existing = await Complaint.find({ status: { $nin: ['Resolved', 'Rejected'] } });
  const duplicates = findDuplicates({ ...data, category: ai.category }, existing);
  const topMatch = duplicates[0];

  const complaintId =
    'CMP-' +
    Date.now().toString(36).toUpperCase() +
    Math.floor(Math.random() * 900 + 100);

  const complaint = await Complaint.create({
    ...data,
    ...ai,
    citizen: citizenId,
    userCategory: data.category || 'Other',
    complaintId,
    duplicateOf: topMatch ? (topMatch.original.duplicateOf || topMatch.original._id) : undefined,
    similarityScore: topMatch ? topMatch.score : 0,
    duplicateStatus: topMatch ? 'suspected' : 'none',
    duplicateReason: topMatch ? topMatch.reason : '',
    possibleDuplicates: duplicates.map((d) => ({
      complaint: d.complaint,
      score: d.score,
      distanceM: d.distanceM,
      reason: d.reason
    })),
    status: 'Pending'
  });

  return complaint;
}

// ---- Hotspot & Spatial Cluster Detection ----
// Identifies areas with 3+ active reports within ~350 meters
function hotspots(complaintsList, minCount = 3) {
  const active = complaintsList.filter(
    (c) => c.status !== 'Resolved' && c.status !== 'Rejected'
  );

  // Group into geographic buckets (~350m grid)
  const gridCells = {};
  for (const c of active) {
    if (typeof c.latitude !== 'number' || typeof c.longitude !== 'number') continue;
    const key = `${Math.round(c.latitude / 0.003)}_${Math.round(c.longitude / 0.003)}`;
    if (!gridCells[key]) gridCells[key] = [];
    gridCells[key].push(c);
  }

  const result = Object.values(gridCells)
    .filter((group) => group.length >= minCount)
    .map((group) => {
      const avgLat = group.reduce((s, c) => s + c.latitude, 0) / group.length;
      const avgLng = group.reduce((s, c) => s + c.longitude, 0) / group.length;
      const highPriorityCount = group.filter((c) => c.priority === 'HIGH').length;
      const categories = [...new Set(group.map((c) => c.category))];
      const address = group.find((c) => c.address && c.address !== 'Unspecified Address')?.address || 'High Density Corridor';

      // Dominant category
      const catCount = {};
      group.forEach((c) => { catCount[c.category] = (catCount[c.category] || 0) + 1; });
      const topCategory = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a])[0];

      return {
        latitude: avgLat,
        longitude: avgLng,
        count: group.length,
        highPriority: highPriorityCount,
        topCategory,
        categories,
        label: address,
        complaintIds: group.map((c) => c.complaintId),
        recommendation: `Infrastructure inspection recommended: ${group.length} overlapping complaints (${topCategory} primary) with ${highPriorityCount} marked high priority.`
      };
    })
    .sort((a, b) => b.count - a.count);

  return result;
}

module.exports = {
  analyze,
  ruleAnalyze,
  geminiAnalyze,
  generateActionBrief,
  findDuplicates,
  intake,
  hotspots,
  haversineDistanceM,
  jaccardSimilarity
};
