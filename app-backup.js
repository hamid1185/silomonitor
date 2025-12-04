// const express = require("express");
// const sqlite3 = require("sqlite3").verbose();
// const bodyParser = require("body-parser");
// const cors = require("cors");
// const path = require("path");

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());
// app.use(express.static("public"));

// // Database setup
// const db = new sqlite3.Database("silo_data.db", (err) => {
//   if (err) console.error("❌ DB error:", err.message);
//   else console.log("✅ Connected to SQLite database");
// });

// // Create table
// db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   deviceId TEXT,
//   temperature REAL,
//   humidity REAL,
//   mq_value REAL,
//   spoilageRisk REAL,
//   grainHealth TEXT,
//   rssi INTEGER,
//   timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
// )`, (err) => {
//   if (err) console.error("❌ Table error:", err.message);
//   else console.log("✅ Sensor table ready");
// });

// // API key middleware
// const apiKeyMiddleware = (req, res, next) => {
//   const apiKey = req.headers['x-api-key'];
//   if (!apiKey || apiKey !== "demo123") {
//     return res.status(401).json({ error: "Invalid API key" });
//   }
//   next();
// };

// // POST data endpoint
// app.post("/api/data", apiKeyMiddleware, (req, res) => {
//   const { deviceId, temperature, humidity, mq_value, spoilageRisk, grainHealth, rssi } = req.body;

//   console.log(`📥 ${deviceId}: ${temperature}°C, ${humidity}%, ${grainHealth}`);

//   db.run(
//     `INSERT INTO sensor_data (deviceId, temperature, humidity, mq_value, spoilageRisk, grainHealth, rssi)
//      VALUES (?, ?, ?, ?, ?, ?, ?)`,
//     [deviceId, temperature, humidity, mq_value, spoilageRisk, grainHealth, rssi],
//     function(err) {
//       if (err) {
//         console.error("❌ DB insert error:", err);
//         return res.status(500).json({ error: "Database error" });
//       }
//       res.json({ success: true, id: this.lastID });
//     }
//   );
// });

// // Get latest readings from all devices
// app.get("/api/latest", (req, res) => {
//   const query = `
//     SELECT s1.* 
//     FROM sensor_data s1
//     INNER JOIN (
//       SELECT deviceId, MAX(timestamp) as latest 
//       FROM sensor_data 
//       GROUP BY deviceId
//     ) s2 ON s1.deviceId = s2.deviceId AND s1.timestamp = s2.latest
//     ORDER BY s1.deviceId
//   `;
  
//   db.all(query, (err, rows) => {
//     if (err) {
//       console.error("❌ DB read error:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json(rows || []);
//   });
// });

// // Get device list with status
// app.get("/api/devices", (req, res) => {
//   const query = `
//     SELECT 
//       deviceId,
//       MAX(timestamp) as lastSeen,
//       COUNT(*) as readingCount,
//       CASE 
//         WHEN datetime(MAX(timestamp)) >= datetime('now', '-5 minutes') THEN 'online'
//         WHEN datetime(MAX(timestamp)) >= datetime('now', '-1 hour') THEN 'recent'
//         ELSE 'offline'
//       END as status
//     FROM sensor_data 
//     GROUP BY deviceId
//     ORDER BY lastSeen DESC
//   `;
  
//   db.all(query, (err, rows) => {
//     if (err) {
//       console.error("❌ DB read error:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json(rows || []);
//   });
// });

// // Get device history
// app.get("/api/history/:deviceId", (req, res) => {
//   const { deviceId } = req.params;
//   const { limit = 50, hours = 24 } = req.query;
  
//   const query = `
//     SELECT *, datetime(timestamp, 'localtime') as ts_server 
//     FROM sensor_data 
//     WHERE deviceId = ? AND timestamp >= datetime('now', ?)
//     ORDER BY timestamp DESC LIMIT ?
//   `;
  
//   db.all(query, [deviceId, `-${hours} hours`, parseInt(limit)], (err, rows) => {
//     if (err) {
//       console.error("❌ DB read error:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json(rows.reverse());
//   });
// });

