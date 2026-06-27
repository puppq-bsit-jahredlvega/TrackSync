// ===== TrackSync — Firebase Firestore backend =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, onSnapshot, arrayUnion
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7J__vSKPYja6xoRNsge9pMCO8pkLo9e0",
  authDomain: "tracksync-bsit-2-2.firebaseapp.com",
  projectId: "tracksync-bsit-2-2",
  storageBucket: "tracksync-bsit-2-2.firebasestorage.app",
  messagingSenderId: "259783110856",
  appId: "1:259783110856:web:4cf0de057d9d75c76575fd",
  measurementId: "G-RD0ZZN4MTS"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ── Session (localStorage — device only, that's fine for login state) ──
const SESSION_KEY = "mm_session";
function setSession(v){ localStorage.setItem(SESSION_KEY, v); }
function getSession(){ return localStorage.getItem(SESSION_KEY); }
function deleteSession(){ localStorage.removeItem(SESSION_KEY); }

// ── In-memory DB mirror (populated from Firestore on startup) ──
const DB = {
  users: {},
  trainers: {},
  workoutPlans: {},
  workoutLogs: {},
  trainerAssignedPlans: {},
  trainerFeedback: {},
  gymChallenges: [],
  courses: {},
};

// ── Default courses (used only for first-time seeding) ──
const DEFAULT_COURSES = {
  "Strength": [
    { title: "Beginner Full Body Workout", desc: "A complete 3-day full body strength routine for beginners.", videoId: "7GkMHPe_OXw", details: "This routine hits every major muscle group each session. Full-body training builds strength faster for beginners because each movement gets practiced more frequently, while rest days let muscles recover before the next session." },
    { title: "Progressive Overload Explained", desc: "The #1 principle behind continuous muscle and strength gains.", videoId: "TJHZI3McmE4", details: "Progressive overload means gradually increasing the demand on your muscles — more weight, reps, or sets over time. Without it, your body adapts and stops changing. This is the foundation behind every effective long-term training program." },
    { title: "Push / Pull / Legs Split Guide", desc: "The classic PPL split broken down for intermediate lifters.", videoId: "TJHZI3McmE4", details: "PPL separates training into pushing movements (chest, shoulders, triceps), pulling (back, biceps), and legs — giving each muscle group dedicated volume and recovery time. Ideal for lifters past the beginner stage." },
    { title: "How to Build Muscle (Science)", desc: "Evidence-based principles for maximizing hypertrophy.", videoId: "lu_BObG6dj8", details: "Muscle growth is driven by mechanical tension, metabolic stress, and muscle damage. This breaks down how to optimize sets, reps, rest, and frequency to trigger maximum hypertrophy based on current sports science research." }
  ],
  "Cardio": [
    { title: "Couch to 5K: Full Plan", desc: "An 8-week walk/run plan to build up to running 5K.", videoId: "_1b-0Vlmfa4", details: "Alternates walking and running in increasing intervals across 8 weeks. The gradual progression protects your joints and connective tissue from the shin splints and burnout that stop most new runners too early." },
    { title: "Zone 2 Cardio Explained", desc: "Why slow cardio builds your aerobic base and longevity.", videoId: "bkhgiktiloQ", details: "Zone 2 training (conversational pace, ~60–70% max HR) builds mitochondrial density and your aerobic engine. It's the foundation elite athletes and longevity researchers both point to for sustainable fitness and metabolic health." },
    { title: "20-Min HIIT for Beginners", desc: "High-intensity intervals for fat burn — zero equipment.", videoId: "bkhgiktiloQ", details: "HIIT alternates short maximal-effort bursts with brief rest periods. It burns more calories in less time than steady-state cardio and keeps metabolism elevated for hours after — ideal for a tight schedule." },
    { title: "Jump Rope for Fat Loss", desc: "One of the most efficient cardio tools, fully explained.", videoId: "1BZM2Vre5oc", details: "Jump rope burns roughly 10–16 calories per minute while improving coordination, footwork, and cardiovascular capacity. Cheap, portable, and adaptable from beginner to advanced — an underrated conditioning tool." }
  ],
  "Nutrition": [
    { title: "Macros for Beginners", desc: "Understand protein, carbs, and fats for your goal.", videoId: "Sc4rj3OiVV8", details: "Protein builds muscle, carbs fuel workouts and the brain, and fats support hormones. Understanding your macros lets you tailor your diet to your specific goal instead of blindly counting total calories." },
    { title: "Meal Prep for the Week", desc: "Prep healthy meals in under 2 hours on a budget.", videoId: "AYXfaVD5o40", details: "Meal prepping removes daily decision fatigue that leads to skipped meals or junk food choices. Buying in bulk and cooking in batches is consistently cheaper than eating out — especially useful for students." },
    { title: "How Much Protein Do You Need?", desc: "The science of optimal protein intake for muscle growth.", videoId: "zBDYkgfh37c", details: "Research supports ~0.7–1g of protein per pound of bodyweight daily for those building muscle. This covers sources, timing, and the myths around protein that cause people to over- or under-eat it." },
    { title: "Bulking vs Cutting Explained", desc: "How to cycle between gaining muscle and losing fat.", videoId: "kob2PH-WEOY", details: "A bulk is a calorie surplus phase focused on muscle gain; a cut is a deficit phase for fat loss. Knowing how and when to cycle between them prevents the trap of spinning your wheels without visible progress." }
  ],
  "Flexibility": [
    { title: "10-Min Daily Mobility Routine", desc: "Improve range of motion and reduce injury risk.", videoId: "v7AYKMP6rOE", details: "Moves major joints through full range using dynamic stretches and controlled drills. Better mobility reduces injury risk, improves exercise form, and counters the stiffness from long hours of sitting." },
    { title: "Full Body Stretch Routine", desc: "A complete post-workout stretch for recovery.", videoId: "L_xrDAtykMI", details: "Static stretching after training reduces soreness, improves long-term flexibility, and signals your nervous system to shift into recovery mode — so you actually benefit from your sessions." },
    { title: "Hip Flexor & Lower Back Relief", desc: "Essential stretches for desk workers and students.", videoId: "sTxC3J3gQEU", details: "Prolonged sitting tightens hip flexors and weakens glutes, leading to lower back pain and poor squat mechanics. These targeted stretches are among the highest-ROI flexibility work if you spend most of your day seated." }
  ]
};

// ══════════════════════════════════════════════
//  FIRESTORE HELPERS
// ══════════════════════════════════════════════

// Encode email as a safe Firestore doc ID (replace . with _dot_)
function emailToId(email){ return email.replace(/\./g, "_dot_"); }
function idToEmail(id){ return id.replace(/_dot_/g, "."); }

async function fsGet(colName, docId){
  const snap = await getDoc(doc(db, colName, docId));
  return snap.exists() ? snap.data() : null;
}
async function fsSet(colName, docId, data){
  await setDoc(doc(db, colName, docId), data);
}
async function fsUpdate(colName, docId, data){
  await updateDoc(doc(db, colName, docId), data);
}
async function fsDelete(colName, docId){
  await deleteDoc(doc(db, colName, docId));
}
async function fsGetAll(colName){
  const snap = await getDocs(collection(db, colName));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
}

// ── saveDB: write entire in-memory DB to Firestore ──
// We break it into individual document writes per logical record.
async function saveDB(){
  // No-op: we write directly to Firestore in each action instead.
  // This function is kept as a hook for callers that still call it.
}

// Individual targeted save functions (used by action handlers):
async function saveUser(email){
  await fsSet("users", emailToId(email), DB.users[email]);
}
async function saveTrainer(email){
  await fsSet("trainers", emailToId(email), DB.trainers[email]);
}
async function saveWorkoutPlan(email){
  if(DB.workoutPlans[email]){
    await fsSet("workoutPlans", emailToId(email), DB.workoutPlans[email]);
  } else {
    await fsDelete("workoutPlans", emailToId(email)).catch(()=>{});
  }
}
async function saveWorkoutLogs(email){
  await fsSet("workoutLogs", emailToId(email), { logs: DB.workoutLogs[email] || [] });
}
async function saveAssignedPlan(email){
  if(DB.trainerAssignedPlans[email]){
    await fsSet("trainerAssignedPlans", emailToId(email), DB.trainerAssignedPlans[email]);
  } else {
    await fsDelete("trainerAssignedPlans", emailToId(email)).catch(()=>{});
  }
}
async function saveFeedback(email){
  await fsSet("trainerFeedback", emailToId(email), { feedback: DB.trainerFeedback[email] || [] });
}
async function saveGymChallenges(){
  await fsSet("meta", "gymChallenges", { list: DB.gymChallenges });
}
async function saveCourses(){
  await fsSet("meta", "courses", { data: DB.courses });
}

// ══════════════════════════════════════════════
//  REAL-TIME LISTENERS (onSnapshot)
//  These fire immediately on load AND on any change from any device.
// ══════════════════════════════════════════════
function reRenderActive(){
  const active = document.querySelector(".screen.active");
  if(!active) return;
  const id = active.id;
  if(id === "home_screen")           { renderCalendar(); updateTopbarName(); }
  if(id === "workout"){
    if(DB.workoutPlans[STATE.currentUser]){
      active.classList.remove("active");
      document.getElementById("summary").classList.add("active");
      renderSummary();
    } else {
      renderWorkoutScreen();
    }
  }
  if(id === "summary")               { renderSummary(); }
  if(id === "history")               { renderHistory(); }
  if(id === "profile_screen")        { renderProfile(); }
  if(id === "course_screen")         { renderCourses(); }
  if(id === "devlog")                { renderDashboard(); }
  if(id === "trainer_home")          { renderTrainerHome(); }
  if(id === "trainer_members")       { renderTrainerMembers(); }
  if(id === "trainer_assign")        { renderTrainerAssign(); }
  if(id === "trainer_progress")      { renderTrainerProgress(); }
  if(id === "trainer_challenges")    { renderTrainerChallenges(); }
  if(id === "trainer_member_detail") { renderMemberDetail(); }
  if(id === "coach_profile")         { renderCoachProfile(); }
}

function setupListeners(){
  // users collection
  onSnapshot(collection(db, "users"), snap => {
    snap.forEach(d => { DB.users[idToEmail(d.id)] = d.data(); });
    // remove deleted
    const ids = new Set(snap.docs.map(d => idToEmail(d.id)));
    Object.keys(DB.users).forEach(e => { if(!ids.has(e)) delete DB.users[e]; });
    reRenderActive();
  });

  // trainers collection
  onSnapshot(collection(db, "trainers"), snap => {
    snap.forEach(d => { DB.trainers[idToEmail(d.id)] = d.data(); });
    const ids = new Set(snap.docs.map(d => idToEmail(d.id)));
    Object.keys(DB.trainers).forEach(e => { if(!ids.has(e)) delete DB.trainers[e]; });
    reRenderActive();
  });

  // workoutPlans
  onSnapshot(collection(db, "workoutPlans"), snap => {
    snap.forEach(d => { DB.workoutPlans[idToEmail(d.id)] = d.data(); });
    const ids = new Set(snap.docs.map(d => idToEmail(d.id)));
    Object.keys(DB.workoutPlans).forEach(e => { if(!ids.has(e)) delete DB.workoutPlans[e]; });
    reRenderActive();
  });

  // workoutLogs
  onSnapshot(collection(db, "workoutLogs"), snap => {
    snap.forEach(d => { DB.workoutLogs[idToEmail(d.id)] = d.data().logs || []; });
    const ids = new Set(snap.docs.map(d => idToEmail(d.id)));
    Object.keys(DB.workoutLogs).forEach(e => { if(!ids.has(e)) delete DB.workoutLogs[e]; });
    reRenderActive();
  });

  // trainerAssignedPlans
  onSnapshot(collection(db, "trainerAssignedPlans"), snap => {
    snap.forEach(d => { DB.trainerAssignedPlans[idToEmail(d.id)] = d.data(); });
    const ids = new Set(snap.docs.map(d => idToEmail(d.id)));
    Object.keys(DB.trainerAssignedPlans).forEach(e => { if(!ids.has(e)) delete DB.trainerAssignedPlans[e]; });
    reRenderActive();
  });

  // trainerFeedback
  onSnapshot(collection(db, "trainerFeedback"), snap => {
    snap.forEach(d => { DB.trainerFeedback[idToEmail(d.id)] = d.data().feedback || []; });
    const ids = new Set(snap.docs.map(d => idToEmail(d.id)));
    Object.keys(DB.trainerFeedback).forEach(e => { if(!ids.has(e)) delete DB.trainerFeedback[e]; });
    reRenderActive();
  });

  // gymChallenges + courses stored in meta collection
  onSnapshot(doc(db, "meta", "gymChallenges"), snap => {
    DB.gymChallenges = snap.exists() ? (snap.data().list || []) : [];
    reRenderActive();
  });

  onSnapshot(doc(db, "meta", "courses"), snap => {
    DB.courses = snap.exists() ? (snap.data().data || {}) : {};
    if(Object.keys(DB.courses).length === 0){
      DB.courses = JSON.parse(JSON.stringify(DEFAULT_COURSES));
    }
    reRenderActive();
  });
}

// ══════════════════════════════════════════════
//  BOOTSTRAP — load initial data then start listeners
// ══════════════════════════════════════════════
async function bootstrap(){
  showScreen("login_screen"); // show login immediately while loading

  // Show a loading indicator on the login screen
  const loginCard = document.querySelector(".login-card");
  const loadingMsg = document.createElement("p");
  loadingMsg.id = "firebase-loading";
  loadingMsg.style.cssText = "color:var(--muted);font-size:13px;text-align:center;margin-top:8px";
  loadingMsg.textContent = "⏳ Connecting...";
  loginCard.appendChild(loadingMsg);

  try {
    // Seed default trainer if collection is empty
    const trainerSnap = await getDocs(collection(db, "trainers"));
    if(trainerSnap.empty){
      await fsSet("trainers", emailToId("trainer@demo.com"), {
        password: "trainer123", name: "Coach Rivera", role: "trainer"
      });
    }
    // Seed demo user if users collection is empty
    const usersSnap = await getDocs(collection(db, "users"));
    if(usersSnap.empty){
      await fsSet("users", emailToId("demoacc@demo.com"), {
        password: "demo123", name: "Demo User", sex: "M",
        age: 21, weight: 65, height: 172, role: "member"
      });
    }
    // Seed courses if missing
    const coursesSnap = await getDoc(doc(db, "meta", "courses"));
    if(!coursesSnap.exists()){
      await fsSet("meta", "courses", { data: JSON.parse(JSON.stringify(DEFAULT_COURSES)) });
    }
    // Seed gymChallenges meta doc if missing
    const challengesSnap = await getDoc(doc(db, "meta", "gymChallenges"));
    if(!challengesSnap.exists()){
      await fsSet("meta", "gymChallenges", { list: [] });
    }
  } catch(e){
    console.error("Bootstrap error:", e);
    loadingMsg.textContent = "⚠️ Could not connect to database.";
    return;
  }

  // Now load all data into DB mirror
  try {
    const [users, trainers, plans, logsSnap, assigned, feedback, challenges, courses] = await Promise.all([
      fsGetAll("users"),
      fsGetAll("trainers"),
      fsGetAll("workoutPlans"),
      fsGetAll("workoutLogs"),
      fsGetAll("trainerAssignedPlans"),
      fsGetAll("trainerFeedback"),
      fsGet("meta","gymChallenges"),
      fsGet("meta","courses"),
    ]);
    Object.entries(users).forEach(([id,v]) => { DB.users[idToEmail(id)] = v; });
    Object.entries(trainers).forEach(([id,v]) => { DB.trainers[idToEmail(id)] = v; });
    Object.entries(plans).forEach(([id,v]) => { DB.workoutPlans[idToEmail(id)] = v; });
    Object.entries(logsSnap).forEach(([id,v]) => { DB.workoutLogs[idToEmail(id)] = v.logs || []; });
    Object.entries(assigned).forEach(([id,v]) => { DB.trainerAssignedPlans[idToEmail(id)] = v; });
    Object.entries(feedback).forEach(([id,v]) => { DB.trainerFeedback[idToEmail(id)] = v.feedback || []; });
    DB.gymChallenges = challenges ? (challenges.list || []) : [];
    DB.courses = courses ? (courses.data || {}) : JSON.parse(JSON.stringify(DEFAULT_COURSES));
  } catch(e){
    console.error("Initial load error:", e);
  }

  loadingMsg.remove();

  // Start real-time listeners
  setupListeners();

  // Restore session
  const savedSession = getSession();
  if(savedSession){
    const [savedEmail, savedRole] = savedSession.split("|");
    if(savedRole === "trainer" && DB.trainers[savedEmail]){
      STATE.currentUser = savedEmail;
      STATE.currentRole = "trainer";
      showScreen("trainer_home");
    } else if(DB.users[savedEmail]){
      STATE.currentUser = savedEmail;
      STATE.currentRole = "member";
      loadUserState();
      showScreen("home_screen");
    } else {
      showScreen("login_screen");
    }
  }
}

// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
const STATE = {
  currentUser: null,
  currentRole: null,
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  goal: "Select Goal",
  duration: 30,
  selectedDays: [],
  reminderEnabled: false,
  reminderTime: null,
  lastCalories: 0,
  trainerSelectedMember: null,
  trainerSelectedDays: [],
  courseBackScreen: "home_screen",
  memberDetailEmail: null,
};

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MET = { "Lose Weight": 7.5, "Build Muscle": 6.0, "Stay Fit": 4.5 };

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if(id === "home_screen"){ renderCalendar(); updateTopbarName(); }
  if(id === "workout"){
    if(DB.workoutPlans[STATE.currentUser]){
      // Already has a plan — show the summary instead of the create-plan form.
      document.getElementById(id).classList.remove("active");
      document.getElementById("summary").classList.add("active");
      renderSummary();
    } else {
      renderWorkoutScreen();
    }
  }
  if(id === "summary") renderSummary();
  if(id === "history") renderHistory();
  if(id === "profile_screen") renderProfile();
  if(id === "course_screen"){
    const backBtn = document.getElementById("course-back-btn");
    if(backBtn) backBtn.dataset.nav = STATE.courseBackScreen;
    editingCourse = null;
    renderCourses();
  }
  if(id === "devlog") renderDashboard();
  if(id === "trainer_home") renderTrainerHome();
  if(id === "trainer_members") renderTrainerMembers();
  if(id === "trainer_assign") renderTrainerAssign();
  if(id === "trainer_progress") renderTrainerProgress();
  if(id === "trainer_challenges") renderTrainerChallenges();
  if(id === "trainer_member_detail") renderMemberDetail();
  if(id === "coach_profile") renderCoachProfile();
}

