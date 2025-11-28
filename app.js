const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static("public"));

// SQLite database setup with schema migration
const db = new sqlite3.Database("silo_data.db", (err) => {
  if (err) console.error("❌ DB connection error:", err.message);
  else console.log("✅ Connected to SQLite database.");
});

// Function to ensure table has correct schema
function ensureTableSchema() {
  return new Promise((resolve, reject) => {
    // Drop and recreate table to ensure correct schema
    db.run(`DROP TABLE IF EXISTS sensor_data`, (err) => {
      if (err) {
        console.error("❌ Error dropping table:", err.message);
        reject(err);
        return;
      }

      // Create table with current schema
      db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceId TEXT,
        nodeRole TEXT,
        grainType TEXT DEFAULT 'wheat',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        temperature REAL,
        humidity REAL,
        mq_value REAL,
        mq_ratio REAL,
        mq_baseline REAL,
        spoilageRisk REAL,
        grainHealth TEXT,
        safeStorageDays REAL,
        rssi INTEGER,
        ip TEXT,
        freeHeap INTEGER,
        status TEXT
      )`, (err) => {
        if (err) {
          console.error("❌ Table creation error:", err.message);
          reject(err);
        } else {
          console.log("✅ Sensor data table ready with correct schema");
          resolve();
        }
      });
    });
  });
}

// Initialize database on startup
ensureTableSchema().catch(console.error);

// API key middleware
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY || "demo123";
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
};

// API to receive data from ESP32
app.post("/api/data", apiKeyMiddleware, (req, res) => {
  const { 
    deviceId, nodeRole, grainType, temperature, humidity, 
    mq_value, mq_ratio, mq_baseline, spoilageRisk, grainHealth,
    safeStorageDays, rssi, ip, freeHeap, status
  } = req.body;

  console.log(`📥 Received from ${deviceId}: ${temperature}°C, ${humidity}%, ${grainHealth}`);

  db.run(
    `INSERT INTO sensor_data (
      deviceId, nodeRole, grainType, temperature, humidity, 
      mq_value, mq_ratio, mq_baseline, spoilageRisk, grainHealth,
      safeStorageDays, rssi, ip, freeHeap, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deviceId, nodeRole, grainType || 'wheat', temperature, humidity,
      mq_value, mq_ratio, mq_baseline, spoilageRisk, grainHealth,
      safeStorageDays, rssi, ip, freeHeap, status
    ],
    function(err) {
      if (err) {
        console.error("❌ Database insert error:", err);
        // Try to recreate table if schema is wrong
        if (err.message.includes('no such column')) {
          ensureTableSchema().then(() => {
            res.status(500).json({ error: "Database schema updated, please retry" });
          });
        } else {
          res.status(500).json({ error: "Database error" });
        }
        return;
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// API to get latest reading from all devices
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
      if (err.message.includes('no such column')) {
        ensureTableSchema().then(() => {
          res.status(500).json({ error: "Database schema updated, please refresh" });
        });
        return;
      }
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows || []);
  });
});

// API to get device list with online status
app.get("/api/devices", (req, res) => {
  // Simple query that works with basic schema
  const query = `
    SELECT 
      deviceId,
      nodeRole,
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
      if (err.message.includes('no such column')) {
        ensureTableSchema().then(() => {
          res.status(500).json({ error: "Database schema updated, please refresh" });
        });
        return;
      }
      return res.status(500).json({ error: "Database error" });
    }
    
    // Add grainType if available, otherwise use default
    const devicesWithGrainType = rows.map(row => ({
      ...row,
      grainType: row.grainType || 'wheat'
    }));
    
    res.json(devicesWithGrainType || []);
  });
});

// API to get history with pagination
app.get("/api/history", (req, res) => {
  const { deviceId, limit = 100, hours = 24 } = req.query;
  
  let query = `
    SELECT *, datetime(timestamp, 'localtime') as ts_server 
    FROM sensor_data 
    WHERE timestamp >= datetime('now', ?)
  `;
  let params = [`-${hours} hours`];
  
  if (deviceId && deviceId !== 'all') {
    query += " AND deviceId = ?";
    params.push(deviceId);
  }
  
  query += " ORDER BY timestamp DESC LIMIT ?";
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("❌ DB read error:", err);
      if (err.message.includes('no such column')) {
        ensureTableSchema().then(() => {
          res.status(500).json({ error: "Database schema updated, please refresh" });
        });
        return;
      }
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows.reverse());
  });
});

// API to get system statistics
app.get("/api/stats", (req, res) => {
  const queries = {
    totalReadings: "SELECT COUNT(*) as count FROM sensor_data",
    activeDevices: "SELECT COUNT(DISTINCT deviceId) as count FROM sensor_data WHERE timestamp >= datetime('now', '-5 minutes')",
    latestReading: "SELECT datetime(MAX(timestamp), 'localtime') as latest FROM sensor_data",
    criticalAlerts: "SELECT COUNT(*) as count FROM sensor_data WHERE status = 'CRITICAL' AND timestamp >= datetime('now', '-1 hour')"
  };

  const results = {};
  let completed = 0;

  Object.keys(queries).forEach(key => {
    db.get(queries[key], (err, row) => {
      if (err) {
        console.error(`❌ Query error for ${key}:`, err);
        results[key] = { count: 0 };
      } else {
        results[key] = row;
      }
      completed++;
      
      if (completed === Object.keys(queries).length) {
        res.json(results);
      }
    });
  });
});

// Serve web dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Health check endpoint
app.get("/health", (req, res) => {
  db.get("SELECT 1 as health", (err, row) => {
    if (err) {
      return res.status(500).json({ status: "unhealthy", error: err.message });
    }
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
});

// Reset database endpoint (for development)
app.post("/api/reset-db", (req, res) => {
  ensureTableSchema()
    .then(() => res.json({ success: true, message: "Database reset successfully" }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Start server
app.listen(PORT, () => {
  app.listen(PORT, () => {
  console.log(`🚀 Silo Monitor Server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔄 Reset DB: http://localhost:${PORT}/api/reset-db`);
});

});