// // Get system stats
// app.get("/api/stats", (req, res) => {
//   const queries = {
//     totalReadings: "SELECT COUNT(*) as count FROM sensor_data",
//     activeDevices: "SELECT COUNT(DISTINCT deviceId) as count FROM sensor_data WHERE timestamp >= datetime('now', '-5 minutes')",
//     latestReading: "SELECT datetime(MAX(timestamp), 'localtime') as latest FROM sensor_data"
//   };

//   const results = {};
//   let completed = 0;

//   Object.keys(queries).forEach(key => {
//     db.get(queries[key], (err, row) => {
//       results[key] = row;
//       completed++;
      
//       if (completed === Object.keys(queries).length) {
//         res.json(results);
//       }
//     });
//   });
// });

// // Health check
// app.get("/health", (req, res) => {
//   res.json({ 
//     status: "healthy", 
//     timestamp: new Date().toISOString()
//   });
// });

// // Serve dashboard
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

// // Start server on all interfaces
// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
//   console.log(`📊 Dashboard: http://localhost:${PORT}`);
//   console.log(`🔧 ESP32 should POST to: http://YOUR_PC_IP:${PORT}/api/data`);
// });




/////////////////////////////////////////////////////////////////////////////////////



// const express = require("express");
// const sqlite3 = require("sqlite3").verbose();
// const bodyParser = require("body-parser");
// const cors = require("cors");
// const path = require("path");

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());
// app.use(express.static("public"));

// // Database setup
// const db = new sqlite3.Database("silo_data.db", (err) => {
//   if (err) console.error("❌ DB error:", err.message);
//   else console.log("✅ Connected to SQLite database");
// });

// // Create enhanced table
// db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   deviceId TEXT,
//   temperature REAL,
//   humidity REAL,
//   mq_value REAL,
//   spoilageRisk REAL,
//   grainHealth TEXT,
//   dewPoint REAL,
//   absoluteHumidity REAL,
//   vaporPressureDeficit REAL,
//   equilibriumMoistureContent REAL,
//   trendAnalysis TEXT,
//   prediction TEXT,
//   rssi INTEGER,
//   ip TEXT,
//   timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
// )`, (err) => {
//   if (err) console.error("❌ Table error:", err.message);
//   else console.log("✅ Enhanced sensor table ready");
// });

// // API key middleware
// const apiKeyMiddleware = (req, res, next) => {
//   const apiKey = req.headers['x-api-key'];
//   if (!apiKey || apiKey !== "demo123") {
//     return res.status(401).json({ error: "Invalid API key" });
//   }
//   next();
// };

// // POST data endpoint
// app.post("/api/data", apiKeyMiddleware, (req, res) => {
//   const { 
//     deviceId, temperature, humidity, mq_value, spoilageRisk, 
//     grainHealth, dewPoint, absoluteHumidity, vaporPressureDeficit,
//     equilibriumMoistureContent, trendAnalysis, prediction, rssi, ip
//   } = req.body;

//   console.log(`📥 ${deviceId}: ${temperature}°C, ${humidity}%, Risk: ${spoilageRisk}%`);

//   db.run(
//     `INSERT INTO sensor_data (
//       deviceId, temperature, humidity, mq_value, spoilageRisk, 
//       grainHealth, dewPoint, absoluteHumidity, vaporPressureDeficit,
//       equilibriumMoistureContent, trendAnalysis, prediction, rssi, ip
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//     [
//       deviceId, temperature, humidity, mq_value, spoilageRisk,
//       grainHealth, dewPoint, absoluteHumidity, vaporPressureDeficit,
//       equilibriumMoistureContent, trendAnalysis, prediction, rssi, ip
//     ],
//     function(err) {
//       if (err) {
//         console.error("❌ DB insert error:", err);
//         return res.status(500).json({ error: "Database error" });
//       }
//       res.json({ success: true, id: this.lastID });
//     }
//   );
// });