// Make showScreen global so inline onclick="" handlers work
window.showScreen = showScreen;

document.addEventListener("click", (e) => {
  const navEl = e.target.closest("[data-nav]");
  if(navEl){
    if(!STATE.currentUser){ showScreen("login_screen"); return; }
    const target = navEl.dataset.nav;
    if(STATE.currentRole === "member" && target.startsWith("trainer_")) return;
    if(target === "course_screen"){
      STATE.courseBackScreen = STATE.currentRole === "trainer" ? "trainer_home" : "home_screen";
    }
    showScreen(target);
  }
});

// ══════════════════════════════════════════════
//  LOGIN / SIGNUP
// ══════════════════════════════════════════════
document.getElementById("btn-show-signup").onclick = () => showScreen("signup_screen");
document.getElementById("btn-back-login").onclick  = () => showScreen("login_screen");

function setLoginRole(role){
  document.getElementById("login-role").value = role;
  document.getElementById("role-btn-member").classList.toggle("active", role === "member");
  document.getElementById("role-btn-trainer").classList.toggle("active", role === "trainer");
  const emailInput = document.getElementById("login-email");
  const signupLink = document.getElementById("btn-show-signup");
  if(role === "trainer"){
    emailInput.placeholder = "Trainer Email";
    signupLink.style.display = "none";
  } else {
    emailInput.placeholder = "Email";
    signupLink.style.display = "";
  }
}
window.setLoginRole = setLoginRole;

