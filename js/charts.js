/* =============================================
   CHART.JS — Power Trend & Load Profile Charts
   ============================================= */

let powerTrendChart = null;
let loadProfileChart = null;

// --- Chart color tokens ---
const CHART_COLORS = {
    line: '#34d399',
    lineGlow: 'rgba(52, 211, 153, 0.15)',
    bar: '#60a5fa',
    barHighlight: '#93c5fd',
    grid: 'rgba(255,255,255,0.05)',
    tickLabel: '#6b7280',
    tooltipBg: '#1e2328',
    tooltipBorder: '#2a2f36',
};

// --- Shared chart defaults ---
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: CHART_COLORS.tooltipBg,
            borderColor: CHART_COLORS.tooltipBorder,
            borderWidth: 1,
            titleColor: '#e8eaed',
            bodyColor: '#9aa0a6',
            cornerRadius: 8,
            padding: 10,
            titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
            bodyFont: { family: "'Inter', sans-serif", size: 11 },
            displayColors: false,
        }
    }
};

/* -------------------------------------------
   Power Trend Chart (Line — last 30 minutes)
   ------------------------------------------- */
function initPowerTrendChart() {
    const ctx = document.getElementById('power-trend-chart').getContext('2d');

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(52, 211, 153, 0.25)');
    gradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

    powerTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Power (W)',
                data: [],
                borderColor: CHART_COLORS.line,
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: CHART_COLORS.line,
                tension: 0.35,
                fill: true,
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                x: {
                    grid: { color: CHART_COLORS.grid, drawBorder: false },
                    ticks: {
                        color: CHART_COLORS.tickLabel,
                        font: { size: 10, family: "'Inter', sans-serif" },
                        maxTicksLimit: 6,
                        maxRotation: 0,
                    },
                    border: { display: false },
                },
                y: {
                    grid: { color: CHART_COLORS.grid, drawBorder: false },
                    ticks: {
                        color: CHART_COLORS.tickLabel,
                        font: { size: 10, family: "'Inter', sans-serif" },
                        callback: v => v + 'W',
                    },
                    border: { display: false },
                    beginAtZero: true,
                }
            },
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                        label: ctx => `${ctx.parsed.y.toFixed(0)} W`
                    }
                }
            }
        }
    });
}

/* -------------------------------------------
   Load Profile Chart (Bar — hourly today)
   ------------------------------------------- */
function initLoadProfileChart() {
    const ctx = document.getElementById('load-profile-chart').getContext('2d');

    // Generate hour labels 0–23
    const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString());

    loadProfileChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hourLabels,
            datasets: [{
                label: 'Avg Power (W)',
                data: new Array(24).fill(0),
                backgroundColor: hourLabels.map(() => CHART_COLORS.bar),
                borderRadius: 3,
                borderSkipped: false,
                barPercentage: 0.7,
                categoryPercentage: 0.85,
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: CHART_COLORS.tickLabel,
                        font: { size: 9, family: "'Inter', sans-serif" },
                        maxRotation: 0,
                    },
                    border: { display: false },
                },
                y: {
                    grid: { color: CHART_COLORS.grid, drawBorder: false },
                    ticks: {
                        color: CHART_COLORS.tickLabel,
                        font: { size: 10, family: "'Inter', sans-serif" },
                        callback: v => v + 'W',
                    },
                    border: { display: false },
                    beginAtZero: true,
                }
            },
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    ...commonOptions.plugins.tooltip,
                    callbacks: {
                        title: ctx => `Hour ${ctx[0].label}:00`,
                        label: ctx => `Avg: ${ctx.parsed.y.toFixed(0)} W`
                    }
                }
            }
        }
    });
}

/* -------------------------------------------
   Time-range-aware data store for power trend
   Stores timestamped data points for up to 24h
   ------------------------------------------- */

// Each entry: { time: 'HH:MM', timestamp: Date.now(), power: number }
const powerDataStore = [];
const MAX_STORE_POINTS = 1440; // 24h at 1-min intervals
let currentRange = '30m'; // '30m' | '3h' | '24h'

const RANGE_CONFIG = {
    '30m': { minutes: 30, maxTicks: 6, title: 'Power trend — last 30 minutes' },
    '3h': { minutes: 180, maxTicks: 7, title: 'Power trend — last 3 hours' },
    '24h': { minutes: 1440, maxTicks: 8, title: 'Power trend — last 24 hours' },
};

/**
 * Push a new data point into the store and re-render chart.
 */
function updatePowerTrend(time, power) {
    if (!powerTrendChart) return;

    powerDataStore.push({ time, timestamp: Date.now(), power });

    // Trim store to max capacity
    while (powerDataStore.length > MAX_STORE_POINTS) {
        powerDataStore.shift();
    }

    renderPowerTrendForRange(currentRange);
}

/**
 * Filter store and render chart for the given range.
 */
function renderPowerTrendForRange(range) {
    if (!powerTrendChart) return;

    const cfg = RANGE_CONFIG[range];
    const cutoff = Date.now() - cfg.minutes * 60 * 1000;

    const filtered = powerDataStore.filter(d => d.timestamp >= cutoff);

    powerTrendChart.data.labels = filtered.map(d => d.time);
    powerTrendChart.data.datasets[0].data = filtered.map(d => d.power);
    powerTrendChart.options.scales.x.ticks.maxTicksLimit = cfg.maxTicks;
    powerTrendChart.update('none');
}

/**
 * Switch the active time range.
 */
function setTrendRange(range) {
    if (!RANGE_CONFIG[range]) return;
    currentRange = range;

    // Update title
    const titleEl = document.getElementById('power-trend-title');
    if (titleEl) titleEl.textContent = RANGE_CONFIG[range].title;

    // Update active button
    document.querySelectorAll('#time-range-toggle .range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });

    renderPowerTrendForRange(range);
}

/* -------------------------------------------
   Update functions — Load Profile
   ------------------------------------------- */

/**
 * Update the full load profile (24 hourly bars).
 */
function updateLoadProfile(hourlyData) {
    if (!loadProfileChart) return;

    // hourlyData should be an array of 24 values, or an object { 0: val, 1: val, ... }
    const values = Array.isArray(hourlyData)
        ? hourlyData
        : Array.from({ length: 24 }, (_, i) => hourlyData[i] || 0);

    const currentHour = new Date().getHours();

    loadProfileChart.data.datasets[0].data = values;
    // Highlight current hour
    loadProfileChart.data.datasets[0].backgroundColor = values.map((_, i) =>
        i === currentHour ? CHART_COLORS.barHighlight : CHART_COLORS.bar
    );
    loadProfileChart.update('none');
}

/**
 * Set a single hour on the load profile.
 */
function updateLoadProfileHour(hour, value) {
    if (!loadProfileChart) return;
    loadProfileChart.data.datasets[0].data[hour] = value;

    const currentHour = new Date().getHours();
    loadProfileChart.data.datasets[0].backgroundColor[hour] =
        hour === currentHour ? CHART_COLORS.barHighlight : CHART_COLORS.bar;

    loadProfileChart.update('none');
}

// Initialize charts + range toggle on load
document.addEventListener('DOMContentLoaded', () => {
    initPowerTrendChart();
    initLoadProfileChart();

    // Wire up range toggle buttons
    const toggle = document.getElementById('time-range-toggle');
    if (toggle) {
        toggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.range-btn');
            if (btn && btn.dataset.range) {
                setTrendRange(btn.dataset.range);
            }
        });
    }
});