// // Get latest readings from all devices
// app.get("/api/latest", (req, res) => {
//   const query = `
//     SELECT s1.* 
//     FROM sensor_data s1
//     INNER JOIN (
//       SELECT deviceId, MAX(timestamp) as latest 
//       FROM sensor_data 
//       GROUP BY deviceId
//     ) s2 ON s1.deviceId = s2.deviceId AND s1.timestamp = s2.latest
//     ORDER BY s1.deviceId
//   `;
  
//   db.all(query, (err, rows) => {
//     if (err) {
//       console.error("❌ DB read error:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json(rows || []);
//   });
// });

// // Get device list with status
// app.get("/api/devices", (req, res) => {
//   const query = `
//     SELECT 
//       deviceId,
//       MIN(timestamp) as firstSeen,
//       MAX(timestamp) as lastSeen,
//       COUNT(*) as readingCount,
//       CASE 
//         WHEN datetime(MAX(timestamp)) >= datetime('now', '-5 minutes') THEN 'online'
//         WHEN datetime(MAX(timestamp)) >= datetime('now', '-1 hour') THEN 'recent'
//         ELSE 'offline'
//       END as status
//     FROM sensor_data 
//     GROUP BY deviceId
//     ORDER BY lastSeen DESC
//   `;
  
//   db.all(query, (err, rows) => {
//     if (err) {
//       console.error("❌ DB read error:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json(rows || []);
//   });
// });

// // Get device history
// app.get("/api/history/:deviceId", (req, res) => {
//   const { deviceId } = req.params;
//   const { limit = 50, hours = 24 } = req.query;
  
//   const query = `
//     SELECT *, datetime(timestamp, 'localtime') as ts_server 
//     FROM sensor_data 
//     WHERE deviceId = ? AND timestamp >= datetime('now', ?)
//     ORDER BY timestamp DESC LIMIT ?
//   `;
  
//   db.all(query, [deviceId, `-${hours} hours`, parseInt(limit)], (err, rows) => {
//     if (err) {
//       console.error("❌ DB read error:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     res.json(rows.reverse());
//   });
// });

// // Advanced trend analysis functions
// function analyzeAdvancedTrends(data) {
//   if (data.length < 3) return { 
//     message: "Need at least 3 data points for meaningful analysis",
//     status: "INSUFFICIENT_DATA"
//   };
  
//   const recentData = data.slice(-10); // Use last 10 readings
  
//   // Calculate comprehensive metrics
//   const metrics = calculateAllMetrics(recentData);
//   const trends = calculateAdvancedTrends(recentData);
//   const predictions = generateAdvancedPredictions(metrics, trends);
//   const recommendations = generateScientificRecommendations(metrics, trends);
  
//   return {
//     scientificMetrics: metrics,
//     advancedTrends: trends,
//     scientificPredictions: predictions,
//     actionableRecommendations: recommendations,
//     riskAssessment: assessOverallRisk(metrics, trends),
//     analysisTimestamp: new Date().toISOString()
//   };
// }

// function calculateAllMetrics(data) {
//   const latest = data[data.length - 1];
//   const temps = data.map(d => d.temperature);
//   const hums = data.map(d => d.humidity);
//   const risks = data.map(d => d.spoilageRisk);
  
//   // Basic statistics
//   const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
//   const avgHum = hums.reduce((a, b) => a + b, 0) / hums.length;
//   const avgRisk = risks.reduce((a, b) => a + b, 0) / risks.length;
  
//   // Advanced agricultural metrics
//   const tempRange = Math.max(...temps) - Math.min(...temps);
//   const humRange = Math.max(...hums) - Math.min(...hums);
  
//   // Mold growth index (simplified)
//   const moldIndex = latest.temperature > 20 && latest.humidity > 15 ? 
//     (latest.temperature - 20) * (latest.humidity - 15) / 100 : 0;
  
//   // Thermal stress indicator
//   const thermalStress = Math.abs(latest.temperature - 20); // Deviation from ideal 20°C
  