document.getElementById("btn-login").onclick = () => {
  const email = document.getElementById("login-email").value.trim();
  const pw    = document.getElementById("login-password").value;
  const role  = document.getElementById("login-role").value;
  const errEl = document.getElementById("login-error");

  if(role === "trainer"){
    const trainer = DB.trainers[email];
    if(!trainer || trainer.password !== pw){ errEl.textContent = "Invalid trainer email or password."; return; }
    errEl.textContent = "";
    STATE.currentUser = email;
    STATE.currentRole = "trainer";
    setSession(email + "|trainer");
    showScreen("trainer_home");
  } else {
    const user = DB.users[email];
    if(!user || user.password !== pw){ errEl.textContent = "Invalid email or password."; return; }
    errEl.textContent = "";
    STATE.currentUser = email;
    STATE.currentRole = "member";
    setSession(email + "|member");
    loadUserState();
    showScreen("home_screen");
  }
};

document.getElementById("btn-signup").onclick = async () => {
  const name   = document.getElementById("signup-name").value.trim();
  const email  = document.getElementById("signup-email").value.trim();
  const pw     = document.getElementById("signup-password").value;
  const sex    = document.getElementById("signup-sex").value;
  const age    = parseFloat(document.getElementById("signup-age").value);
  const weight = parseFloat(document.getElementById("signup-weight").value);
  const height = parseFloat(document.getElementById("signup-height").value);
  const errEl  = document.getElementById("signup-error");

  if(!name || !email || !pw || !sex || !age || !weight || !height){
    errEl.textContent = "Please fill in all fields."; return;
  }
  if(DB.users[email]){ errEl.textContent = "An account with this email already exists."; return; }

  const newUser = { password: pw, name, sex, age, weight, height, role: "member" };
  DB.users[email] = newUser;
  await saveUser(email);
  errEl.textContent = "";
  STATE.currentUser = email;
  STATE.currentRole = "member";
  setSession(email + "|member");
  loadUserState();
  showScreen("home_screen");
};

function doLogout(){
  STATE.currentUser = null;
  STATE.currentRole = null;
  deleteSession();
  showScreen("login_screen");
}
window.doLogout = doLogout;

document.getElementById("btn-logout").onclick = doLogout;

// ══════════════════════════════════════════════
//  TOPBAR
// ══════════════════════════════════════════════
function updateTopbarName(){
  const el      = document.getElementById("topbar-username");
  const avatarEl = document.getElementById("home-avatar-initials");
  if(!el) return;
  if(STATE.currentUser && DB.users[STATE.currentUser]){
    const name = DB.users[STATE.currentUser].name || "";
    el.textContent = name.split(" ")[0] || STATE.currentUser;
    if(avatarEl){
      const parts = name.trim().split(/\s+/).filter(Boolean);
      avatarEl.textContent = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : (parts[0] ? parts[0][0].toUpperCase() : "?");
    }
  } else {
    el.textContent = "";
    if(avatarEl) avatarEl.textContent = "?";
  }
}

function loadUserState(){
  const plan = DB.workoutPlans[STATE.currentUser];
  if(plan){
    STATE.goal = plan.goal;
    STATE.duration = plan.duration;
    STATE.selectedDays = [...plan.days];
    STATE.reminderEnabled = !!plan.reminderTime;
    STATE.reminderTime = plan.reminderTime;
    STATE.lastCalories = plan.dailyCalories;
  } else {
    STATE.goal = "Select Goal";
    STATE.duration = 30;
    STATE.selectedDays = [];
    STATE.reminderEnabled = false;
    STATE.reminderTime = null;
    STATE.lastCalories = 0;
  }
}

// ══════════════════════════════════════════════
//  CALENDAR
// ══════════════════════════════════════════════
const calGrid  = document.getElementById("calendar-grid");
const calLabel = document.getElementById("cal-month-label");
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

document.getElementById("cal-prev").onclick = () => shiftMonth(-1);
document.getElementById("cal-next").onclick = () => shiftMonth(1);

function shiftMonth(delta){
  STATE.calMonth += delta;
  if(STATE.calMonth < 0){ STATE.calMonth = 11; STATE.calYear--; }
  if(STATE.calMonth > 11){ STATE.calMonth = 0; STATE.calYear++; }
  renderCalendar();
}

function renderCalendar(){
  calLabel.textContent = `${MONTH_NAMES[STATE.calMonth]} ${STATE.calYear}`;
  calGrid.innerHTML = "";
  DAYS.forEach(d => {
    const el = document.createElement("div");
    el.className = "day-cell day-name";
    el.textContent = d;
    calGrid.appendChild(el);
  });
  const firstOfMonth = new Date(STATE.calYear, STATE.calMonth, 1);
  let startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(STATE.calYear, STATE.calMonth + 1, 0).getDate();
  const plan = DB.workoutPlans[STATE.currentUser];
  const workoutDays = plan ? plan.days : [];
  const today = new Date();
  const logs = DB.workoutLogs[STATE.currentUser] || [];
  const loggedDateKeys = new Set(logs.map(l => {
    if(!l.date) return null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(l.date)) return l.date;
    const d = new Date(l.date);
    return isNaN(d) ? null : dateKey(d);
  }).filter(Boolean));
  for(let i = 0; i < startOffset; i++){
    const blank = document.createElement("div");
    blank.className = "day-cell";
    calGrid.appendChild(blank);
  }
  for(let day = 1; day <= daysInMonth; day++){
    const cellDate = new Date(STATE.calYear, STATE.calMonth, day);
    const dayName  = DAYS[(cellDate.getDay() + 6) % 7];
    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.textContent = day;
    if(workoutDays.includes(dayName)) cell.classList.add("workout-day");
    if(loggedDateKeys.has(dateKey(cellDate))) cell.classList.add("logged-day");
    if(cellDate.toDateString() === today.toDateString()) cell.classList.add("today");
    calGrid.appendChild(cell);
  }
}

// ══════════════════════════════════════════════
//  WORKOUT PLANNER
// ══════════════════════════════════════════════
function bmiInfo(){
  const user = DB.users[STATE.currentUser];
  if(!user || !user.weight || !user.height) return null;
  const bmi = user.weight / ((user.height / 100) ** 2);
  let category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
  return { bmi, category };
}
function calculateBMR(weight, heightCm, sex, age){
  return sex === "M"
    ? 10 * weight + 6.25 * heightCm - 5 * age + 5
    : 10 * weight + 6.25 * heightCm - 5 * age - 161;
}
function calculateCalories(duration, weight, heightCm, sex, age, goal){
  const hours = duration / 60;
  let met = MET[goal] || 4.5;
  const bmi = weight / ((heightCm / 100) ** 2);
  if(goal === "Lose Weight" && bmi >= 30) met *= 1.1;
  return (calculateBMR(weight, heightCm, sex, age) / 24) * met * hours;
}
function updateBMILabel(){
  const info = bmiInfo();
  document.getElementById("bmi-label").textContent = info
    ? `BMI: ${info.bmi.toFixed(1)} (${info.category})`
    : "BMI: Not Available";
}
function updateCaloriesEstimate(){
  const user = DB.users[STATE.currentUser];
  const el   = document.getElementById("calories-label");
  if(!user || !user.weight || !user.height || !user.sex){
    STATE.lastCalories = 0; el.textContent = "Estimated Calories: User data incomplete"; return;
  }
  if(!(30 <= user.weight && user.weight <= 300) || !(100 <= user.height && user.height <= 250)){
    STATE.lastCalories = 0; el.textContent = "Estimated Calories: Invalid weight or height"; return;
  }
  const cals = calculateCalories(STATE.duration, user.weight, user.height, user.sex, user.age || 30, STATE.goal);
  STATE.lastCalories = cals;
  el.textContent = `Estimated Calories: ${cals.toFixed(1)} kcal`;
}
function renderWorkoutScreen(){
  updateBMILabel();
  const assignedPlan = DB.trainerAssignedPlans[STATE.currentUser];
  const banner = document.getElementById("recommended-plan-banner");
  const recSub = document.getElementById("rec-plan-sub");
  if(assignedPlan && banner){
    banner.classList.remove("hidden");
    recSub.textContent = `${assignedPlan.goal} · ${(assignedPlan.days||[]).join(", ")} · ${assignedPlan.duration} mins/day · by ${assignedPlan.assignedBy || "Trainer"}`;
  } else if(banner){
    banner.classList.add("hidden");
  }
  document.querySelectorAll(".goal-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.goal === STATE.goal);
  });
  document.getElementById("duration-slider").value = STATE.duration;
  document.getElementById("duration-label").textContent = `Daily Duration: ${STATE.duration} mins`;
  const dayGrid = document.getElementById("day-grid");
  dayGrid.innerHTML = "";
  DAYS.forEach(day => {
    const btn = document.createElement("button");
    btn.className = "day-btn" + (STATE.selectedDays.includes(day) ? " selected" : "");
    btn.textContent = day;
    btn.onclick = () => {
      STATE.selectedDays = STATE.selectedDays.includes(day)
        ? STATE.selectedDays.filter(d => d !== day)
        : [...STATE.selectedDays, day];
      renderWorkoutScreen();
    };
    dayGrid.appendChild(btn);
  });
  document.getElementById("reminder-toggle").checked = STATE.reminderEnabled;
  document.getElementById("reminder-time-btn").disabled = !STATE.reminderEnabled;
  document.getElementById("reminder-time-btn").textContent =
    STATE.reminderTime ? `Reminder: ${STATE.reminderTime}` : "Select Reminder Time";
  updateCaloriesEstimate();
}

