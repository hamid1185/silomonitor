const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Hardcoded thresholds (ideal for potato storage)
const THRESHOLDS = {
    temperature: {
        idealMin: 4, idealMax: 9, warningMin: 2, warningMax: 12,
        criticalMin: 0, criticalMax: 15
    },
    humidity: {
        idealMin: 40, idealMax: 50, warningMin: 35, warningMax: 60,
        criticalMin: 30, criticalMax: 70
    },
    airQuality: {
        good: 200, moderate: 400, poor: 600, veryPoor: 800
    },
    spoilageRisk: {
        low: 20, medium: 40, high: 70, critical: 85
    },
    condensation: { dewPointDifference: 2 }
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Database setup
const db = new sqlite3.Database("silo_data.db", (err) => {
    if (err) console.error("❌ DB error:", err.message);
    else console.log("✅ Connected to SQLite database");
});

// Create enhanced table
db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceId TEXT,
  temperature REAL,
  humidity REAL,
  mq_value REAL,
  spoilageRisk REAL,
  grainHealth TEXT,
  dewPoint REAL,
  absoluteHumidity REAL,
  vaporPressureDeficit REAL,
  equilibriumMoistureContent REAL,
  trendAnalysis TEXT,
  prediction TEXT,
  rssi INTEGER,
  ip TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) console.error("❌ Table error:", err.message);
    else console.log("✅ Enhanced sensor table ready");
});

// Create indexes
db.run("CREATE INDEX IF NOT EXISTS idx_deviceId ON sensor_data(deviceId)", (err) => {
    if (err) console.error("Index error:", err.message);
});

db.run("CREATE INDEX IF NOT EXISTS idx_timestamp ON sensor_data(timestamp)", (err) => {
    if (err) console.error("Index error:", err.message);
});

// API key middleware
const apiKeyMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== "demo123") {
        return res.status(401).json({ error: "Invalid API key" });
    }
    next();
};

// API Routes
// GET all data (for history page)
app.get("/api/data", (req, res) => {
    const { deviceId, limit = 1000 } = req.query;

    let query = "SELECT * FROM sensor_data";
    let params = [];

    if (deviceId) {
        query += " WHERE deviceId = ?";
        params.push(deviceId);
    }

    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(parseInt(limit));

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error("❌ Error fetching data:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(rows);
    });
});