//   // Calculate stability score (0-100, higher is more stable)
//   const tempStability = Math.max(0, 100 - (tempRange * 10));
//   const humStability = Math.max(0, 100 - (humRange * 5));
//   const overallStability = (tempStability + humStability) / 2;

//   return {
//     current: {
//       temperature: latest.temperature,
//       humidity: latest.humidity,
//       spoilageRisk: latest.spoilageRisk,
//       dewPoint: latest.dewPoint,
//       absoluteHumidity: latest.absoluteHumidity,
//       vaporPressureDeficit: latest.vaporPressureDeficit,
//       equilibriumMoistureContent: latest.equilibriumMoistureContent
//     },
//     averages: {
//       temperature: parseFloat(avgTemp.toFixed(1)),
//       humidity: parseFloat(avgHum.toFixed(1)),
//       spoilageRisk: parseFloat(avgRisk.toFixed(1))
//     },
//     ranges: {
//       temperature: parseFloat(tempRange.toFixed(1)),
//       humidity: parseFloat(humRange.toFixed(1))
//     },
//     indices: {
//       moldGrowth: parseFloat(moldIndex.toFixed(1)),
//       thermalStress: parseFloat(thermalStress.toFixed(1)),
//       condensationRisk: latest.dewPoint > latest.temperature - 2 ? 'HIGH' : 'LOW',
//       stabilityScore: parseFloat(overallStability.toFixed(1))
//     }
//   };
// }

// function calculateAdvancedTrends(data) {
//   if (data.length < 3) return { message: "Insufficient data for trend analysis" };
  
//   const temps = data.map(d => d.temperature);
//   const hums = data.map(d => d.humidity);
//   const risks = data.map(d => d.spoilageRisk);
  
//   // Linear regression for trends
//   const tempTrend = linearRegression(temps);
//   const humTrend = linearRegression(hums);
//   const riskTrend = linearRegression(risks);
  
//   // Rate of change (per hour)
//   const timeDiffHours = (new Date(data[data.length-1].timestamp) - new Date(data[0].timestamp)) / (1000 * 60 * 60);
//   const tempROC = (temps[temps.length-1] - temps[0]) / timeDiffHours;
//   const humROC = (hums[hums.length-1] - hums[0]) / timeDiffHours;
//   const riskROC = (risks[risks.length-1] - risks[0]) / timeDiffHours;
  
//   // Pattern detection
//   const patterns = {
//     acceleratingRisk: detectAcceleratingRisk(risks),
//     temperatureSpike: detectSpike(temps),
//     humiditySurge: detectSpike(hums),
//     stableDeterioration: detectStableDeterioration(risks),
//     improvingConditions: detectImprovingConditions(risks)
//   };
  
//   return {
//     temperature: classifyTrend(tempTrend.slope, tempROC),
//     humidity: classifyTrend(humTrend.slope, humROC),
//     spoilageRisk: classifyTrend(riskTrend.slope, riskROC),
//     ratesOfChange: {
//       temperature: parseFloat(tempROC.toFixed(2)),
//       humidity: parseFloat(humROC.toFixed(2)),
//       spoilageRisk: parseFloat(riskROC.toFixed(2))
//     },
//     patterns: patterns,
//     confidence: calculateTrendConfidence(data)
//   };
// }

// function linearRegression(data) {
//   const n = data.length;
//   let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
//   for (let i = 0; i < n; i++) {
//     sumX += i;
//     sumY += data[i];
//     sumXY += i * data[i];
//     sumX2 += i * i;
//   }
  
//   const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
//   const intercept = (sumY - slope * sumX) / n;
  
//   return { slope, intercept };
// }

// function classifyTrend(slope, rateOfChange) {
//   const absROC = Math.abs(rateOfChange);
  
//   if (absROC > 1.0) return 'RAPIDLY_' + (slope > 0 ? 'INCREASING' : 'DECREASING');
//   if (absROC > 0.3) return 'MODERATELY_' + (slope > 0 ? 'INCREASING' : 'DECREASING');
//   if (absROC > 0.1) return 'SLOWLY_' + (slope > 0 ? 'INCREASING' : 'DECREASING');
//   return 'STABLE';
// }