document.getElementById("btn-view-rec-plan").onclick = () => {
  const plan = DB.trainerAssignedPlans[STATE.currentUser];
  if(!plan) return;
  const detail  = document.getElementById("rec-plan-detail");
  const content = document.getElementById("rec-plan-detail-content");
  content.innerHTML = `
    <div class="detail-plan-row"><span class="detail-plan-key">Goal</span><span class="detail-plan-val">${plan.goal||"—"}</span></div>
    <div class="detail-plan-row"><span class="detail-plan-key">Days</span><span class="detail-plan-val">${(plan.days||[]).join(", ")||"—"}</span></div>
    <div class="detail-plan-row"><span class="detail-plan-key">Duration</span><span class="detail-plan-val">${plan.duration||"—"} mins/day</span></div>
    ${plan.workoutTime ? `<div class="detail-plan-row"><span class="detail-plan-key">Time</span><span class="detail-plan-val">${plan.workoutTime}</span></div>` : ""}
    ${plan.notes ? `<div class="detail-plan-row"><span class="detail-plan-key">Notes</span><span class="detail-plan-val">${plan.notes}</span></div>` : ""}
    <div class="detail-plan-row"><span class="detail-plan-key">Assigned by</span><span class="detail-plan-val">${plan.assignedBy||"Trainer"}</span></div>
    <div class="detail-plan-row"><span class="detail-plan-key">Date assigned</span><span class="detail-plan-val">${plan.date||"—"}</span></div>
  `;
  detail.classList.remove("hidden");
};
document.getElementById("btn-close-rec-plan").onclick = () => {
  document.getElementById("rec-plan-detail").classList.add("hidden");
};
document.getElementById("btn-apply-rec-plan").onclick = async () => {
  const plan = DB.trainerAssignedPlans[STATE.currentUser];
  if(!plan){ alert("No plan to apply."); return; }
  const user = DB.users[STATE.currentUser];
  let dailyCals = 0;
  if(user && user.weight && user.height && user.sex)
    dailyCals = calculateCalories(plan.duration||30, user.weight, user.height, user.sex, user.age||30, plan.goal||"Stay Fit");
  const newPlan = {
    goal: plan.goal||"Stay Fit", duration: plan.duration||30,
    days: [...(plan.days||[])], reminderTime: plan.workoutTime||null,
    startDate: dateKey(new Date()), dailyCalories: dailyCals,
    weeklyCalories: dailyCals * (plan.days||[]).length, fromTrainer: true,
  };
  DB.workoutPlans[STATE.currentUser] = newPlan;
  await saveWorkoutPlan(STATE.currentUser);
  loadUserState();
  document.getElementById("rec-plan-detail").classList.add("hidden");
  alert(`Trainer's plan applied! Training ${(plan.days||[]).join(", ")} for ${plan.duration} mins.`);
  showScreen("summary");
};

document.querySelectorAll(".goal-btn").forEach(btn => {
  btn.onclick = () => {
    STATE.goal = (STATE.goal === btn.dataset.goal) ? "Select Goal" : btn.dataset.goal;
    renderWorkoutScreen();
  };
});
document.getElementById("duration-slider").oninput = (e) => {
  STATE.duration = parseInt(e.target.value, 10);
  document.getElementById("duration-label").textContent = `Daily Duration: ${STATE.duration} mins`;
  updateCaloriesEstimate();
};
document.getElementById("reminder-toggle").onchange = (e) => {
  STATE.reminderEnabled = e.target.checked;
  if(!STATE.reminderEnabled) STATE.reminderTime = null;
  renderWorkoutScreen();
};
document.getElementById("reminder-time-btn").onclick = () => {
  const input = document.getElementById("reminder-time-input");
  input.classList.remove("hidden");
  input.focus();
};
document.getElementById("reminder-time-input").onchange = (e) => {
  STATE.reminderTime = e.target.value;
  e.target.classList.add("hidden");
  renderWorkoutScreen();
};
document.getElementById("btn-save-plan").onclick = async () => {
  if(STATE.goal === "Select Goal" || STATE.selectedDays.length === 0){
    alert("Please select a workout goal and at least one workout day."); return;
  }
  if(STATE.lastCalories <= 0){ alert("Invalid calorie data. Please check your profile (weight/height)."); return; }
  if(STATE.reminderEnabled && !STATE.reminderTime){ alert("Please select a valid reminder time."); return; }
  const plan = {
    goal: STATE.goal, duration: STATE.duration, days: [...STATE.selectedDays],
    reminderTime: STATE.reminderEnabled ? STATE.reminderTime : null,
    startDate: dateKey(new Date()), dailyCalories: STATE.lastCalories,
    weeklyCalories: STATE.lastCalories * STATE.selectedDays.length,
  };
  DB.workoutPlans[STATE.currentUser] = plan;
  await saveWorkoutPlan(STATE.currentUser);
  showScreen("summary");
};

// ══════════════════════════════════════════════
//  PLAN SUMMARY
// ══════════════════════════════════════════════
function renderSummary(){
  const plan = DB.workoutPlans[STATE.currentUser];
  const el   = document.getElementById("summary-card");
  if(!plan){ el.innerHTML = "<p>No workout plan saved yet.</p>"; return; }
  el.innerHTML = `
    <h3 class="section-title" style="margin-top:0">Your Workout Plan</h3>
    <p><strong>Goal:</strong> ${plan.goal}</p>
    <p><strong>Daily Duration:</strong> ${plan.duration} mins</p>
    <p><strong>Workout Days:</strong> ${plan.days.join(", ")}</p>
    <p><strong>Reminder:</strong> ${plan.reminderTime || "Not set"}</p>
    <p><strong>Daily Calories:</strong> ${plan.dailyCalories.toFixed(1)} kcal</p>
    <p><strong>Weekly Calories:</strong> ${plan.weeklyCalories.toFixed(1)} kcal</p>
    <p><strong>Start Date:</strong> ${plan.startDate}</p>
  `;
}
document.getElementById("btn-edit-plan").onclick = () => {
  const plan = DB.workoutPlans[STATE.currentUser];
  if(plan){
    STATE.goal           = plan.goal || "Select Goal";
    STATE.duration        = plan.duration || 30;
    STATE.selectedDays    = [...(plan.days || [])];
    STATE.reminderEnabled = !!plan.reminderTime;
    STATE.reminderTime    = plan.reminderTime || null;
  }
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("workout").classList.add("active");
  renderWorkoutScreen();
};
document.getElementById("btn-cancel-plan").onclick = async () => {
  delete DB.workoutPlans[STATE.currentUser];
  await saveWorkoutPlan(STATE.currentUser);
  loadUserState();
  showScreen("home_screen");
};

// ══════════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════════
function renderProfile(){
  const user = DB.users[STATE.currentUser];
  document.getElementById("profile-name").value   = user.name   || "";
  document.getElementById("profile-email").value  = STATE.currentUser;
  document.getElementById("profile-sex").value    = user.sex    || "M";
  document.getElementById("profile-age").value    = user.age    || "";
  document.getElementById("profile-weight").value = user.weight || "";
  document.getElementById("profile-height").value = user.height || "";
  updateProfileBMI();
}
function updateProfileBMI(){
  const weight = parseFloat(document.getElementById("profile-weight").value);
  const height = parseFloat(document.getElementById("profile-height").value);
  const valEl  = document.getElementById("profile-bmi-value");
  const catEl  = document.getElementById("profile-bmi-cat");
  const card   = document.getElementById("profile-bmi-card");
  if(weight > 0 && height > 0){
    const bmi = weight / ((height / 100) ** 2);
    let cat   = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
    let color = bmi < 18.5 ? "#5bc4f5" : bmi < 25 ? "#4caf50" : bmi < 30 ? "#f5a623" : "#e8192f";
    valEl.textContent = bmi.toFixed(1); valEl.style.color = color;
    catEl.textContent = cat;            catEl.style.color = color;
    card.style.display = "flex";
  } else {
    valEl.textContent = "—"; valEl.style.color = ""; catEl.textContent = ""; card.style.display = "none";
  }
}
window.updateProfileBMI = updateProfileBMI;

document.getElementById("btn-save-profile").onclick = async () => {
  const user = DB.users[STATE.currentUser];
  user.name   = document.getElementById("profile-name").value.trim();
  user.sex    = document.getElementById("profile-sex").value;
  user.age    = parseFloat(document.getElementById("profile-age").value)    || user.age;
  user.weight = parseFloat(document.getElementById("profile-weight").value) || user.weight;
  user.height = parseFloat(document.getElementById("profile-height").value) || user.height;
  await saveUser(STATE.currentUser);
  alert("Profile updated.");
  updateTopbarName();
  showScreen("home_screen");
};
document.getElementById("btn-reset-data").onclick = async () => {
  if(!confirm("This will delete your workout plans, logs, and dev log entries. Continue?")) return;
  delete DB.workoutPlans[STATE.currentUser];
  DB.workoutLogs[STATE.currentUser] = [];
  await Promise.all([
    saveWorkoutPlan(STATE.currentUser),
    saveWorkoutLogs(STATE.currentUser),
  ]);
  loadUserState();
  alert("All data has been reset.");
  showScreen("home_screen");
};
document.getElementById("nav-profile").onclick = () => showScreen("profile_screen");