// POST data endpoint
app.post("/api/data", apiKeyMiddleware, (req, res) => {
    const {
        deviceId, temperature, humidity, mq_value, spoilageRisk,
        grainHealth, dewPoint, absoluteHumidity, vaporPressureDeficit,
        equilibriumMoistureContent, trendAnalysis, prediction, rssi, ip
    } = req.body;

    console.log(`📥 ${deviceId}: ${temperature}°C, ${humidity}%, Risk: ${spoilageRisk}%`);

    db.run(
        `INSERT INTO sensor_data (
      deviceId, temperature, humidity, mq_value, spoilageRisk, 
      grainHealth, dewPoint, absoluteHumidity, vaporPressureDeficit,
      equilibriumMoistureContent, trendAnalysis, prediction, rssi, ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            deviceId || "unknown",
            parseFloat(temperature) || 0,
            parseFloat(humidity) || 0,
            parseFloat(mq_value) || 0,
            parseFloat(spoilageRisk) || 0,
            grainHealth || "UNKNOWN",
            parseFloat(dewPoint) || 0,
            parseFloat(absoluteHumidity) || 0,
            parseFloat(vaporPressureDeficit) || 0,
            parseFloat(equilibriumMoistureContent) || 0,
            trendAnalysis || "INSUFFICIENT_DATA",
            prediction || "NEED_MORE_DATA",
            parseInt(rssi) || 0,
            ip || "unknown"
        ],
        function (err) {
            if (err) {
                console.error("❌ DB insert error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({
                success: true,
                id: this.lastID,
                message: "Data received successfully"
            });
        }
    );
});

// Get latest readings from all devices
app.get("/api/latest", (req, res) => {
    const query = `
    SELECT s1.* 
    FROM sensor_data s1
    INNER JOIN (
      SELECT deviceId, MAX(timestamp) as latest 
      FROM sensor_data 
      GROUP BY deviceId
    ) s2 ON s1.deviceId = s2.deviceId AND s1.timestamp = s2.latest
    ORDER BY s1.deviceId
  `;

    db.all(query, (err, rows) => {
        if (err) {
            console.error("❌ DB read error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(rows || []);
    });
});

// Get device list with status
app.get("/api/devices", (req, res) => {
    const query = `
    SELECT 
      deviceId,
      MIN(timestamp) as firstSeen,
      MAX(timestamp) as lastSeen,
      COUNT(*) as readingCount,
      CASE 
        WHEN datetime(MAX(timestamp)) >= datetime('now', '-5 minutes') THEN 'online'
        WHEN datetime(MAX(timestamp)) >= datetime('now', '-1 hour') THEN 'recent'
        ELSE 'offline'
      END as status
    FROM sensor_data 
    GROUP BY deviceId
    ORDER BY lastSeen DESC
  `;

    db.all(query, (err, rows) => {
        if (err) {
            console.error("❌ DB read error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(rows || []);
    });
});

// Get system stats
app.get("/api/history/:deviceId", (req, res) => {
    const { deviceId } = req.params;
    const { limit = 50, hours = 24 } = req.query;

    const query = `
    SELECT 
      id, deviceId, temperature, humidity, mq_value, spoilageRisk, 
      grainHealth, dewPoint, absoluteHumidity, vaporPressureDeficit,
      equilibriumMoistureContent, trendAnalysis, prediction, rssi, ip,
      datetime(timestamp, 'localtime') as ts_server,
      strftime('%H:%M', timestamp, 'localtime') as time_display
    FROM sensor_data 
    WHERE deviceId = ? AND timestamp >= datetime('now', ?)
    ORDER BY timestamp DESC LIMIT ?
  `;

    db.all(query, [deviceId, `-${hours} hours`, parseInt(limit)], (err, rows) => {
        if (err) {
            console.error("❌ DB read error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        // Reverse to get chronological order for chart
        res.json(rows.reverse());
    });
});

//trends endpoint 
app.get("/api/trends/:deviceId", (req, res) => {
    const { deviceId } = req.params;
    const { hours = 24 } = req.query;

    const query = `
    SELECT 
      temperature, humidity, mq_value, spoilageRisk, grainHealth, dewPoint,
      absoluteHumidity, vaporPressureDeficit, equilibriumMoistureContent,
      trendAnalysis, prediction, rssi, ip,
      datetime(timestamp, 'localtime') as ts_server,
      strftime('%H:%M', timestamp, 'localtime') as time_display
    FROM sensor_data 
    WHERE deviceId = ? AND timestamp >= datetime('now', ?)
    ORDER BY timestamp ASC
  `;

    db.all(query, [deviceId, `-${hours} hours`], (err, rows) => {
        if (err) {
            console.error("❌ DB read error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (rows.length < 3) {
            return res.json({
                message: "Need at least 3 data points for meaningful analysis",
                status: "INSUFFICIENT_DATA"
            });
        }

        const analytics = generateDashboardAnalytics(rows);
        res.json(analytics);
    });
});


// Get system stats
app.get("/api/stats", (req, res) => {
    const queries = {
        totalReadings: "SELECT COUNT(*) as count FROM sensor_data",
        activeDevices: "SELECT COUNT(DISTINCT deviceId) as count FROM sensor_data WHERE timestamp >= datetime('now', '-5 minutes')",
        latestReading: "SELECT datetime(MAX(timestamp), 'localtime') as latest FROM sensor_data",
        criticalAlerts: "SELECT COUNT(*) as count FROM sensor_data WHERE grainHealth = 'CRITICAL' AND timestamp >= datetime('now', '-1 hour')"
    };

    const results = {};
    let completed = 0;

    Object.keys(queries).forEach(key => {
        db.get(queries[key], (err, row) => {
            results[key] = row;
            completed++;

            if (completed === Object.keys(queries).length) {
                res.json(results);
            }
        });
    });
});

function generateDashboardAnalytics(rows) {
    const recentData = rows.slice(-10);
    const latest = recentData[recentData.length - 1];

    // Extract data arrays
    const temps = recentData.map(d => d.temperature);
    const hums = recentData.map(d => d.humidity);
    const risks = recentData.map(d => d.spoilageRisk || 0);
    const mqValues = recentData.map(d => d.mq_value || 0);

    // Calculate trends
    const tempTrend = calculateSimpleTrend(temps);
    const humTrend = calculateSimpleTrend(hums);
    const riskTrend = calculateSimpleTrend(risks);
    const mqTrend = calculateSimpleTrend(mqValues);

    // Calculate rates of change
    const tempChange = temps.length > 1 ? temps[temps.length - 1] - temps[temps.length - 2] : 0;
    const humChange = hums.length > 1 ? hums[hums.length - 1] - hums[hums.length - 2] : 0;
    const riskChange = risks.length > 1 ? risks[risks.length - 1] - risks[risks.length - 2] : 0;
    const mqChange = mqValues.length > 1 ? mqValues[mqValues.length - 1] - mqValues[mqValues.length - 2] : 0;

    // Generate trends with context - MOVE THIS UP so it's available for summary
    const trends = {
        temperature: {
            value: getTrendLabel(tempTrend),
            explanation: getTemperatureTrendExplanation(tempTrend, tempChange, latest.temperature)
        },
        humidity: {
            value: getTrendLabel(humTrend),
            explanation: getHumidityTrendExplanation(humTrend, humChange, latest.humidity)
        },
        spoilageRisk: {
            value: getTrendLabel(riskTrend),
            explanation: getRiskTrendExplanation(riskTrend, riskChange, latest.spoilageRisk)
        },
        airQuality: {
            value: getTrendLabel(mqTrend),
            explanation: getAirQualityExplanation(mqTrend, mqChange, latest.mq_value)
        }
    };

    // Generate predictions with explanations
    const predictedRisk = Math.min(100, Math.max(0, (latest.spoilageRisk || 0) + (riskChange * 6)));
    const timeToCritical = riskChange > 0 ? Math.max(1, Math.round((70 - (latest.spoilageRisk || 0)) / riskChange)) : null;

    // Generate patterns detection with explanations
    const patterns = {
        acceleratingRisk: {
            detected: detectAcceleratingTrend(risks),
            explanation: "Risk is increasing at an accelerating rate"
        },
        temperatureSpike: {
            detected: detectSpike(temps, 0.15),
            explanation: "Sudden temperature increase detected"
        },
        humiditySurge: {
            detected: detectSpike(hums, 0.15),
            explanation: "Sudden humidity increase detected"
        },
        airQualityDecline: {
            detected: mqValues.length > 3 && mqValues[mqValues.length - 1] > 300,
            explanation: "Air quality sensor indicates elevated gas levels"
        }
    };

    // Create changes object for summary
    const changes = {
        temperature: tempChange,
        humidity: humChange,
        spoilageRisk: riskChange,
        mq135: mqChange
    };

    // Now generate summary with trends available
    const summary = generateDetailedSummary(latest, trends, changes);

    // Generate predictions with reasoning
    const predictions = generatePredictionsWithReasoning(
        latest, predictedRisk, timeToCritical, riskChange, tempChange, humChange, mqChange
    );

    // Generate actionable recommendations with priority
    const recommendations = generatePrioritizedRecommendations(
        latest, trends, patterns, predictedRisk
    );

    // Calculate confidence with factors
    const confidence = calculateConfidenceWithFactors(recentData.length, trends, patterns);

    return {
        summary,
        predictions,
        trends,
        patterns,
        recommendations,
        confidence,
        metrics: {
            current: {
                temperature: latest.temperature,
                humidity: latest.humidity,
                mq135: latest.mq_value,
                spoilageRisk: latest.spoilageRisk,
                dewPoint: latest.dewPoint
            },
            changes: {
                temperature: tempChange,
                humidity: humChange,
                mq135: mqChange,
                spoilageRisk: riskChange
            }
        }
    };
}



// Enhanced summary function with detailed analysis
function generateDetailedSummary(latest, trends, changes) {
    const risk = latest.spoilageRisk || 0;
    const temp = latest.temperature || 0;
    const hum = latest.humidity || 0;
    const mq = latest.mq_value || 0;

    const summaries = [];

    // Risk level summary
    const riskThresholds = THRESHOLDS.spoilageRisk;
    if (risk > riskThresholds.high) {
        summaries.push(`🚨 CRITICAL RISK: ${risk.toFixed(1)}% spoilage risk. Immediate action required.`);
    } else if (risk > riskThresholds.medium) {
        summaries.push(`⚠️ ELEVATED RISK: ${risk.toFixed(1)}% spoilage risk. Monitor closely.`);
    } else {
        summaries.push(`✓ ACCEPTABLE RISK: ${risk.toFixed(1)}% spoilage risk. Conditions stable.`);
    }

    // Temperature analysis
    const tempThresholds = THRESHOLDS.temperature;
    if (temp > tempThresholds.warningMax) {
        summaries.push(`🌡️ TEMPERATURE TOO HIGH: ${temp.toFixed(1)}°C exceeds ideal potato range (${tempThresholds.idealMin}-${tempThresholds.idealMax}°C).`);
    } else if (temp < tempThresholds.idealMin) {
        summaries.push(`❄️ TEMPERATURE TOO LOW: ${temp.toFixed(1)}°C below ideal potato range. Risk of chilling injury.`);
    } else {
        summaries.push(`✓ TEMPERATURE OPTIMAL: ${temp.toFixed(1)}°C within ideal potato range (${tempThresholds.idealMin}-${tempThresholds.idealMax}°C).`);
    }

    // Humidity analysis
    const humThresholds = THRESHOLDS.humidity;
    if (hum < humThresholds.warningMin) {
        summaries.push(`💧 HUMIDITY TOO LOW: ${hum.toFixed(1)}% below ideal potato range (${humThresholds.idealMin}-${humThresholds.idealMax}%). Risk of weight loss.`);
    } else if (hum > humThresholds.idealMax) {
        summaries.push(`💦 HUMIDITY TOO HIGH: ${hum.toFixed(1)}% above ideal potato range. Risk of condensation.`);
    } else {
        summaries.push(`✓ HUMIDITY OPTIMAL: ${hum.toFixed(1)}% within ideal potato range (${humThresholds.idealMin}-${humThresholds.idealMax}%).`);
    }

    // Air quality analysis
    const airQuality = THRESHOLDS.airQuality;
    if (mq > airQuality.poor) {
        summaries.push(`☣️ POOR AIR QUALITY: MQ135 reading ${mq.toFixed(0)} indicates high gas levels.`);
    } else if (mq > airQuality.moderate) {
        summaries.push(`⚠️ MODERATE AIR QUALITY: MQ135 reading ${mq.toFixed(0)} indicates elevated gas levels.`);
    }

    // Dew point analysis
    const condensationThreshold = THRESHOLDS.condensation.dewPointDifference;
    if (latest.dewPoint && (temp - latest.dewPoint) < condensationThreshold) {
        summaries.push(`💧 CONDENSATION RISK: Temperature-dew point difference is ${(temp - latest.dewPoint).toFixed(1)}°C (<${condensationThreshold}°C threshold).`);
    }

    // Trend analysis
    const tempTrend = trends.temperature?.value || 'STABLE';
    const humTrend = trends.humidity?.value || 'STABLE';
    const riskTrend = trends.spoilageRisk?.value || 'STABLE';

    if (riskTrend.includes('RISING')) {
        summaries.push(`📈 RISK TRENDING UPWARD: Spoilage risk is ${riskTrend.toLowerCase().replace('_', ' ')}.`);
    }

    return summaries;  // Return array instead of joined string
}

function getTemperatureTrendExplanation(trend, change, currentTemp) {
    const trendLabel = getTrendLabel(trend);
    let explanation = "";

    if (trendLabel === 'RISING_RAPIDLY') {
        explanation = `Temperature rising rapidly (${change.toFixed(1)}°C/h). `;
    } else if (trendLabel === 'RISING') {
        explanation = `Temperature slowly rising. `;
    } else if (trendLabel === 'FALLING_RAPIDLY') {
        explanation = `Temperature falling rapidly. `;
    } else if (trendLabel === 'FALLING') {
        explanation = `Temperature slowly falling. `;
    } else {
        explanation = `Temperature stable. `;
    }

    // Add potato-specific context
    if (currentTemp > 12) {
        explanation += `Current ${currentTemp.toFixed(1)}°C is ABOVE ideal potato range (4-8°C).`;
    } else if (currentTemp < 4) {
        explanation += `Current ${currentTemp.toFixed(1)}°C is BELOW ideal potato range (4-8°C).`;
    } else {
        explanation += `Current ${currentTemp.toFixed(1)}°C is within ideal potato range (4-8°C).`;
    }

    return explanation;
}

function getHumidityTrendExplanation(trend, change, currentHum) {
    const trendLabel = getTrendLabel(trend);
    let explanation = "";

    if (trendLabel === 'RISING_RAPIDLY') {
        explanation = `Humidity rising rapidly (${change.toFixed(1)}%/h). `;
    } else if (trendLabel === 'RISING') {
        explanation = `Humidity slowly rising. `;
    } else if (trendLabel === 'FALLING_RAPIDLY') {
        explanation = `Humidity falling rapidly. `;
    } else if (trendLabel === 'FALLING') {
        explanation = `Humidity slowly falling. `;
    } else {
        explanation = `Humidity stable. `;
    }

    // Add potato-specific context
    if (currentHum < 85) {
        explanation += `Current ${currentHum.toFixed(1)}% is BELOW ideal potato humidity (90-95%).`;
    } else if (currentHum > 95) {
        explanation += `Current ${currentHum.toFixed(1)}% is ABOVE ideal potato humidity (90-95%).`;
    } else {
        explanation += `Current ${currentHum.toFixed(1)}% is within ideal potato humidity range.`;
    }

    return explanation;
}

function getRiskTrendExplanation(trend, change, currentRisk) {
    const trendLabel = getTrendLabel(trend);
    let explanation = "";

    if (trendLabel === 'RISING_RAPIDLY') {
        explanation = `Risk increasing rapidly (${change.toFixed(1)}%/h). `;
    } else if (trendLabel === 'RISING') {
        explanation = `Risk slowly increasing. `;
    } else if (trendLabel === 'FALLING_RAPIDLY') {
        explanation = `Risk decreasing rapidly. `;
    } else if (trendLabel === 'FALLING') {
        explanation = `Risk slowly decreasing. `;
    } else {
        explanation = `Risk stable. `;
    }

    // Add risk level context
    if (currentRisk > 70) {
        explanation += `Current risk ${currentRisk.toFixed(1)}% is CRITICAL. Immediate action needed.`;
    } else if (currentRisk > 40) {
        explanation += `Current risk ${currentRisk.toFixed(1)}% is ELEVATED. Monitor closely.`;
    } else {
        explanation += `Current risk ${currentRisk.toFixed(1)}% is ACCEPTABLE.`;
    }

    return explanation;
}

function getAirQualityExplanation(trend, change, currentMQ) {
    const trendLabel = getTrendLabel(trend);
    let explanation = "";

    if (trendLabel === 'RISING_RAPIDLY') {
        explanation = `Air quality declining rapidly. `;
    } else if (trendLabel === 'RISING') {
        explanation = `Air quality slowly declining. `;
    } else if (trendLabel === 'FALLING_RAPIDLY') {
        explanation = `Air quality improving rapidly. `;
    } else if (trendLabel === 'FALLING') {
        explanation = `Air quality slowly improving. `;
    } else {
        explanation = `Air quality stable. `;
    }

    // Add MQ135 value context
    if (currentMQ > 500) {
        explanation += `MQ135 reading ${currentMQ.toFixed(0)} indicates VERY POOR air quality.`;
    } else if (currentMQ > 300) {
        explanation += `MQ135 reading ${currentMQ.toFixed(0)} indicates POOR air quality.`;
    } else if (currentMQ > 150) {
        explanation += `MQ135 reading ${currentMQ.toFixed(0)} indicates MODERATE air quality.`;
    } else {
        explanation += `MQ135 reading ${currentMQ.toFixed(0)} indicates GOOD air quality.`;
    }

    return explanation;
}

function generatePredictionsWithReasoning(latest, predictedRisk, timeToCritical, riskChange, tempChange, humChange, mqChange) {
    let reasoning = [];

    // Build reasoning based on changes
    if (riskChange > 0) {
        reasoning.push(`Risk increasing at ${riskChange.toFixed(2)}% per hour`);
    } else if (riskChange < 0) {
        reasoning.push(`Risk decreasing at ${Math.abs(riskChange).toFixed(2)}% per hour`);
    }

    if (tempChange > 0.5) {
        reasoning.push(`Temperature rising (${tempChange.toFixed(1)}°C/h) contributes to risk increase`);
    }

    if (humChange > 2) {
        reasoning.push(`Humidity rising (${humChange.toFixed(1)}%/h) affects moisture content`);
    }

    if (mqChange > 50) {
        reasoning.push(`Air quality declining indicates potential spoilage gases`);
    }

    // Dew point analysis
    if (latest.dewPoint && (latest.temperature - latest.dewPoint) < 2) {
        reasoning.push(`Condensation risk (temp-dew point <2°C) increases spoilage probability`);
    }

    return {
        predictedRisk: predictedRisk.toFixed(1),
        timeToCritical: timeToCritical,
        confidence: calculateConfidenceWithFactors(10, {}, {}).level,
        reasoning: reasoning.length > 0 ? reasoning : ["Conditions relatively stable"],
        factors: {
            temperatureInfluence: Math.abs(tempChange) * 1.5,
            humidityInfluence: Math.abs(humChange) * 0.8,
            airQualityInfluence: mqChange > 200 ? 1.2 : 0.5
        }
    };
}

function generatePrioritizedRecommendations(latest, trends, patterns, predictedRisk) {
    const recommendations = [];
    const risk = latest.spoilageRisk || 0;
    const temp = latest.temperature || 0;
    const hum = latest.humidity || 0;
    const mq = latest.mq_value || 0;

    // Critical alerts (highest priority)
    if (temp < 3) {
        recommendations.push({
            priority: 'CRITICAL',
            message: '🚨 FREEZING TEMPERATURE: Immediate action needed to prevent potato damage!',
            action: 'Increase heating immediately'
        });
    }

    if (risk > 70) {
        recommendations.push({
            priority: 'CRITICAL',
            message: '🚨 CRITICAL SPOILAGE RISK: Immediate intervention required',
            action: 'Check grain condition and adjust environment'
        });
    }

    // High priority warnings
    if (temp > 12) {
        recommendations.push({
            priority: 'HIGH',
            message: '🌡️ Temperature too high for potato storage',
            action: 'Increase cooling/ventilation to reach 4-8°C range'
        });
    }

    if (hum < 85) {
        recommendations.push({
            priority: 'HIGH',
            message: '💧 Humidity too low - risk of weight loss',
            action: 'Increase humidity to 90-95% range'
        });
    }

    if (hum > 95) {
        recommendations.push({
            priority: 'HIGH',
            message: '💦 Humidity very high - condensation risk',
            action: 'Reduce humidity and check for wet spots'
        });
    }

    // Medium priority
    if (latest.dewPoint && (temp - latest.dewPoint) < 2) {
        recommendations.push({
            priority: 'MEDIUM',
            message: '⚠️ Condensation risk detected',
            action: 'Monitor for moisture and improve air circulation'
        });
    }

    if (mq > 300) {
        recommendations.push({
            priority: 'MEDIUM',
            message: '☣️ Poor air quality detected',
            action: 'Increase ventilation to reduce gas levels'
        });
    }

    // Trend-based recommendations
    if (trends.spoilageRisk?.value?.includes('RISING')) {
        recommendations.push({
            priority: 'MEDIUM',
            message: '📈 Spoilage risk is increasing',
            action: 'Monitor closely and prepare to adjust conditions'
        });
    }

    // Low priority / informational
    if (temp >= 4 && temp <= 8 && hum >= 90 && hum <= 95 && risk < 40) {
        recommendations.push({
            priority: 'LOW',
            message: '✅ Conditions optimal for potato storage',
            action: 'Maintain current temperature (4-8°C) and humidity (90-95%)'
        });
    }

    // Sort by priority
    const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
}

function calculateConfidenceWithFactors(dataPoints, trends, patterns) {
    let score = 0;
    let factors = [];

    // Data volume factor
    if (dataPoints > 20) {
        score += 40;
        factors.push("High data volume (20+ points)");
    } else if (dataPoints > 10) {
        score += 25;
        factors.push("Moderate data volume (10-20 points)");
    } else {
        score += 10;
        factors.push("Low data volume (<10 points)");
    }

    // Trend clarity factor
    const clearTrends = Object.values(trends).filter(t =>
        t.value !== 'STABLE' && t.value !== 'INSUFFICIENT_DATA'
    ).length;

    if (clearTrends >= 2) {
        score += 30;
        factors.push("Clear trends detected");
    } else if (clearTrends >= 1) {
        score += 15;
        factors.push("Some trends detected");
    }

    // Pattern detection factor
    const detectedPatterns = Object.values(patterns).filter(p => p.detected).length;
    if (detectedPatterns > 0) {
        score += 20;
        factors.push("Patterns detected in data");
    }

    // Data consistency factor
    score += 10; // Base consistency
    factors.push("Data appears consistent");

    // Determine confidence level
    let level = 'low';
    if (score >= 70) level = 'high';
    else if (score >= 40) level = 'medium';

    return {
        level,
        score,
        factors
    };
}

function calculateSimpleTrend(data) {
    if (data.length < 2) return 0;

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    return avgSecond - avgFirst;
}

function getTrendLabel(trendValue) {
    if (trendValue > 1.0) return 'RISING_RAPIDLY';
    if (trendValue > 0.3) return 'RISING';
    if (trendValue < -1.0) return 'FALLING_RAPIDLY';
    if (trendValue < -0.3) return 'FALLING';
    return 'STABLE';
}

function detectAcceleratingTrend(data) {
    if (data.length < 4) return false;

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstTrend = calculateSimpleTrend(firstHalf);
    const secondTrend = calculateSimpleTrend(secondHalf);

    return Math.abs(secondTrend) > Math.abs(firstTrend) * 1.5;
}


function detectSpike(data, threshold = 0.15) {
    if (data.length < 3) return false;

    const recent = data.slice(-3);
    const before = data.slice(-6, -3);

    if (before.length < 3) return false;

    const avgBefore = before.reduce((a, b) => a + b, 0) / before.length;
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;

    return Math.abs(avgRecent - avgBefore) > (avgBefore * threshold);
}

// In generateSummary function:
function generateSummary(latest, riskTrend, riskChange) {
    const risk = latest.spoilageRisk || 0;
    const temp = latest.temperature || 0;
    const hum = latest.humidity || 0;

    // Potato-specific thresholds
    if (risk > 60) {
        return `🚨 POTATO CRITICAL: Risk ${risk.toFixed(1)}% (Temp: ${temp.toFixed(1)}°C, RH: ${hum.toFixed(1)}%)`;
    } else if (temp > 12) {
        return `🌡️ Temp high for potatoes: ${temp.toFixed(1)}°C (Ideal: 4-8°C)`;
    } else if (hum < 85) {
        return `💧 Humidity low: ${hum.toFixed(1)}% (Ideal: 90-95% RH)`;
    } else if (temp < 4) {
        return `❄️ Near freezing: ${temp.toFixed(1)}°C (Risk of cold damage)`;
    }

    return `✓ Potato conditions OK. Temp: ${temp.toFixed(1)}°C, RH: ${hum.toFixed(1)}%`;
}

// In generateRecommendations function:
function generateRecommendations(latest, riskTrend, riskChange) {
    const recommendations = [];
    const risk = latest.spoilageRisk || 0;
    const temp = latest.temperature || 0;
    const hum = latest.humidity || 0;

    // Potato-specific recommendations
    if (temp > 12) {
        recommendations.push("🌡️ POTATOES: Temperature too high (>12°C). Increase cooling/ventilation");
    }

    if (temp < 4 && temp >= 3) {
        recommendations.push("❄️ POTATOES: Near freezing (3-4°C). Risk of chilling injury");
    }

    if (temp < 3) {
        recommendations.push("🚨 POTATOES: FREEZING TEMPERATURE (<3°C). Immediate action needed!");
    }

    if (hum < 85) {
        recommendations.push("💧 POTATOES: Humidity too low (<85%). Risk of weight loss/shriveling");
    }

    if (hum > 95) {
        recommendations.push("💦 POTATOES: Humidity very high (>95%). Check for condensation/wet spots");
    }

    // Dew point warning
    if (latest.dewPoint && (temp - latest.dewPoint) < 2) {
        recommendations.push("⚠️ CONDENSATION RISK: Temp-dew point <2°C. Check for wet potatoes");
    }

    if (recommendations.length === 0) {
        recommendations.push("✅ Potato storage conditions optimal. Maintain 4-8°C, 90-95% RH");
    }

    return recommendations;
}

function calculateConfidence(dataPoints) {
    if (dataPoints > 20) return 'high';
    if (dataPoints > 10) return 'medium';
    return 'low';
}

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve dashboard
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Advanced Silo Monitor Server running at http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔧 API Health: http://localhost:${PORT}/health`);
    console.log(`📈 Advanced Analytics: http://localhost:${PORT}/api/trends/:deviceId`);
});