// function detectAcceleratingRisk(risks) {
//   if (risks.length < 4) return false;
  
//   const firstHalf = risks.slice(0, Math.floor(risks.length / 2));
//   const secondHalf = risks.slice(Math.floor(risks.length / 2));
  
//   const firstSlope = linearRegression(firstHalf).slope;
//   const secondSlope = linearRegression(secondHalf).slope;
  
//   return secondSlope > firstSlope * 1.5; // Acceleration detected
// }

// function detectSpike(data) {
//   if (data.length < 3) return false;
  
//   const recent = data.slice(-3);
//   const avgBefore = data.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
//   const avgRecent = recent.reduce((a, b) => a + b, 0) / 3;
  
//   return (avgRecent - avgBefore) > (avgBefore * 0.15); // 15% spike
// }

// function detectStableDeterioration(risks) {
//   if (risks.length < 5) return false;
  
//   let increasingCount = 0;
//   for (let i = 1; i < risks.length; i++) {
//     if (risks[i] > risks[i-1]) increasingCount++;
//   }
  
//   return increasingCount >= risks.length * 0.7; // 70% of readings increasing
// }

// function detectImprovingConditions(risks) {
//   if (risks.length < 5) return false;
  
//   let decreasingCount = 0;
//   for (let i = 1; i < risks.length; i++) {
//     if (risks[i] < risks[i-1]) decreasingCount++;
//   }
  
//   return decreasingCount >= risks.length * 0.7; // 70% of readings decreasing
// }

// function generateAdvancedPredictions(metrics, trends) {
//   const currentRisk = metrics.current.spoilageRisk;
//   const riskROC = parseFloat(trends.ratesOfChange.spoilageRisk);
  
//   // Simple linear projection
//   const predictedRisk6h = currentRisk + (riskROC * 6); // 6 hours ahead
//   const predictedRisk24h = currentRisk + (riskROC * 24); // 24 hours ahead
  
//   // Time to critical (70% risk)
//   let timeToCritical = null;
//   if (riskROC > 0.1 && currentRisk < 70) {
//     timeToCritical = Math.max(1, Math.round((70 - currentRisk) / riskROC));
//   }

//   // Time to warning (50% risk)
//   let timeToWarning = null;
//   if (riskROC > 0.1 && currentRisk < 50) {
//     timeToWarning = Math.max(1, Math.round((50 - currentRisk) / riskROC));
//   }
  
//   // Mold risk prediction
//   const moldRisk = metrics.indices.moldGrowth > 10 ? 'HIGH' : 
//                    metrics.indices.moldGrowth > 5 ? 'MEDIUM' : 'LOW';
  
//   return {
//     predictedRisk6h: Math.min(100, Math.round(predictedRisk6h)),
//     predictedRisk24h: Math.min(100, Math.round(predictedRisk24h)),
//     timeToCritical: timeToCritical,
//     timeToWarning: timeToWarning,
//     expectedCondition: predictCondition(predictedRisk6h, trends),
//     moldRisk: moldRisk,
//     confidence: calculatePredictionConfidence(metrics, trends),
//     projection: generateRiskProjection(currentRisk, riskROC)
//   };
// }

// function predictCondition(predictedRisk, trends) {
//   if (predictedRisk > 70) return 'CRITICAL_WITHIN_6_HOURS';
//   if (predictedRisk > 50 && trends.spoilageRisk.includes('RAPIDLY')) return 'DETERIORATING_RAPIDLY';
//   if (predictedRisk > 50) return 'WARNING_CONDITIONS';
//   if (predictedRisk > 30) return 'STABLE_BUT_MONITOR';
//   return 'GOOD_CONDITIONS';
// }