// ══════════════════════════════════════════════
//  GAINS DASHBOARD
// ══════════════════════════════════════════════
function setRing(id, fraction){
  const circle = document.getElementById(id);
  const circumference = 314;
  const capped = Math.min(Math.max(fraction, 0), 1);
  circle.style.strokeDashoffset = circumference - capped * circumference;
  circle.style.stroke = fraction >= 1 ? "var(--gold)" : "var(--maroon-bright)";
}
function dateKey(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function computeStreak(logs){
  if(logs.length === 0) return 0;
  const loggedDays = new Set(logs.map(l => dateKey(new Date(l.date))));
  let streak = 0, cursor = new Date();
  while(loggedDays.has(dateKey(cursor))){ streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
function computeConsistency(plan, logs){
  if(!plan || plan.days.length === 0) return 0;
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentLoggedDays = new Set(
    logs.filter(l => new Date(l.date) >= sevenDaysAgo).map(l => dateKey(new Date(l.date)))
  );
  return Math.min(Math.round((recentLoggedDays.size / plan.days.length) * 100), 100);
}
function computeChallengeProgress(ch, logs){
  const target = ch.durationDays || 30;
  const matchLogs = logs.filter(l => !ch.workoutType || ch.workoutType === "Any" || l.type === ch.workoutType);
  const daysLogged = new Set(matchLogs.map(l => dateKey(new Date(l.date))));
  const count = Math.min(daysLogged.size, target);
  return { count, target, achieved: daysLogged.size >= target };
}

// Detect newly-completed challenges for the current user and show a
// one-time completion message, then remember it so it doesn't pop up again.
async function checkChallengeCompletions(logs){
  const user = DB.users[STATE.currentUser];
  if(!user) return;
  if(!user.completedChallenges) user.completedChallenges = [];
  let changed = false;
  for(const ch of DB.gymChallenges){
    const chId = ch.id != null ? ch.id : ch.title; // fallback for older challenges without id
    if(user.completedChallenges.includes(chId)) continue;
    const prog = computeChallengeProgress(ch, logs);
    if(prog.achieved){
      user.completedChallenges.push(chId);
      changed = true;
      alert(`🎉 Challenge Complete!\n\nYou finished "${ch.title}" by logging your ${ch.workoutType === "Any" || !ch.workoutType ? "workouts" : ch.workoutType.toLowerCase()} for ${prog.target} day(s). Great work!`);
    }
  }
  if(changed) await saveUser(STATE.currentUser);
}

// ISO-week key (e.g. "2026-W26") used so the weekly notification only
// fires once per calendar week, separate from the rolling 7-day display total.
function getWeekKey(d){
  const date = new Date(d);
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() + 3 - ((date.getDay()+6)%7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay()+6)%7)) / 7);
  return `${date.getFullYear()}-W${weekNum}`;
}

// Notify the member once when they hit their daily kcal goal, and once
// per calendar week when they hit their weekly kcal goal.
async function checkCalorieGoals(burnedToday, burnedThisWeek, dailyGoal, weeklyGoal){
  const user = DB.users[STATE.currentUser];
  if(!user) return;
  let changed = false;
  const todayKey = dateKey(new Date());
  if(burnedToday >= dailyGoal && user.lastDailyGoalDate !== todayKey){
    user.lastDailyGoalDate = todayKey;
    changed = true;
    alert(`🔥 Daily Calorie Goal Reached!\n\nYou've burned ${burnedToday.toFixed(0)} kcal today, hitting your ${dailyGoal} kcal daily goal. Nice work!`);
  }
  const weekKey = getWeekKey(new Date());
  if(burnedThisWeek >= weeklyGoal && user.lastWeeklyGoalWeek !== weekKey){
    user.lastWeeklyGoalWeek = weekKey;
    changed = true;
    alert(`🏆 Weekly Calorie Goal Reached!\n\nYou've burned ${burnedThisWeek.toFixed(0)} kcal this week, hitting your ${weeklyGoal} kcal weekly goal. Great consistency!`);
  }
  if(changed) await saveUser(STATE.currentUser);
}

// Derive {daily, weekly} calorie goals from a member's active plan.
// Falls back to recomputing from duration/goal/profile if the stored
// plan is missing the fields or has a stale/zero value, and only uses
// the flat 300/2500 default when there's truly no plan at all.
function getCalorieGoals(plan, user){
  const DEFAULT_DAILY = 300, DEFAULT_WEEKLY = 2500;
  if(!plan) return { daily: DEFAULT_DAILY, weekly: DEFAULT_WEEKLY };
  let daily = Number(plan.dailyCalories);
  if(!Number.isFinite(daily) || daily <= 0){
    if(user && user.weight && user.height && user.sex){
      daily = calculateCalories(plan.duration||30, user.weight, user.height, user.sex, user.age||30, plan.goal||"Stay Fit");
    } else {
      daily = 0;
    }
  }
  const dayCount = (plan.days||[]).length || 7;
  let weekly = Number(plan.weeklyCalories);
  if(!Number.isFinite(weekly) || weekly <= 0){
    weekly = daily * dayCount;
  }
  return {
    daily:  daily  > 0 ? daily  : DEFAULT_DAILY,
    weekly: weekly > 0 ? weekly : DEFAULT_WEEKLY
  };
}

function renderDashboard(){
  const user  = DB.users[STATE.currentUser];
  const plan  = DB.workoutPlans[STATE.currentUser];
  const logs  = DB.workoutLogs[STATE.currentUser] || [];
  const { daily: DAILY_GOAL, weekly: WEEKLY_GOAL } = getCalorieGoals(plan, user);
  const todayKey = dateKey(new Date());
  const burnedToday = logs.filter(l => dateKey(new Date(l.date)) === todayKey).reduce((s,l) => s+(l.calories||0), 0);
  document.getElementById("progress-daily-label").textContent =
    `${burnedToday.toFixed(0)} / ${DAILY_GOAL} kcal${burnedToday > DAILY_GOAL ? " ✓" : ""}`;
  setRing("ring-daily", burnedToday / DAILY_GOAL);
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const burnedThisWeek = logs.filter(l => new Date(l.date) >= sevenDaysAgo).reduce((s,l) => s+(l.calories||0), 0);
  document.getElementById("progress-weekly-label").textContent =
    `${burnedThisWeek.toFixed(0)} / ${WEEKLY_GOAL} kcal${burnedThisWeek > WEEKLY_GOAL ? " ✓" : ""}`;
  setRing("ring-weekly", burnedThisWeek / WEEKLY_GOAL);
  checkCalorieGoals(burnedToday, burnedThisWeek, DAILY_GOAL, WEEKLY_GOAL);
  document.getElementById("stat-streak").textContent = computeStreak(logs);
  document.getElementById("stat-weight").textContent = (user && user.weight) ? user.weight : "—";
  document.getElementById("stat-consistency").textContent = `${computeConsistency(plan, logs)}%`;
  const listEl = document.getElementById("recent-workouts-list");
  if(logs.length === 0){
    listEl.innerHTML = "<p>No logged workouts yet.</p>";
  } else {
    listEl.innerHTML = "";
    [...logs].reverse().slice(0, 5).forEach(log => {
      const div = document.createElement("div");
      div.className = "history-entry";
      div.innerHTML = `<strong>${log.type}</strong> — ${log.duration} mins<br>${log.calories.toFixed(1)} kcal burned<br><span class="meta">${log.date}${log.startTime ? " · started " + log.startTime : ""}</span>`;
      listEl.appendChild(div);
    });
  }
  const challengesEl = document.getElementById("dashboard-challenges");
  const challenges = DB.gymChallenges || [];
  if(challenges.length === 0){
    challengesEl.innerHTML = "<p style='color:var(--muted);font-size:13px'>No active challenges from your trainer yet.</p>";
  } else {
    challengesEl.innerHTML = "";
    [...challenges].reverse().forEach(ch => {
      const today = new Date();
      const deadline = ch.deadline ? new Date(ch.deadline) : null;
      const isExpired = deadline && deadline < today;
      const daysLeft = deadline ? Math.ceil((deadline - today) / (1000*60*60*24)) : null;
      const prog = computeChallengeProgress(ch, logs);
      const user = DB.users[STATE.currentUser];
      const chId = ch.id != null ? ch.id : ch.title;
      const isCompleted = prog.achieved || (user && user.completedChallenges && user.completedChallenges.includes(chId));
      const div = document.createElement("div");
      div.className = "challenge-event" + (isExpired ? " expired" : "") + (isCompleted ? " completed" : "");
      div.innerHTML = `
        <div class="challenge-event-title">🏆 ${ch.title}</div>
        <div class="challenge-event-desc">${ch.desc}</div>
        <div class="challenge-event-meta">By ${ch.createdBy}${deadline ? ` · ${isExpired ? "⚠️ Ended" : `⏳ ${daysLeft}d left`} (${ch.deadline})` : " · No deadline"}</div>
        <div class="challenge-event-meta">Goal: ${ch.workoutType||"Any"} workout · ${prog.target} day(s)</div>
        <div class="challenge-progress-bar"><div class="challenge-progress-fill" style="width:${Math.min((prog.count/prog.target)*100,100)}%"></div></div>
        <div class="challenge-event-meta">${isCompleted ? "✅ Completed!" : `${prog.count}/${prog.target} days logged`}</div>
      `;
      challengesEl.appendChild(div);
    });
  }
  checkChallengeCompletions(logs);
}

// ══════════════════════════════════════════════
//  WORKOUT LOGGER
// ══════════════════════════════════════════════
document.getElementById("btn-save-log").onclick = async () => {
  const type      = document.getElementById("log-type").value;
  const duration  = parseFloat(document.getElementById("log-duration").value) || 0;
  const startTime = document.getElementById("log-start-time").value;
  const ACTIVITY_MET = { "Running": 9.8, "Cycling": 7.5, "Weightlifting": 6.0, "Yoga": 3.0, "Swimming": 8.0, "Other": 5.0 };
  const user = DB.users[STATE.currentUser];
  let calories = 0;
  if(user && user.weight && user.height && user.sex){
    calories = (calculateBMR(user.weight, user.height, user.sex, user.age||30) / 24) * (ACTIVITY_MET[type]||5.0) * (duration/60);
  }
  if(!DB.workoutLogs[STATE.currentUser]) DB.workoutLogs[STATE.currentUser] = [];
  DB.workoutLogs[STATE.currentUser].push({ type, duration, startTime, calories, date: dateKey(new Date()) });
  await saveWorkoutLogs(STATE.currentUser);
  await checkChallengeCompletions(DB.workoutLogs[STATE.currentUser]);
  const todayKeyNow = dateKey(new Date());
  const logsNow = DB.workoutLogs[STATE.currentUser];
  const burnedTodayNow = logsNow.filter(l => dateKey(new Date(l.date)) === todayKeyNow).reduce((s,l) => s+(l.calories||0), 0);
  const sevenDaysAgoNow = new Date(); sevenDaysAgoNow.setDate(sevenDaysAgoNow.getDate() - 7);
  const burnedThisWeekNow = logsNow.filter(l => new Date(l.date) >= sevenDaysAgoNow).reduce((s,l) => s+(l.calories||0), 0);
  const goalsNow = getCalorieGoals(DB.workoutPlans[STATE.currentUser], user);
  await checkCalorieGoals(burnedTodayNow, burnedThisWeekNow, goalsNow.daily, goalsNow.weekly);
  alert("Workout logged!");
  showScreen("history");
};

