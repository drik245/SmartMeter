/* =============================================
   APP.JS — Main Application Logic
   Real-time Firebase listeners + UI updates
   ============================================= */

(function () {
    'use strict';

    // --- DOM elements cache ---
    const DOM = {
        currentValue: document.getElementById('current-value'),
        voltageValue: document.getElementById('voltage-value'),
        powerValue: document.getElementById('power-value'),
        energyValue: document.getElementById('energy-value'),
        lastUpdated: document.getElementById('last-updated'),
        connectionStatus: document.getElementById('connection-status'),
        peakDemandValue: document.getElementById('peak-demand-value'),
        peakDemandTime: document.getElementById('peak-demand-time'),
        costToday: document.getElementById('cost-today'),
        costWeek: document.getElementById('cost-week'),
        costMonth: document.getElementById('cost-month'),
        costProjected: document.getElementById('cost-projected'),
        alertsList: document.getElementById('alerts-list'),
        // Weekly peaks
        peakMon: document.getElementById('peak-mon'),
        peakTue: document.getElementById('peak-tue'),
        peakWed: document.getElementById('peak-wed'),
        peakThu: document.getElementById('peak-thu'),
        peakFri: document.getElementById('peak-fri'),
        peakSat: document.getElementById('peak-sat'),
        peakSun: document.getElementById('peak-sun'),
    };

    const DAY_KEYS = ['peakSun', 'peakMon', 'peakTue', 'peakWed', 'peakThu', 'peakFri', 'peakSat'];
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // --- State ---
    let peakPowerToday = 0;
    let peakTimeToday = '';
    let alertQueue = [];
    const MAX_ALERTS = 8;
    let isConnected = false;
    let lastDataTimestamp = 0;
    let inDemoMode = false;
    let demoIntervalId = null;
    let firebaseListenersActive = false;

    // =========================================
    //  DEMO MODE  (simulated data)
    // =========================================
    function hasFirebaseConfig() {
        return firebaseConfig.apiKey !== 'YOUR_API_KEY';
    }

    function startDemoMode() {
        // Clear any previous demo interval (safe for re-entry)
        if (demoIntervalId) {
            clearInterval(demoIntervalId);
            demoIntervalId = null;
        }
        inDemoMode = true;
        console.log('%c⚡ DEMO MODE — Showing simulated data',
            'color: #fbbf24; font-weight: bold; font-size: 14px;');
        setConnectionStatus(true, 'Demo');
        updateDemoButton(true);

        // Reset state
        peakPowerToday = 0;
        peakTimeToday = '';
        alertQueue = [];
        powerDataStore.length = 0;

        // Seed load profile with realistic data
        const seedProfile = [
            120, 80, 60, 50, 45, 60, 200, 650, 900, 750,
            600, 500, 550, 700, 650, 500, 450, 600, 950, 1100,
            1000, 850, 500, 250
        ];
        updateLoadProfile(seedProfile);

        // Seed weekly peaks
        const weeklyPeaks = {
            Mon: 1620, Tue: 2100, Wed: 1850, Thu: 1920,
            Fri: 2050, Sat: 1780, Sun: 2341
        };
        updateWeeklyPeaks(weeklyPeaks);

        // Seed alerts
        addAlert('red', 'Power spike detected — 2,341 W at 08:14', 'Today · 08:14 AM');
        addAlert('green', 'System connected and logging normally', 'Today · 00:00 AM');
        addAlert('orange', 'High consumption period — 19:00 to 21:00 yesterday', 'Yesterday · 21:00');

        // Simulate 24h of history (1440 minutes) — bulk seed for performance
        let simTime = Date.now() - 1440 * 60 * 1000;
        const seedPoints = [];
        for (let i = 0; i < 1440; i++) {
            const t = new Date(simTime + i * 60000);
            const hour = t.getHours();
            const dailyCurve = [
                120, 80, 60, 50, 45, 60, 200, 650, 900, 750,
                600, 500, 550, 700, 650, 500, 450, 600, 950, 1100,
                1000, 850, 500, 250
            ][hour];
            const noise = (Math.random() - 0.5) * 150 + Math.sin(i * 0.05) * 80;
            const basePower = Math.max(30, dailyCurve + noise);
            const timeStr = t.getHours().toString().padStart(2, '0') + ':' +
                t.getMinutes().toString().padStart(2, '0');
            seedPoints.push({ time: timeStr, timestamp: simTime + i * 60000, power: Math.round(basePower) });
        }
        bulkSeedPowerTrend(seedPoints);

        // Demo tick — generates one set of live readings
        function demoTick() {
            if (!inDemoMode) return;
            const now = new Date();
            const second = now.getSeconds();
            const minute = now.getMinutes();

            const baseCurrent = 4.0 + Math.sin(second * 0.1) * 0.5 + (Math.random() - 0.5) * 0.3;
            const voltage = 228 + Math.sin(minute * 0.2) * 5 + (Math.random() - 0.5) * 3;
            const power = Math.round(voltage * baseCurrent);
            const energyIncrement = power / 3600 / 1000 * 2;

            updateLiveReadings({
                current: parseFloat(baseCurrent.toFixed(2)),
                voltage: Math.round(voltage),
                power: power,
                energy: parseFloat((3.0 + minute * 0.02 + energyIncrement).toFixed(2)),
                timestamp: now.getTime()
            });

            if (second < 2) {
                const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                    now.getMinutes().toString().padStart(2, '0');
                updatePowerTrend(timeStr, power);
            }
        }

        // Show live readings immediately, then continue every 2 seconds
        demoTick();
        demoIntervalId = setInterval(demoTick, 2000);

        updateCosts(3.41);
    }

    function stopDemoMode() {
        inDemoMode = false;
        if (demoIntervalId) {
            clearInterval(demoIntervalId);
            demoIntervalId = null;
        }
        updateDemoButton(false);

        // Clear demo data
        peakPowerToday = 0;
        alertQueue = [];
        powerDataStore.length = 0;

        // Reset display
        DOM.currentValue.textContent = '--';
        DOM.voltageValue.textContent = '--';
        DOM.powerValue.textContent = '--';
        DOM.energyValue.textContent = '--';
        DOM.peakDemandValue.textContent = '-- W';
        DOM.peakDemandTime.textContent = 'Recorded at --:-- today';
        DOM.costToday.textContent = '₹--';
        DOM.costWeek.textContent = '₹--';
        DOM.costMonth.textContent = '₹--';
        DOM.costProjected.textContent = '₹-- est.';
        renderAlerts();
        renderPowerTrendForRange(currentRange);

        console.log('%c⚡ DEMO MODE OFF — Switching to live Firebase data',
            'color: #34d399; font-weight: bold; font-size: 14px;');

        // Restore correct connection status
        if (hasFirebaseConfig() && !firebaseListenersActive) {
            startFirebaseListeners();
        } else if (hasFirebaseConfig() && firebaseListenersActive) {
            // Listeners already running — just restore the status text
            setConnectionStatus(true, 'Connected');
        } else {
            setConnectionStatus(false, 'No config');
        }
    }

    function toggleDemoMode() {
        if (inDemoMode) {
            stopDemoMode();
        } else {
            startDemoMode();
        }
    }

    function updateDemoButton(active) {
        const btn = document.getElementById('demo-toggle-btn');
        const text = document.getElementById('demo-toggle-text');
        if (btn) btn.classList.toggle('active', active);
        if (text) text.textContent = active ? 'Stop Demo' : 'Demo';
    }

    // =========================================
    //  CONNECTION STATUS
    // =========================================
    function setConnectionStatus(online, label) {
        isConnected = online;
        const dot = DOM.connectionStatus.querySelector('.status-dot');
        const text = DOM.connectionStatus.querySelector('.status-text');
        dot.className = 'status-dot ' + (online ? 'online' : 'offline');
        text.textContent = label || (online ? 'Connected' : 'Disconnected');
    }

    // =========================================
    //  LIVE READINGS UPDATE
    // =========================================
    function flashValue(element) {
        element.classList.remove('value-flash');
        void element.offsetWidth; // trigger reflow
        element.classList.add('value-flash');
    }

    function updateLiveReadings(data) {
        if (!data) return;

        // Current
        if (data.current !== undefined) {
            DOM.currentValue.textContent = parseFloat(data.current).toFixed(2);
            flashValue(DOM.currentValue);
        }

        // Voltage
        if (data.voltage !== undefined) {
            DOM.voltageValue.textContent = Math.round(data.voltage);
            flashValue(DOM.voltageValue);
        }

        // Power
        if (data.power !== undefined) {
            DOM.powerValue.textContent = Math.round(data.power).toLocaleString();
            flashValue(DOM.powerValue);

            // Track peak
            if (data.power > peakPowerToday) {
                peakPowerToday = data.power;
                const now = new Date();
                peakTimeToday = now.getHours().toString().padStart(2, '0') + ':' +
                    now.getMinutes().toString().padStart(2, '0');
                DOM.peakDemandValue.textContent = Math.round(peakPowerToday).toLocaleString() + ' W';
                DOM.peakDemandTime.textContent = `Recorded at ${peakTimeToday} today`;

                // Update today's peak in weekly row
                const todayIndex = new Date().getDay();
                const todayKey = DAY_KEYS[todayIndex];
                if (DOM[todayKey]) {
                    DOM[todayKey].textContent = Math.round(peakPowerToday).toLocaleString() + ' W';
                    DOM[todayKey].className = 'val today-highlight';
                }
            }
        }

        // Energy
        if (data.energy !== undefined) {
            DOM.energyValue.textContent = parseFloat(data.energy).toFixed(2);
            updateCosts(data.energy);
        }

        // Timestamp
        const now = new Date();
        DOM.lastUpdated.textContent = `Last updated: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        lastDataTimestamp = Date.now();
    }

    // =========================================
    //  COST CALCULATIONS
    // =========================================
    function updateCosts(energyToday) {
        const todayCost = energyToday * COST_PER_KWH;
        DOM.costToday.textContent = '₹' + todayCost.toFixed(1);

        // Estimate week & month from today (simple extrapolation)
        const weekCost = todayCost * 5.5;  // rough average
        const monthCost = todayCost * 24;
        const projectedBill = todayCost * 30;

        DOM.costWeek.textContent = '₹' + weekCost.toFixed(0);
        DOM.costMonth.textContent = '₹' + monthCost.toFixed(0);
        DOM.costProjected.textContent = '₹' + projectedBill.toFixed(0) + ' est.';
    }

    // =========================================
    //  WEEKLY PEAKS
    // =========================================
    function updateWeeklyPeaks(data) {
        if (!data) return;
        const mapping = {
            Mon: DOM.peakMon, Tue: DOM.peakTue, Wed: DOM.peakWed,
            Thu: DOM.peakThu, Fri: DOM.peakFri, Sat: DOM.peakSat, Sun: DOM.peakSun
        };
        const todayName = DAY_NAMES[new Date().getDay()];

        for (const [day, el] of Object.entries(mapping)) {
            if (data[day] !== undefined && el) {
                el.textContent = Math.round(data[day]).toLocaleString() + ' W';
                if (day === todayName) {
                    el.className = 'val today-highlight';
                } else {
                    el.className = 'val';
                }
            }
        }
    }

    // =========================================
    //  ALERTS
    // =========================================
    function addAlert(type, message, time) {
        alertQueue.unshift({ type, message, time });
        if (alertQueue.length > MAX_ALERTS) alertQueue.pop();
        renderAlerts();
    }

    function renderAlerts() {
        DOM.alertsList.innerHTML = alertQueue.map(a => `
            <div class="alert-item">
                <span class="alert-dot ${a.type}"></span>
                <div class="alert-content">
                    <div class="alert-text">${a.message}</div>
                    <div class="alert-time">${a.time}</div>
                </div>
            </div>
        `).join('');
    }

    // =========================================
    //  FIREBASE LISTENERS (live mode)
    // =========================================
    function startFirebaseListeners() {
        firebaseListenersActive = true;
        console.log('%c⚡ LIVE MODE — Listening to Firebase Realtime Database',
            'color: #34d399; font-weight: bold; font-size: 14px;');

        // Monitor connection state (skip during demo mode)
        database.ref('.info/connected').on('value', snap => {
            if (inDemoMode) return; // Don't overwrite demo status
            setConnectionStatus(snap.val() === true, snap.val() ? 'Connected' : 'Disconnected');
        });

        // --- Live sensor data ---
        database.ref(DB_PATHS.LIVE).on('value', snap => {
            const data = snap.val();
            if (!data) return;
            updateLiveReadings(data);

            // Push to trend chart
            if (data.power !== undefined) {
                const now = new Date();
                const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                    now.getMinutes().toString().padStart(2, '0');
                updatePowerTrend(timeStr, data.power);
            }
        });

        // --- Hourly load profile ---
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        database.ref(DB_PATHS.DAILY + '/' + today + '/hourly').on('value', snap => {
            const data = snap.val();
            if (data) {
                updateLoadProfile(data);
            }
        });

        // --- Weekly peaks ---
        database.ref(DB_PATHS.PEAKS + '/weekly').on('value', snap => {
            const data = snap.val();
            if (data) updateWeeklyPeaks(data);
        });

        // --- Alerts ---
        database.ref(DB_PATHS.ALERTS).orderByChild('timestamp').limitToLast(MAX_ALERTS).on('value', snap => {
            const data = snap.val();
            if (!data) return;
            alertQueue = [];
            Object.values(data).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(a => {
                alertQueue.push({
                    type: a.type || 'neutral',
                    message: a.message || '',
                    time: a.timeStr || ''
                });
            });
            renderAlerts();
        });

        // --- Cost rate config ---
        database.ref(DB_PATHS.CONFIG + '/costPerKwh').on('value', snap => {
            if (snap.val()) {
                COST_PER_KWH = parseFloat(snap.val());
            }
        });
    }

    // =========================================
    //  STALE DATA DETECTION
    // =========================================
    setInterval(() => {
        if (!inDemoMode && isConnected && lastDataTimestamp > 0) {
            const elapsed = Date.now() - lastDataTimestamp;
            if (elapsed > 30000) { // 30 seconds without data
                addAlert('orange',
                    `No data received for ${Math.round(elapsed / 1000)}s — check ESP32 connection`,
                    new Date().toLocaleTimeString()
                );
            }
        }
    }, 15000);

    // =========================================
    //  INITIALIZATION
    // =========================================
    document.addEventListener('DOMContentLoaded', () => {
        // Wire demo toggle button
        const demoBtn = document.getElementById('demo-toggle-btn');
        if (demoBtn) {
            demoBtn.addEventListener('click', toggleDemoMode);
        }

        // Check URL parameter: ?live=true forces Firebase mode
        const urlParams = new URLSearchParams(window.location.search);
        const forceLive = urlParams.get('live') === 'true';

        if (forceLive && hasFirebaseConfig()) {
            startFirebaseListeners();
        } else {
            // Default: always start in demo mode so the site looks populated
            startDemoMode();
        }
    });

})();
