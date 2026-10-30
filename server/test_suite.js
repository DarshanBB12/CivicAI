// CivicAI Complete 18-Test Automated Verification Suite
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 CIVICAI COMPREHENSIVE END-TO-END VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  };

  try {
    // 1. Health check
    const healthRes = await fetch(`${BASE}/health`).then((r) => r.json());
    assert(healthRes.ok === true, `Backend Health Check OK (Mode: ${healthRes.aiMode})`);

    // 2. Register Citizen
    const citizenEmail = `citizen_test_${Date.now()}@civicai.test`;
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kavita Krishnan',
        email: citizenEmail,
        password: 'Password@123',
        phone: '+91 98888 77777'
      })
    }).then((r) => r.json());
    assert(regRes.token && regRes.user.role === 'citizen', `TEST 1: Citizen Registration for ${regRes.user?.name}`);

    // 3. Login Citizen
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: citizenEmail, password: 'Password@123' })
    }).then((r) => r.json());
    const citizenToken = loginRes.token;
    const citizenHeaders = { Authorization: `Bearer ${citizenToken}`, 'Content-Type': 'application/json' };
    assert(!!citizenToken, 'TEST 2: Citizen Login & JWT Generation');

    // 4. Submit Complaint with Urgent Safety Hazard & Location
    const complaintPayload = {
      title: 'Dangerous exposed live wire near bus shelter',
      description: 'Live electrical cable hanging loose right beside primary school bus shelter. Children walking by, imminent electric shock danger.',
      category: 'Public Infrastructure',
      address: 'Green Park Gate Bus Stop, Indiranagar',
      latitude: 12.9504,
      longitude: 77.5901
    };
    const c1 = await fetch(`${BASE}/complaints`, {
      method: 'POST',
      headers: citizenHeaders,
      body: JSON.stringify(complaintPayload)
    }).then((r) => r.json());

    assert(c1.complaintId && c1.title === complaintPayload.title, `TEST 3: Complaint Creation (ID: ${c1.complaintId})`);
    assert(c1.latitude === 12.9504 && c1.longitude === 77.5901, 'TEST 5: Coordinates Stored in MongoDB');
    assert(c1.category === 'Public Infrastructure' || c1.category === 'Streetlight', `TEST 6: AI Category Detection: ${c1.category}`);
    assert(c1.priority === 'HIGH', `TEST 8: AI Priority Classification: ${c1.priority}`);
    assert(c1.priorityExplanation?.length > 0, `  -> AI Explanation: ${c1.priorityExplanation}`);
    assert(c1.actionBrief?.length > 0, `  -> AI Action Brief: ${c1.actionBrief}`);

    // 5. Test Duplicate Detection by submitting similar complaint nearby (< 180m)
    const dupPayload = {
      title: 'Live sparking electric wire at bus shelter',
      description: 'Sparking wire hanging low near Green Park bus stop, extreme shock risk for public.',
      category: c1.category,
      address: 'Green Park Gate, Indiranagar',
      latitude: 12.9505, // ~15 meters away
      longitude: 77.5902
    };
    const c2 = await fetch(`${BASE}/complaints`, {
      method: 'POST',
      headers: citizenHeaders,
      body: JSON.stringify(dupPayload)
    }).then((r) => r.json());

    assert(c2.duplicateStatus === 'suspected', `TEST 7: Duplicate Detection Triggered: status='${c2.duplicateStatus}', score=${c2.similarityScore}`);
    console.log(`  -> Duplicate Match Explanation: ${c2.duplicateReason}`);

    // 6. Admin Login
    const adminLogin = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@civicai.test', password: 'Password@123' })
    }).then((r) => r.json());
    const adminHeaders = { Authorization: `Bearer ${adminLogin.token}`, 'Content-Type': 'application/json' };
    assert(adminLogin.token && adminLogin.user.role === 'admin', 'TEST 9: Admin Authentication');

    // 7. Verify Complaint in Admin Queue
    const allComplaints = await fetch(`${BASE}/complaints`, { headers: adminHeaders }).then((r) => r.json());
    const foundC1 = allComplaints.find((c) => c.complaintId === c1.complaintId);
    assert(!!foundC1, `TEST 10: Complaint Visible in Admin Queue (${foundC1?.complaintId})`);

    // 8. Admin Reviews Duplicate Gate (if suspected) & Assigns Worker
    if (c1.duplicateStatus === 'suspected') {
      await fetch(`${BASE}/complaints/${c1._id}/duplicate`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ action: 'dismiss' })
      });
      console.log('  -> Admin dismissed duplicate flag to proceed with assignment');
    }

    const workers = await fetch(`${BASE}/admin/workers`, { headers: adminHeaders }).then((r) => r.json());
    const assignedWorker = workers[0];
    const assignRes = await fetch(`${BASE}/complaints/${c1._id}/assign`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ workerId: assignedWorker._id, remarks: 'Urgent civil crew dispatched' })
    }).then((r) => r.json());
    assert(assignRes.status === 'Assigned' && assignRes.assignedWorker === assignedWorker._id, `TEST 11: Worker Assignment to ${assignedWorker.name}`);

    // 9. Worker Login
    const workerLogin = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: assignedWorker.email, password: 'Password@123' })
    }).then((r) => r.json());
    const workerHeaders = { Authorization: `Bearer ${workerLogin.token}`, 'Content-Type': 'application/json' };
    assert(workerLogin.token && workerLogin.user.role === 'worker', `TEST 12: Worker Login for ${assignedWorker.name}`);

    // 10. Worker Workflow: Accept -> In Progress -> Complete
    const acceptRes = await fetch(`${BASE}/complaints/${c1._id}/status`, {
      method: 'PATCH',
      headers: workerHeaders,
      body: JSON.stringify({ status: 'Accepted' })
    }).then((r) => r.json());
    assert(acceptRes.status === 'Accepted', 'TEST 13A: Worker Accepted Task');

    const startRes = await fetch(`${BASE}/complaints/${c1._id}/status`, {
      method: 'PATCH',
      headers: workerHeaders,
      body: JSON.stringify({ status: 'In Progress' })
    }).then((r) => r.json());
    assert(startRes.status === 'In Progress', 'TEST 13B: Task In Progress');

    const completeRes = await fetch(`${BASE}/complaints/${c1._id}/status`, {
      method: 'PATCH',
      headers: workerHeaders,
      body: JSON.stringify({
        status: 'Completed',
        remarks: 'Live wire safely insulated, de-energized, and re-routed into secure conduit.'
      })
    }).then((r) => r.json());
    assert(completeRes.status === 'Completed' && completeRes.completionRemarks?.includes('safely insulated'), 'TEST 13C: Worker Completed Work with Remarks');

    // 11. Admin Verifies and Resolves
    const resolveRes = await fetch(`${BASE}/complaints/${c1._id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'Resolved' })
    }).then((r) => r.json());
    assert(resolveRes.status === 'Resolved', 'TEST 14: Admin Verified & Marked Resolved');

    // 12. Citizen Live Tracking & Timeline Audit
    const trackRes = await fetch(`${BASE}/complaints/track/${c1.complaintId}`).then((r) => r.json());
    assert(trackRes.complaint?.status === 'Resolved', `TEST 15: Public / Citizen Live Tracking Resolved (${trackRes.complaint?.complaintId})`);
    assert(trackRes.history?.length >= 4, `  -> History Log Recorded: ${trackRes.history?.length} lifecycle transitions`);

    // 13. Hotspots & Spatial Density Detection
    const statsRes = await fetch(`${BASE}/admin/stats`, { headers: adminHeaders }).then((r) => r.json());
    assert(Array.isArray(statsRes.hotspots) && statsRes.hotspots.length >= 2, `TEST 16: Hotspot Clustering (${statsRes.hotspots?.length} clusters detected)`);
    statsRes.hotspots.slice(0, 3).forEach((h) => {
      console.log(`  -> Cluster at ${h.label}: ${h.count} incidents (Top: ${h.topCategory}, High Priority: ${h.highPriority})`);
    });

    // 14. Notifications Delivery
    const citizenNotes = await fetch(`${BASE}/notifications`, { headers: citizenHeaders }).then((r) => r.json());
    assert(citizenNotes.length >= 2, `TEST 17: Citizen Notifications Received (${citizenNotes.length} alerts)`);
    citizenNotes.slice(0, 3).forEach((n) => console.log(`  -> [${n.title}] ${n.message}`));

    // 15. Dashboard Analytics
    assert(statsRes.total > 0 && statsRes.byCategory && statsRes.byPriority, `TEST 18: Dashboard Analytics (Total: ${statsRes.total}, Resolution Rate: ${statsRes.resolutionRate}%)`);

  } catch (err) {
    console.error('Test Suite Exception:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