// ══════════════════════════════════════════════
//  WORKOUT HISTORY
// ══════════════════════════════════════════════
document.getElementById("btn-clear-history").onclick = async () => {
  const logs = DB.workoutLogs[STATE.currentUser] || [];
  if(logs.length === 0) return;
  if(!confirm("This will permanently delete all your logged workouts. Continue?")) return;
  DB.workoutLogs[STATE.currentUser] = [];
  await saveWorkoutLogs(STATE.currentUser);
  renderHistory();
};
function renderHistory(){
  const logs = DB.workoutLogs[STATE.currentUser] || [];
  const el   = document.getElementById("history-list");
  if(logs.length === 0){ el.innerHTML = "<p>No logged workouts yet.</p>"; return; }
  el.innerHTML = "";
  [...logs].reverse().forEach(log => {
    const div = document.createElement("div");
    div.className = "history-entry";
    div.innerHTML = `<strong>${log.type}</strong> — ${log.duration} mins<br>${log.calories.toFixed(1)} kcal burned<br><span class="meta">${log.date}${log.startTime ? " · started " + log.startTime : ""}</span>`;
    el.appendChild(div);
  });
}

// ══════════════════════════════════════════════
//  COURSES
// ══════════════════════════════════════════════
let currentCourseTab = null;
let editingCourse    = null;

function extractYouTubeId(input){
  if(!input) return "";
  const str = input.trim();
  if(/^[a-zA-Z0-9_-]{6,15}$/.test(str) && !str.includes("/") && !str.includes(".")) return str;
  try {
    const url = new URL(str);
    if(url.hostname.includes("youtu.be")) return url.pathname.slice(1);
    if(url.searchParams.get("v")) return url.searchParams.get("v");
    const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if(shorts) return shorts[1];
    const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/);
    if(embed) return embed[1];
  } catch(e){}
  return str;
}
function isCourseEditor(){ return STATE.currentRole === "trainer"; }

function renderCourses(){
  if(!currentCourseTab || !DB.courses[currentCourseTab])
    currentCourseTab = Object.keys(DB.courses)[0];
  const tabsEl = document.getElementById("course-tabs");
  tabsEl.innerHTML = "";
  Object.keys(DB.courses).forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (cat === currentCourseTab ? " active" : "");
    btn.textContent = cat;
    btn.onclick = () => { currentCourseTab = cat; editingCourse = null; renderCourses(); };
    tabsEl.appendChild(btn);
  });
  if(isCourseEditor()){
    const addCatBtn = document.createElement("button");
    addCatBtn.className = "tab-btn";
    addCatBtn.textContent = "+ Category";
    addCatBtn.onclick = async () => {
      const name = prompt("New category name:");
      if(name && name.trim() && !DB.courses[name.trim()]){
        DB.courses[name.trim()] = [];
        currentCourseTab = name.trim();
        await saveCourses();
        editingCourse = { cat: currentCourseTab, idx: -1 };
        renderCourses();
      }
    };
    tabsEl.appendChild(addCatBtn);
  }
  const contentEl = document.getElementById("course-content");
  contentEl.innerHTML = "";
  if(isCourseEditor()){
    const catBar = document.createElement("div");
    catBar.className = "button-row";
    catBar.style.marginBottom = "12px";
    catBar.innerHTML = `<button class="btn-primary" id="btn-add-course">＋ Add Course</button><button class="btn-secondary" id="btn-delete-category">🗑️ Delete Category</button>`;
    contentEl.appendChild(catBar);
    catBar.querySelector("#btn-add-course").onclick = () => { editingCourse = { cat: currentCourseTab, idx: -1 }; renderCourses(); };
    catBar.querySelector("#btn-delete-category").onclick = async () => {
      if(Object.keys(DB.courses).length <= 1){ alert("You need at least one category."); return; }
      if(confirm(`Delete the "${currentCourseTab}" category and all its courses?`)){
        delete DB.courses[currentCourseTab];
        currentCourseTab = Object.keys(DB.courses)[0];
        await saveCourses();
        renderCourses();
      }
    };
  }
  if(editingCourse && editingCourse.cat === currentCourseTab){
    const isNew = editingCourse.idx === -1;
    const item  = isNew ? { title:"", desc:"", videoId:"", details:"" } : DB.courses[currentCourseTab][editingCourse.idx];
    const form  = document.createElement("div");
    form.className = "card course-edit-form";
    form.innerHTML = `
      <h3 class="section-title" style="margin-top:0">${isNew ? "Add Course" : "Edit Course"}</h3>
      <div class="profile-field"><label>Video Link</label><input type="text" class="text-input" id="ce-video" placeholder="https://www.youtube.com/watch?v=..." value="${(item.videoId ? "https://www.youtube.com/watch?v=" + item.videoId : "").replace(/"/g,"&quot;")}"></div>
      <div class="profile-field"><label>Title</label><input type="text" class="text-input" id="ce-title" placeholder="e.g. Beginner Full Body Workout" value="${(item.title||"").replace(/"/g,"&quot;")}"></div>
      <div class="profile-field"><label>Short Description</label><textarea class="text-input" id="ce-desc" rows="2">${item.desc||""}</textarea></div>
      <div class="profile-field"><label>Why &amp; What This Is For</label><textarea class="text-input" id="ce-details" rows="4">${item.details||""}</textarea></div>
      <p class="error-text" id="ce-error"></p>
      <div class="button-row"><button class="btn-primary" id="ce-save">💾 Save Course</button><button class="btn-secondary" id="ce-cancel">Cancel</button></div>
    `;
    contentEl.appendChild(form);
    form.querySelector("#ce-cancel").onclick = () => { editingCourse = null; renderCourses(); };
    form.querySelector("#ce-save").onclick = async () => {
      const title   = form.querySelector("#ce-title").value.trim();
      const desc    = form.querySelector("#ce-desc").value.trim();
      const details = form.querySelector("#ce-details").value.trim();
      const videoId = extractYouTubeId(form.querySelector("#ce-video").value.trim());
      const errEl   = form.querySelector("#ce-error");
      if(!title || !videoId){ errEl.textContent = "Title and a valid video link are required."; return; }
      const newItem = { title, desc, videoId, details };
      if(isNew) DB.courses[currentCourseTab].push(newItem);
      else DB.courses[currentCourseTab][editingCourse.idx] = newItem;
      await saveCourses();
      editingCourse = null;
      renderCourses();
    };
    return;
  }
  DB.courses[currentCourseTab].forEach((item, idx) => {
    const sec = document.createElement("div");
    sec.className = "course-section";
    sec.innerHTML = `
      <h4>${item.title}</h4><p>${item.desc}</p>
      <a class="workout-link" href="https://www.youtube.com/watch?v=${item.videoId}" target="_blank" rel="noopener">▶ Watch on YouTube</a>
      <div class="yt-thumb-wrap"><a href="https://www.youtube.com/watch?v=${item.videoId}" target="_blank" rel="noopener"><img class="yt-thumb" src="https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg" alt="${item.title}" loading="lazy"><span class="yt-play-btn">▶</span></a></div>
      <button class="accordion-toggle" data-idx="${idx}"><span>Why &amp; What This Is For</span><span class="accordion-arrow">▾</span></button>
      <div class="accordion-panel" id="accordion-${idx}"><p>${item.details}</p></div>
      ${isCourseEditor() ? `<div class="button-row" style="margin-top:10px"><button class="btn-secondary course-edit-btn" data-idx="${idx}">✏️ Edit</button><button class="btn-secondary course-delete-btn" data-idx="${idx}">🗑️ Delete</button></div>` : ""}
    `;
    contentEl.appendChild(sec);
  });
  contentEl.querySelectorAll(".accordion-toggle").forEach(btn => {
    btn.onclick = () => {
      const panel = document.getElementById(`accordion-${btn.dataset.idx}`);
      panel.classList.toggle("open"); btn.classList.toggle("open");
    };
  });
  contentEl.querySelectorAll(".course-edit-btn").forEach(btn => {
    btn.onclick = () => { editingCourse = { cat: currentCourseTab, idx: Number(btn.dataset.idx) }; renderCourses(); };
  });
  contentEl.querySelectorAll(".course-delete-btn").forEach(btn => {
    btn.onclick = async () => {
      const idx = Number(btn.dataset.idx);
      const title = DB.courses[currentCourseTab][idx].title;
      if(confirm(`Delete "${title}"?`)){
        DB.courses[currentCourseTab].splice(idx, 1);
        await saveCourses();
        renderCourses();
      }
    };
  });
}

// ══════════════════════════════════════════════
//  TRAINER FUNCTIONS
// ══════════════════════════════════════════════
function renderTrainerHome(){
  const trainer = DB.trainers[STATE.currentUser];
  const name    = trainer ? trainer.name : "";
  document.getElementById("trainer-topbar-name").textContent = name;
  const avatarEl = document.getElementById("trainer-avatar-initials");
  if(avatarEl && name){
    const parts = name.trim().split(/\s+/).filter(Boolean);
    avatarEl.textContent = parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : (parts[0] ? parts[0][0].toUpperCase() : "T");
  }
  document.getElementById("trainer-member-count").textContent   = Object.keys(DB.users).length;
  document.getElementById("trainer-challenge-count").textContent = DB.gymChallenges.length;
}

