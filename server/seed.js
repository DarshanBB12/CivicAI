// Synthetic, fictional data only. Run: npm run seed   (all logins use password: Password@123)
require('dotenv').config();
const mongoose = require('mongoose'), bcrypt = require('bcryptjs');
const { User, Complaint, WorkerAssignment } = require('./models');
const { intake } = require('./ai');
const T = {
  'Road Damage': ['Very big pothole near {p} main road, vehicles struggling', 'Large pothole on {p} main road, bikes struggling to pass', 'Road surface cracked and broken near {p}'],
  Drainage: ['Drain blocked near {p}, sewage overflowing on the street', 'Clogged drain at {p} causing bad smell'],
  Waterlogging: ['Stagnant rain water near {p}, knee-deep after rain', 'Waterlogging at {p} every time it rains'],
  Garbage: ['Garbage bin overflowing at {p}, waste on the road', 'Trash dumped near {p}, bad smell for days'],
  Streetlight: ['Streetlight not working near {p}, whole stretch is dark', 'Broken lamp at {p}, area dark at night'],
  'Public Infrastructure': ['Bus stop bench broken near {p}', 'Footpath railing damaged at {p}'],
};
const spots = [
  { p: 'Lakeview Circle', lat: 12.9352, lng: 77.6245, items: [['Road Damage', 5], ['Drainage', 3], ['Waterlogging', 3]] },
  { p: 'Market Street', lat: 12.98, lng: 77.57, items: [['Garbage', 6], ['Drainage', 2]] },
  { p: 'Green Park Gate', lat: 12.95, lng: 77.59, items: [['Streetlight', 4]] },
];
const urgent = [
  ['Open manhole near school', 'Open manhole beside Ward 12 school road, a child nearly fell in. Dangerous.', 'Drainage', 12.9355, 77.6249, 'Lakeview Circle'],
  ['Live electric wire hanging', 'Live wire hanging low near Green Park Gate bus stop, electric shock danger for people.', 'Public Infrastructure', 12.9503, 77.5902, 'Green Park Gate'],
  ['Bike accident at pothole', 'Yesterday a bike fell at the big pothole on Market Street, rider injured.', 'Road Damage', 12.9803, 77.5703, 'Market Street'],
];
const jit = (n) => (Math.random() - 0.5) * n;
(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/civicai');
  await Promise.all([User.deleteMany(), Complaint.deleteMany(), WorkerAssignment.deleteMany()]);
  const pw = await bcrypt.hash('Password@123', 10), mk = (name, email, role) => ({ name, email, role, password: pw });
  await User.create(mk('Asha Admin', 'admin@civicai.test', 'admin'));
  const workers = await User.create([1, 2, 3].map((i) => mk(`Worker ${i}`, `worker${i}@civicai.test`, 'worker')));
  const citizens = await User.create([1, 2, 3, 4, 5].map((i) => mk(`Citizen ${i}`, `citizen${i}@civicai.test`, 'citizen')));
  const jobs = [];
  spots.forEach((s) => s.items.forEach(([cat, n]) => { for (let i = 0; i < n; i++) {
    const t = T[cat][cat === 'Road Damage' ? i % 2 : i % T[cat].length].replace('{p}', s.p);
    jobs.push({ title: t.split(',')[0], description: t, category: cat, latitude: s.lat + jit(0.0008), longitude: s.lng + jit(0.0008), address: s.p });
  } }));
  urgent.forEach(([title, description, category, latitude, longitude, address]) => jobs.push({ title, description, category, latitude, longitude, address }));
  for (let i = 0; i < 8; i++) { const cat = Object.keys(T)[i % 6]; jobs.push({ title: T[cat][0].replace('{p}', `Ward ${i + 20}`).split(',')[0], description: T[cat][0].replace('{p}', `Ward ${i + 20}`), category: cat, latitude: 12.9 + Math.random() * 0.12, longitude: 77.52 + Math.random() * 0.14, address: `Ward ${i + 20}` }); }
  const flow = ['Pending','Pending','Assigned','Accepted','In Progress','Completed','Resolved'];
  let n = 0;
  for (const j of jobs) {
    const c = await intake(j, citizens[n % 5]._id, { offline: true });
    const st = flow[n % flow.length];
    if (st !== 'Pending' && c.duplicateStatus === 'none') {
      const w = workers[n % 3]; Object.assign(c, { status: st, assignedWorker: w._id }); await c.save();
      await WorkerAssignment.create({ complaint: c._id, worker: w._id });
    }
    n++;
  }
  console.log(`Seeded ${n} complaints. Logins: admin@civicai.test, worker1@civicai.test, citizen1@civicai.test (Password@123)`);
  process.exit(0);
})();
