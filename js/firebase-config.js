/* =============================================
   FIREBASE CONFIGURATION
   Replace the values below with YOUR Firebase
   project credentials from the Firebase Console.
   ============================================= */

// ⚠️  INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or use existing)
// 3. Go to Project Settings > General > Your Apps > Add Web App
// 4. Copy the firebaseConfig object and paste it below
// 5. Go to Realtime Database > Create Database > Start in TEST MODE
// 6. Copy the database URL and paste it below

const firebaseConfig = {
    apiKey: "AIzaSyAx0WvkqVxFioQ1SMDJo-2Rpi6T2Ie06TE",
    authDomain: "smart-power-monitor-ddeb5.firebaseapp.com",
    databaseURL: "https://smart-power-monitor-ddeb5-default-rtdb.firebaseio.com",
    projectId: "smart-power-monitor-ddeb5",
    storageBucket: "smart-power-monitor-ddeb5.firebasestorage.app",
    messagingSenderId: "79533859066",
    appId: "1:79533859066:web:90e209982186a86eeebe21"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Database reference paths
const DB_PATHS = {
    LIVE: 'sensor/live',           // ESP32 writes live data here
    HISTORY: 'sensor/history',     // Time-series power data
    DAILY: 'sensor/daily',         // Daily energy summaries
    PEAKS: 'sensor/peaks',         // Peak demand records
    ALERTS: 'sensor/alerts',       // Alert events
    CONFIG: 'sensor/config'        // Configuration (rate per kWh, etc.)
};

// Cost configuration (₹ per kWh)  — can be overridden from Firebase
let COST_PER_KWH = 8.1;