function renderCoachProfile(){
  const trainer = DB.trainers[STATE.currentUser];
  if(!trainer) return;
  document.getElementById("coach-profile-name").value   = trainer.name   || "";
  document.getElementById("coach-profile-email").value  = STATE.currentUser || "";
  document.getElementById("coach-profile-weight").value = trainer.weight  || "";
  document.getElementById("coach-profile-height").value = trainer.height  || "";
  updateCoachBMI();
}
function updateCoachBMI(){
  const w     = parseFloat(document.getElementById("coach-profile-weight").value);
  const h     = parseFloat(document.getElementById("coach-profile-height").value);
  const valEl = document.getElementById("coach-bmi-value");
  const catEl = document.getElementById("coach-bmi-cat");
  if(!w || !h || h <= 0){ valEl.textContent = "—"; catEl.textContent = ""; catEl.style.color = ""; return; }
  const bmi = w / ((h / 100) ** 2);
  valEl.textContent = bmi.toFixed(1);
  let cat = "", color = "";
  if(bmi < 18.5){    cat = "Underweight"; color = "#5ab0d0"; }
  else if(bmi < 25){ cat = "Normal";      color = "#4caf50"; }
  else if(bmi < 30){ cat = "Overweight";  color = "var(--gold)"; }
  else {             cat = "Obese";        color = "var(--maroon-bright)"; }
  catEl.textContent = cat; catEl.style.color = color;
  valEl.style.color = color;
}
window.updateCoachBMI = updateCoachBMI;

document.getElementById("btn-save-coach-profile").onclick = async () => {
  const trainer = DB.trainers[STATE.currentUser];
  if(!trainer) return;
  const name   = document.getElementById("coach-profile-name").value.trim();
  const weight = parseFloat(document.getElementById("coach-profile-weight").value) || null;
  const height = parseFloat(document.getElementById("coach-profile-height").value) || null;
  if(!name){ alert("Name cannot be empty."); return; }
  trainer.name = name; trainer.weight = weight; trainer.height = height;
  await saveTrainer(STATE.currentUser);
  renderTrainerHome();
  alert("Profile saved!");
};
document.getElementById("btn-coach-logout").onclick = doLogout;

function renderTrainerMembers(){
  const listEl  = document.getElementById("trainer-members-list");
  listEl.innerHTML = "";
  const members = Object.entries(DB.users);
  if(members.length === 0){ listEl.innerHTML = "<p style='color:var(--muted)'>No members registered yet.</p>"; return; }
  members.forEach(([email, user]) => {
    const logs     = DB.workoutLogs[email] || [];
    const plan     = DB.workoutPlans[email] || DB.trainerAssignedPlans[email];
    const feedback = DB.trainerFeedback[email] || [];
    const div = document.createElement("div");
    div.className = "history-entry";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <strong>${user.name || email}</strong>
      <span class="meta">${email}</span>
      <span class="meta">Workouts logged: ${logs.length} &nbsp;·&nbsp; Plan: ${plan ? plan.goal||"Assigned" : "None"} &nbsp;·&nbsp; Feedback: ${feedback.length}</span>
    `;
    div.onclick = () => { STATE.trainerSelectedMember = email; showScreen("trainer_assign"); };
    listEl.appendChild(div);
  });
}

function renderTrainerAssign(){
  const email = STATE.trainerSelectedMember;
  if(!email){ document.getElementById("trainer-assign-title").textContent = "Select a member first"; return; }
  const user     = DB.users[email];
  const existing = DB.trainerAssignedPlans[email] || {};
  const feedback = DB.trainerFeedback[email] || [];
  const logs     = DB.workoutLogs[email] || [];
  document.getElementById("trainer-assign-title").textContent = user ? user.name : email;
  document.getElementById("trainer-assign-email").textContent = email;
  document.getElementById("ta-goal").value     = existing.goal || "Build Muscle";
  document.getElementById("ta-duration").value = existing.duration || 30;
  document.getElementById("ta-notes").value    = existing.notes || "";
  document.getElementById("ta-time").value     = existing.workoutTime || "";
  document.getElementById("btn-ta-delete-plan").style.display = DB.trainerAssignedPlans[email] ? "block" : "none";
  STATE.trainerSelectedDays = existing.days ? [...existing.days] : [];
  renderTADayGrid();
  const fbEl = document.getElementById("ta-feedback-list");
  fbEl.innerHTML = "";
  if(feedback.length === 0){
    fbEl.innerHTML = "<p style='color:var(--muted);font-size:13px'>No feedback yet.</p>";
  } else {
    [...feedback].reverse().forEach(f => {
      const d = document.createElement("div");
      d.className = "history-entry";
      d.innerHTML = `<strong>${f.trainerName}</strong><span class="meta">${f.date}</span><p style="margin:4px 0 0;font-size:13px;color:var(--text)">${f.note}</p>`;
      fbEl.appendChild(d);
    });
  }
  const logsEl = document.getElementById("ta-member-logs");
  logsEl.innerHTML = "";
  if(logs.length === 0){
    logsEl.innerHTML = "<p style='color:var(--muted);font-size:13px'>No logged workouts.</p>";
  } else {
    [...logs].reverse().slice(0,5).forEach(log => {
      const d = document.createElement("div");
      d.className = "history-entry";
      d.innerHTML = `<strong>${log.type}</strong> — ${log.duration} mins<br>${log.calories.toFixed(1)} kcal<span class="meta">${new Date(log.date).toLocaleDateString()}</span>`;
      logsEl.appendChild(d);
    });
  }
}

function renderTADayGrid(){
  const grid = document.getElementById("ta-day-grid");
  if(!grid) return;
  grid.innerHTML = "";
  DAYS.forEach(day => {
    const btn = document.createElement("button");
    btn.className = "day-btn" + (STATE.trainerSelectedDays.includes(day) ? " selected" : "");
    btn.textContent = day; btn.type = "button";
    btn.onclick = () => {
      STATE.trainerSelectedDays = STATE.trainerSelectedDays.includes(day)
        ? STATE.trainerSelectedDays.filter(d => d !== day)
        : [...STATE.trainerSelectedDays, day];
      renderTADayGrid();
    };
    grid.appendChild(btn);
  });
}

document.getElementById("btn-ta-save-plan").onclick = async () => {
  const email = STATE.trainerSelectedMember;
  if(!email){ alert("No member selected."); return; }
  const goal        = document.getElementById("ta-goal").value;
  const duration    = parseInt(document.getElementById("ta-duration").value) || 30;
  const notes       = document.getElementById("ta-notes").value.trim();
  const workoutTime = document.getElementById("ta-time").value;
  const days        = STATE.trainerSelectedDays;
  if(days.length === 0){ alert("Please select at least one workout day."); return; }
  const trainer = DB.trainers[STATE.currentUser];
  const plan = { goal, duration, days, notes, workoutTime, assignedBy: trainer ? trainer.name : STATE.currentUser, date: new Date().toLocaleDateString() };
  DB.trainerAssignedPlans[email] = plan;
  await saveAssignedPlan(email);
  alert(`Plan assigned to ${DB.users[email] ? DB.users[email].name : email}!`);
  renderTrainerAssign();
};

document.getElementById("btn-ta-delete-plan").onclick = async () => {
  const email = STATE.trainerSelectedMember;
  if(!email || !DB.trainerAssignedPlans[email]){ alert("No assigned plan to delete."); return; }
  const memberName = DB.users[email] ? DB.users[email].name : email;
  if(!confirm(`Delete the assigned plan for ${memberName}? This cannot be undone.`)) return;
  delete DB.trainerAssignedPlans[email];
  await saveAssignedPlan(email);
  alert(`Assigned plan for ${memberName} has been deleted.`);
  renderTrainerAssign();
};

document.getElementById("btn-ta-add-feedback").onclick = async () => {
  const email = STATE.trainerSelectedMember;
  if(!email){ alert("No member selected."); return; }
  const note = document.getElementById("ta-feedback-input").value.trim();
  if(!note){ alert("Please enter feedback text."); return; }
  const trainer = DB.trainers[STATE.currentUser];
  if(!DB.trainerFeedback[email]) DB.trainerFeedback[email] = [];
  DB.trainerFeedback[email].push({ note, trainerName: trainer ? trainer.name : STATE.currentUser, date: new Date().toLocaleString() });
  document.getElementById("ta-feedback-input").value = "";
  await saveFeedback(email);
  renderTrainerAssign();
};

function renderTrainerProgress(){
  const listEl = document.getElementById("trainer-progress-list");
  listEl.innerHTML = "";
  const members = Object.entries(DB.users);
  if(members.length === 0){ listEl.innerHTML = "<p style='color:var(--muted)'>No members yet.</p>"; return; }
  members.forEach(([email, user]) => {
    const logs        = DB.workoutLogs[email] || [];
    const plan        = DB.workoutPlans[email] || DB.trainerAssignedPlans[email];
    const streak      = computeStreak(logs);
    const consistency = computeConsistency(plan, logs);
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekBurned  = logs.filter(l => new Date(l.date) >= sevenDaysAgo).reduce((s,l) => s+(l.calories||0), 0);
    const div = document.createElement("div");
    div.className = "history-entry member-progress-card";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><strong style="font-size:15px">${user.name||email}</strong><span class="meta" style="display:block">${email}</span></div>
        <span style="color:var(--maroon-bright);font-size:20px">›</span>
      </div>
      <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap">
        <div class="mini-stat"><span class="mini-val" style="color:var(--gold)">${streak}</span><span class="mini-lbl">Day Streak 🔥</span></div>
        <div class="mini-stat"><span class="mini-val">${consistency}%</span><span class="mini-lbl">Consistency</span></div>
        <div class="mini-stat"><span class="mini-val">${weekBurned.toFixed(0)}</span><span class="mini-lbl">Weekly kcal</span></div>
        <div class="mini-stat"><span class="mini-val">${logs.length}</span><span class="mini-lbl">Total Logs</span></div>
      </div>
      <span class="meta" style="margin-top:6px;display:block">Plan: ${plan ? (plan.goal||"Assigned") + " · " + (plan.days||[]).join(", ") : "No plan assigned"}</span>
    `;
    div.onclick = () => { STATE.memberDetailEmail = email; showScreen("trainer_member_detail"); };
    listEl.appendChild(div);
  });
}