// function generateRiskProjection(currentRisk, riskROC) {
//   const projections = [];
//   for (let hours = 1; hours <= 24; hours += 6) {
//     const risk = Math.min(100, Math.round(currentRisk + (riskROC * hours)));
//     projections.push({
//       hours: hours,
//       risk: risk,
//       level: risk > 70 ? 'CRITICAL' : risk > 50 ? 'WARNING' : risk > 30 ? 'CAUTION' : 'GOOD'
//     });
//   }
//   return projections;
// }

// function generateScientificRecommendations(metrics, trends) {
//   const recommendations = [];
//   const current = metrics.current;
  
//   // Temperature-based recommendations
//   if (current.temperature > 28) {
//     recommendations.push({
//       priority: "CRITICAL",
//       message: "🚨 TEMPERATURE CRITICAL: Above 28°C - Activate emergency cooling/aeration immediately",
//       action: "Start forced ventilation and monitor temperature every 30 minutes"
//     });
//   } else if (current.temperature > 25) {
//     recommendations.push({
//       priority: "HIGH",
//       message: "⚠️ TEMPERATURE WARNING: Above 25°C - Increase ventilation to prevent heating",
//       action: "Increase aeration frequency and check for hot spots"
//     });
//   } else if (current.temperature < 10) {
//     recommendations.push({
//       priority: "MEDIUM", 
//       message: "❄️ TEMPERATURE LOW: Below 10°C - Risk of moisture migration",
//       action: "Monitor for condensation and consider slight warming"
//     });
//   }
  
//   // Humidity-based recommendations
//   if (current.humidity > 20) {
//     recommendations.push({
//       priority: "CRITICAL",
//       message: "💧 HUMIDITY CRITICAL: Above 20% - High mold growth risk",
//       action: "Activate dehumidification and increase aeration immediately"
//     });
//   } else if (current.humidity > 16) {
//     recommendations.push({
//       priority: "HIGH",
//       message: "📈 HUMIDITY ELEVATED: Above 16% - Monitor moisture content closely",
//       action: "Increase ventilation and check grain moisture weekly"
//     });
//   }
  
//   // Dew point recommendations
//   if (metrics.indices.condensationRisk === 'HIGH') {
//     recommendations.push({
//       priority: "HIGH",
//       message: "🌫️ CONDENSATION RISK: Dew point close to temperature",
//       action: "Check grain surface for moisture and increase air circulation"
//     });
//   }
  
//   // Trend-based recommendations
//   if (trends.spoilageRisk.includes('RAPIDLY')) {
//     recommendations.push({
//       priority: "CRITICAL",
//       message: "📊 RISK ACCELERATING: Conditions deteriorating rapidly",
//       action: "Immediate intervention needed - consider moving or treating grain"
//     });
//   }
  
//   if (trends.patterns.acceleratingRisk) {
//     recommendations.push({
//       priority: "CRITICAL", 
//       message: "⚡ ACCELERATING DETERIORATION: Risk increasing at faster rate",
//       action: "Emergency measures required - inspect grain quality immediately"
//     });
//   }
  
//   if (trends.patterns.improvingConditions) {
//     recommendations.push({
//       priority: "LOW",
//       message: "✅ CONDITIONS IMPROVING: Risk trending downward",
//       action: "Continue current management practices"
//     });
//   }
  
//   // VPD-based recommendations
//   if (current.vaporPressureDeficit < 0.5) {
//     recommendations.push({
//       priority: "MEDIUM",
//       message: "🌬️ LOW DRYING POTENTIAL: Limited natural drying capacity",
//       action: "Consider mechanical drying if grain moisture is high"
//     });
//   }
  
//   // If no critical issues
//   if (recommendations.length === 0) {
//     recommendations.push({
//       priority: "LOW",
//       message: "✅ CONDITIONS STABLE: All parameters within acceptable ranges",
//       action: "Continue regular monitoring and weekly quality checks"
//     });
//   }
  
//   // Sort by priority
//   const priorityOrder = { "CRITICAL": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 4 };
//   return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
// }

// function assessOverallRisk(metrics, trends) {
//   let riskScore = metrics.current.spoilageRisk;
  