function renderMemberDetail(){
  const email = STATE.memberDetailEmail;
  if(!email) return;
  const user     = DB.users[email];
  const logs     = DB.workoutLogs[email] || [];
  const plan     = DB.workoutPlans[email] || DB.trainerAssignedPlans[email];
  const feedback = DB.trainerFeedback[email] || [];
  document.getElementById("detail-member-name").textContent  = user ? user.name : email;
  document.getElementById("detail-member-email").textContent = email;
  const streak      = computeStreak(logs);
  const consistency = computeConsistency(plan, logs);
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7);
  const weekBurned  = logs.filter(l => new Date(l.date) >= sevenDaysAgo).reduce((s,l) => s+(l.calories||0), 0);
  const WEEKLY_GOAL = getCalorieGoals(DB.workoutPlans[email], user).weekly;
  document.getElementById("detail-streak").textContent      = streak;
  document.getElementById("detail-consistency").textContent = consistency + "%";
  document.getElementById("detail-week-kcal").textContent   = weekBurned.toFixed(0);
  document.getElementById("detail-total-logs").textContent  = logs.length;
  document.getElementById("detail-weight").textContent = user && user.weight ? user.weight + " kg" : "—";
  document.getElementById("detail-bmi").textContent = (user && user.weight && user.height)
    ? (user.weight / ((user.height/100)**2)).toFixed(1) : "—";
  setRing("detail-ring-weekly", weekBurned / WEEKLY_GOAL);
  document.getElementById("detail-weekly-label").textContent =
    `${weekBurned.toFixed(0)} / ${WEEKLY_GOAL} kcal${weekBurned > WEEKLY_GOAL ? " ✓" : ""}`;
  const planEl = document.getElementById("detail-plan-info");
  if(plan){
    planEl.innerHTML = `
      <div class="detail-plan-row"><span class="detail-plan-key">Goal</span><span class="detail-plan-val">${plan.goal||"—"}</span></div>
      <div class="detail-plan-row"><span class="detail-plan-key">Days</span><span class="detail-plan-val">${(plan.days||[]).join(", ")||"—"}</span></div>
      <div class="detail-plan-row"><span class="detail-plan-key">Duration</span><span class="detail-plan-val">${plan.duration||"—"} mins/day</span></div>
      ${plan.notes ? `<div class="detail-plan-row"><span class="detail-plan-key">Notes</span><span class="detail-plan-val">${plan.notes}</span></div>` : ""}
      <div class="detail-plan-row"><span class="detail-plan-key">Assigned by</span><span class="detail-plan-val">${plan.assignedBy||"Self"}</span></div>
    `;
  } else {
    planEl.innerHTML = "<p style='color:var(--muted);font-size:13px'>No plan assigned yet.</p>";
  }
  const weekBreakEl  = document.getElementById("detail-week-breakdown");
  weekBreakEl.innerHTML = "";
  const dayLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  for(let i=6; i>=0; i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const dk = dateKey(d);
    const dayLogs = logs.filter(l => dateKey(new Date(l.date)) === dk);
    const dayCals = dayLogs.reduce((s,l) => s+(l.calories||0), 0);
    const isPlanned = plan && (plan.days||[]).includes(dayLabels[d.getDay()]);
    const hasLog    = dayLogs.length > 0;
    const div = document.createElement("div");
    div.className = "week-day-row";
    div.innerHTML = `
      <span class="week-day-label">${dayLabels[d.getDay()]} ${d.getDate()}</span>
      <span class="week-day-bar-wrap"><span class="week-day-bar" style="width:${Math.min(dayCals/5,100)}%;background:${hasLog ? "var(--maroon-bright)" : "var(--rail)"}"></span></span>
      <span class="week-day-kcal ${hasLog ? "" : "muted"}">${hasLog ? dayCals.toFixed(0)+" kcal" : isPlanned ? "⚠️ missed" : "—"}</span>
    `;
    weekBreakEl.appendChild(div);
  }
  const histEl = document.getElementById("detail-history");
  histEl.innerHTML = "";
  if(logs.length === 0){
    histEl.innerHTML = "<p style='color:var(--muted);font-size:13px'>No logged workouts yet.</p>";
  } else {
    [...logs].reverse().forEach(log => {
      const d = document.createElement("div");
      d.className = "history-entry";
      d.innerHTML = `<strong>${log.type}</strong> — ${log.duration} mins<br>${log.calories.toFixed(1)} kcal burned<span class="meta">${log.date}${log.startTime ? " · started "+log.startTime : ""}</span>`;
      histEl.appendChild(d);
    });
  }
  const fbEl = document.getElementById("detail-feedback");
  fbEl.innerHTML = "";
  if(feedback.length === 0){
    fbEl.innerHTML = "<p style='color:var(--muted);font-size:13px'>No feedback yet.</p>";
  } else {
    [...feedback].reverse().forEach(f => {
      const d = document.createElement("div");
      d.className = "history-entry";
      d.innerHTML = `<strong>${f.trainerName}</strong><span class="meta">${f.date}</span><p style="margin:4px 0 0;font-size:13px;color:var(--text)">${f.note}</p>`;
      fbEl.appendChild(d);
    });
  }
}

function renderTrainerChallenges(){
  const listEl = document.getElementById("trainer-challenges-list");
  listEl.innerHTML = "";
  if(DB.gymChallenges.length === 0){ listEl.innerHTML = "<p style='color:var(--muted)'>No challenges created yet.</p>"; return; }
  [...DB.gymChallenges].reverse().forEach((ch, i) => {
    const div = document.createElement("div");
    div.className = "history-entry";
    div.innerHTML = `
      <strong>${ch.title}</strong>
      <span class="meta">Deadline: ${ch.deadline||"Open"} &nbsp;·&nbsp; By: ${ch.createdBy}</span>
      <span class="meta">Goal: ${ch.workoutType||"Any"} workout, ${ch.durationDays||30} day(s) logged</span>
      <p style="margin:6px 0 0;font-size:13px;color:var(--text)">${ch.desc}</p>
      <button class="btn-secondary" style="margin-top:8px;padding:6px 12px;font-size:12px" onclick="deleteChallenge(${DB.gymChallenges.length - 1 - i})">🗑️ Delete</button>
    `;
    listEl.appendChild(div);
  });
}

async function deleteChallenge(idx){
  if(!confirm("Delete this challenge?")) return;
  DB.gymChallenges.splice(idx, 1);
  await saveGymChallenges();
  renderTrainerChallenges();
}
window.deleteChallenge = deleteChallenge;

document.getElementById("btn-add-challenge").onclick = async () => {
  const title       = document.getElementById("ch-title").value.trim();
  const desc        = document.getElementById("ch-desc").value.trim();
  const deadline    = document.getElementById("ch-deadline").value;
  const workoutType = document.getElementById("ch-workout-type").value;
  const durationDays = parseInt(document.getElementById("ch-duration-days").value, 10) || 30;
  if(!title || !desc){ alert("Please fill in the title and description."); return; }
  const trainer = DB.trainers[STATE.currentUser];
  DB.gymChallenges.push({
    id: Date.now(),
    title, desc, deadline, workoutType, durationDays,
    createdBy: trainer ? trainer.name : STATE.currentUser,
    date: new Date().toLocaleDateString()
  });
  document.getElementById("ch-title").value        = "";
  document.getElementById("ch-desc").value         = "";
  document.getElementById("ch-deadline").value     = "";
  document.getElementById("ch-workout-type").value = "Any";
  document.getElementById("ch-duration-days").value = "30";
  await saveGymChallenges();
  renderTrainerChallenges();
};

// ══════════════════════════════════════════════
//  DESKTOP SCROLL SUPPORT FOR .tabs ROWS
//  (mobile gets touch-drag for free; desktop needs
//   wheel + click-drag since there's no touch gesture)
// ══════════════════════════════════════════════
(function enableDesktopTabsScroll(){
  // Vertical wheel → horizontal scroll, while hovering a .tabs row
  document.addEventListener("wheel", (e) => {
    const tabs = e.target.closest(".tabs");
    if(!tabs) return;
    if(tabs.scrollWidth <= tabs.clientWidth) return; // nothing to scroll
    if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
      e.preventDefault();
      tabs.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // Click-and-drag scrolling
  let dragTarget = null, startX = 0, startScroll = 0, dragged = false;

  document.addEventListener("mousedown", (e) => {
    const tabs = e.target.closest(".tabs");
    if(!tabs) return;
    dragTarget = tabs;
    startX = e.pageX;
    startScroll = tabs.scrollLeft;
    dragged = false;
    tabs.classList.add("dragging");
  });

  document.addEventListener("mousemove", (e) => {
    if(!dragTarget) return;
    const dx = e.pageX - startX;
    if(Math.abs(dx) > 4) dragged = true;
    dragTarget.scrollLeft = startScroll - dx;
  });

  document.addEventListener("mouseup", () => {
    if(dragTarget) dragTarget.classList.remove("dragging");
    dragTarget = null;
  });

  // If a real drag happened, swallow the click so it doesn't trigger
  // the tab's onclick (prevents accidentally switching category after dragging)
  document.addEventListener("click", (e) => {
    if(dragged && e.target.closest(".tabs")){
      e.preventDefault();
      e.stopPropagation();
    }
    dragged = false;
  }, true);
})();

// ══════════════════════════════════════════════
//  KICK OFF
// ══════════════════════════════════════════════
bootstrap();