//   // Adjust based on trends
//   if (trends.spoilageRisk.includes('RAPIDLY')) riskScore += 15;
//   if (trends.patterns.acceleratingRisk) riskScore += 10;
//   if (metrics.indices.condensationRisk === 'HIGH') riskScore += 20;
//   if (metrics.indices.moldGrowth > 10) riskScore += 15;
//   if (metrics.indices.stabilityScore < 50) riskScore += 10;
  
//   riskScore = Math.min(100, riskScore);
  
//   return {
//     score: Math.round(riskScore),
//     level: riskScore > 70 ? 'CRITICAL' : riskScore > 50 ? 'HIGH' : riskScore > 30 ? 'MEDIUM' : 'LOW',
//     factors: [
//       `Current spoilage risk: ${metrics.current.spoilageRisk}%`,
//       `Trend impact: ${trends.spoilageRisk.includes('RAPIDLY') ? 'High' : 'Medium'}`,
//       `Mold risk: ${metrics.indices.moldGrowth > 10 ? 'High' : 'Low'}`,
//       `Condensation risk: ${metrics.indices.condensationRisk}`,
//       `Stability: ${metrics.indices.stabilityScore > 70 ? 'High' : metrics.indices.stabilityScore > 40 ? 'Medium' : 'Low'}`
//     ]
//   };
// }

// function calculateTrendConfidence(data) {
//   if (data.length < 5) return 'LOW';
  
//   const risks = data.map(d => d.spoilageRisk);
//   const variance = calculateVariance(risks);
  
//   if (variance < 10) return 'HIGH';
//   if (variance < 25) return 'MEDIUM';
//   return 'LOW';
// }

// function calculatePredictionConfidence(metrics, trends) {
//   let confidence = 70; // Base confidence
  
//   // Increase confidence with more stable data
//   if (metrics.ranges.temperature < 3) confidence += 10;
//   if (metrics.ranges.humidity < 5) confidence += 10;
//   if (trends.confidence === 'HIGH') confidence += 10;
  
//   // Decrease confidence with high variability
//   if (metrics.ranges.temperature > 8) confidence -= 15;
//   if (metrics.ranges.humidity > 12) confidence -= 15;
  
//   return Math.max(30, Math.min(95, confidence));
// }

// function calculateVariance(data) {
//   const avg = data.reduce((a, b) => a + b, 0) / data.length;
//   const squareDiffs = data.map(value => Math.pow(value - avg, 2));
//   return squareDiffs.reduce((a, b) => a + b, 0) / data.length;
// }

// // Advanced trends endpoint
// app.get("/api/trends/:deviceId", (req, res) => {
//   const { deviceId } = req.params;
//   const { hours = 24 } = req.query;
  
//   const query = `
//     SELECT *, datetime(timestamp, 'localtime') as ts_server 
//     FROM sensor_data 
//     WHERE deviceId = ? AND timestamp >= datetime('now', ?)
//     ORDER BY timestamp ASC
//   `;
  
//   db.all(query, [deviceId, `-${hours} hours`], (err, rows) => {
//     if (err) {
//       console.error("❌ DB read error:", err);
//       return res.status(500).json({ error: "Database error" });
//     }
    
//     const analysis = analyzeAdvancedTrends(rows);
//     res.json(analysis);
//   });
// });

// // Get system stats
// app.get("/api/stats", (req, res) => {
//   const queries = {
//     totalReadings: "SELECT COUNT(*) as count FROM sensor_data",
//     activeDevices: "SELECT COUNT(DISTINCT deviceId) as count FROM sensor_data WHERE timestamp >= datetime('now', '-5 minutes')",
//     latestReading: "SELECT datetime(MAX(timestamp), 'localtime') as latest FROM sensor_data",
//     criticalAlerts: "SELECT COUNT(*) as count FROM sensor_data WHERE grainHealth = 'CRITICAL' AND timestamp >= datetime('now', '-1 hour')"
//   };

//   const results = {};
//   let completed = 0;

//   Object.keys(queries).forEach(key => {
//     db.get(queries[key], (err, row) => {
//       results[key] = row;
//       completed++;
      
//       if (completed === Object.keys(queries).length) {
//         res.json(results);
//       }
//     });
//   });
// });

// // Health check
// app.get("/health", (req, res) => {
//   res.json({ 
//     status: "healthy", 
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime()
//   });
// });

// // Serve dashboard
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

// // Start server
// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`🚀 Advanced Silo Monitor Server running at http://localhost:${PORT}`);
//   console.log(`📊 Dashboard: http://localhost:${PORT}`);
//   console.log(`🔧 API Health: http://localhost:${PORT}/health`);
//   console.log(`📈 Advanced Analytics: http://localhost:${PORT}/api/trends/:deviceId`);
// });







///////////////////////////


const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

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
    function(err) {
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

// Get device history
app.get("/api/history/:deviceId", (req, res) => {
  const { deviceId } = req.params;
  const { limit = 50, hours = 24 } = req.query;
  
  const query = `
    SELECT *, datetime(timestamp, 'localtime') as ts_server 
    FROM sensor_data 
    WHERE deviceId = ? AND timestamp >= datetime('now', ?)
    ORDER BY timestamp ASC LIMIT ?
  `;
  
  db.all(query, [deviceId, `-${hours} hours`, parseInt(limit)], (err, rows) => {
    if (err) {
      console.error("❌ DB read error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
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

// FIXED: Analytics endpoint for dashboard
app.get("/api/trends/:deviceId", (req, res) => {
  const { deviceId } = req.params;
  const { hours = 24 } = req.query;
  
  const query = `
    SELECT *, datetime(timestamp, 'localtime') as ts_server 
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
    
    // Generate analytics in format your dashboard expects
    const analytics = generateDashboardAnalytics(rows);
    res.json(analytics);
  });
});

// Analytics calculation for dashboard
function generateDashboardAnalytics(rows) {
  const recentData = rows.slice(-10);
  const latest = recentData[recentData.length - 1];
  
  // Extract data arrays
  const temps = recentData.map(d => d.temperature);
  const hums = recentData.map(d => d.humidity);
  const risks = recentData.map(d => d.spoilageRisk || 0);
  
  // Calculate trends
  const tempTrend = calculateSimpleTrend(temps);
  const humTrend = calculateSimpleTrend(hums);
  const riskTrend = calculateSimpleTrend(risks);
  
  // Calculate rate of change
  const riskChange = risks.length > 1 ? risks[risks.length - 1] - risks[risks.length - 2] : 0;
  
  // Generate predictions
  const predictedRisk = Math.min(100, Math.max(0, (latest.spoilageRisk || 0) + (riskChange * 6)));
  const timeToCritical = riskChange > 0 ? Math.max(1, Math.round((70 - (latest.spoilageRisk || 0)) / riskChange)) : null;
  
  // Generate patterns detection
  const patterns = {
    acceleratingRisk: detectAcceleratingTrend(risks),
    temperatureSpike: detectSpike(temps),
    humiditySurge: detectSpike(hums)
  };
  
  // Your dashboard expects this exact format
  return {
    summary: [generateSummary(latest, riskTrend, riskChange)],
    predictions: {
      predictedRisk: predictedRisk.toFixed(1),
      timeToCritical: timeToCritical,
      confidence: calculateConfidence(recentData.length)
    },
    trends: {
      temperature: getTrendLabel(tempTrend),
      humidity: getTrendLabel(humTrend),
      spoilageRisk: getTrendLabel(riskTrend)
    },
    patterns: patterns,
    recommendations: generateRecommendations(latest, riskTrend, riskChange)
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

function detectSpike(data) {
  if (data.length < 3) return false;
  
  const recent = data.slice(-3);
  const before = data.slice(-6, -3);
  
  if (before.length < 3) return false;
  
  const avgBefore = before.reduce((a, b) => a + b, 0) / before.length;
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  
  return Math.abs(avgRecent - avgBefore) > (avgBefore * 0.15);
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