/* silo_node.ino - Complete Silo Monitoring Node */
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include "DHT.h"
#include <ArduinoJson.h>
#include <Preferences.h>
#include "SPIFFS.h"

///// DEFAULT CONFIG /////
const char* DEFAULT_SSID = "Sami";
const char* DEFAULT_PASS = "60106010";
const char* SERVER_URL = "http://192.168.10.108:3000/api/data";

const char* API_KEY = "demo123";
const char* DEFAULT_DEVICE_ID = "node-01";

const int DHTPIN = 4;
const int DHTTYPE = DHT22;
const int MQ_PIN = 34;
const int LED_PIN = 2;

const bool CALIBRATE_ON_BOOT = false;
const int SAMPLE_INTERVAL_MS = 30000;

// Grain storage thresholds
const float TEMP_ALARM = 35.0;
const float TEMP_WARN = 30.0;
const float HUMIDITY_ALARM = 80.0;
const float HUMIDITY_WARN = 70.0;
const float MQ_RATIO_ALARM = 2.0;
const float MQ_RATIO_WARN = 1.5;

///// GLOBAL VARIABLES /////
DHT dht(DHTPIN, DHTTYPE);
Preferences prefs;
WebServer server(80);
DNSServer dnsServer;

// Device configuration
String deviceId = DEFAULT_DEVICE_ID;
String nodeRole = "sensor";
String grainType = "wheat";
String serverUrl = SERVER_URL;
String wifiSsid = "";
String wifiPass = "";

// System state
bool wifiConfigured = false;
bool inConfigMode = false;
unsigned long lastSampleMillis = 0;
float mqBaseline = 1000.0;
String currentStatus = "BOOTING";

///// FUNCTION DECLARATIONS - MUST COME BEFORE setup() /////
void loadConfiguration();
void showStartupStatus();
void attemptWiFiConnection();
void startConfigMode();
void handleRoot();
void handleConfigure();
void sendStartupAnnouncement();
bool postJson(const String &payload);
float calculateSpoilageRisk(float temp, float hum);
String determineGrainHealth(float temp, float hum, float mq_ratio);
float calculateSafeStorageDays(float spoilageRisk);
bool readSensors(float &temp, float &hum, float &mq_value);
void processSensorData(float temp, float hum, float mq_value);
void scanWiFiNetworks();
void enhancedWiFiConnection();

void setup() {
  Serial.begin(115200);
  Serial.println("\n🌾 Silo Monitor Node Starting...");
  
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);
  
  // Initialize systems
  if (!SPIFFS.begin(true)) {
    Serial.println("❌ SPIFFS failed");
  }
  
  prefs.begin("silo", false);
  dht.begin();
  
  // ⭐ FORCE USE DEFAULT CREDENTIALS ONLY ⭐
  wifiSsid = DEFAULT_SSID;
  wifiPass = DEFAULT_PASS;
  deviceId = DEFAULT_DEVICE_ID;
  grainType = "wheat";
  serverUrl = SERVER_URL;
  
  Serial.println("⚡ USING DEFAULT WIFI CREDENTIALS ONLY");
  Serial.printf("📡 WiFi: %s\n", wifiSsid.c_str());
  
  // Show startup status
  showStartupStatus();
  
  // Try to connect using enhanced connection
  enhancedWiFiConnection();
}

void loadConfiguration() {
  // ⭐ SKIP LOADING FROM PREFERENCES - USE DEFAULTS ONLY ⭐
  deviceId = DEFAULT_DEVICE_ID;
  nodeRole = "sensor";
  grainType = "wheat";
  serverUrl = SERVER_URL;
  wifiSsid = DEFAULT_SSID;
  wifiPass = DEFAULT_PASS;
  
  Serial.printf("📋 Config: %s, Grain: %s\n", deviceId.c_str(), grainType.c_str());
}

void showStartupStatus() {
  Serial.println("┌──────────────────────────────┐");
  Serial.println("│      SILO MONITOR NODE       │");
  Serial.println("├──────────────────────────────┤");
  Serial.printf("│ Device: %-20s │\n", deviceId.c_str());
  Serial.printf("│ Grain:  %-20s │\n", grainType.c_str());
  Serial.printf("│ WiFi:   %-20s │\n", wifiSsid.c_str());
  Serial.printf("│ Status: %-20s │\n", currentStatus.c_str());
  Serial.println("└──────────────────────────────┘");
}

void scanWiFiNetworks() {
  Serial.println("🔍 Scanning for WiFi networks...");
  int n = WiFi.scanNetworks();
  Serial.printf("📶 Found %d networks:\n", n);
  
  for (int i = 0; i < n; i++) {
    Serial.printf("  %d: %s (%d dBm) %s\n", 
      i+1, 
      WiFi.SSID(i).c_str(), 
      WiFi.RSSI(i),
      (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "Open" : "Secured");
    
    // Check if our network is available
    if (WiFi.SSID(i) == DEFAULT_SSID) {
      Serial.printf("🎯 TARGET NETWORK FOUND: %s! Signal: %d dBm\n", DEFAULT_SSID, WiFi.RSSI(i));
    }
  }
  WiFi.scanDelete();
}

void enhancedWiFiConnection() {
  Serial.println("\n🚀 ENHANCED WIFI CONNECTION");
  Serial.println("============================");
  
  // Scan networks first to see what's available
  scanWiFiNetworks();
  
  Serial.printf("📡 Connecting to: %s\n", wifiSsid.c_str());
  currentStatus = "CONNECTING";
  
  // Reset WiFi and start fresh
  WiFi.disconnect(true);
  delay(1000);
  WiFi.mode(WIFI_STA);
  
  Serial.println("🔄 Starting connection...");
  
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  
  unsigned long start = millis();
  int lastStatus = -1;
  
  while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
    int currentStatus = WiFi.status();
    
    // Only print status when it changes
    if (currentStatus != lastStatus) {
      lastStatus = currentStatus;
      switch (currentStatus) {
        case WL_IDLE_STATUS:
          Serial.println("📶 Status: IDLE");
          break;
        case WL_NO_SSID_AVAIL:
          Serial.println("❌ Status: NETWORK NOT FOUND");
          break;
        case WL_SCAN_COMPLETED:
          Serial.println("📶 Status: SCAN COMPLETED");
          break;
        case WL_CONNECT_FAILED:
          Serial.println("❌ Status: CONNECTION FAILED");
          break;
        case WL_CONNECTION_LOST:
          Serial.println("❌ Status: CONNECTION LOST");
          break;
        case WL_DISCONNECTED:
          Serial.println("📶 Status: DISCONNECTED");
          break;
        default:
          Serial.printf("📶 Status: %d\n", currentStatus);
          break;
      }
    }
    
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    delay(500);
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n🎉 CONNECTED SUCCESSFULLY!\n");
    Serial.printf("📱 IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("📶 Signal: %d dBm\n", WiFi.RSSI());
    currentStatus = "CONNECTED";
    digitalWrite(LED_PIN, HIGH);
    wifiConfigured = true;
    
    // Send startup announcement
    sendStartupAnnouncement();
    
  } else {
    Serial.printf("\n💥 CONNECTION FAILED! Final status: %d\n", WiFi.status());
    Serial.println("\n🔧 Troubleshooting tips:");
    Serial.println("   1. Check if 'Sami_5G' is a 2.4GHz network (ESP32 doesn't support 5GHz)");
    Serial.println("   2. Verify WiFi password is correct");
    Serial.println("   3. Move ESP32 closer to router");
    Serial.println("   4. Check if network is hidden");
    Serial.println("   5. Try power cycling router");
    
    // Don't start config mode - just retry connection after delay
    Serial.println("🔄 Retrying connection in 10 seconds...");
    delay(10000);
    ESP.restart();
  }
}

void attemptWiFiConnection() {
  // This function is no longer used - replaced by enhancedWiFiConnection
  enhancedWiFiConnection();
}

void startConfigMode() {
  // ⭐ CONFIG MODE DISABLED - USING DEFAULTS ONLY ⭐
  Serial.println("🚫 CONFIG MODE DISABLED - Using default credentials only");
  Serial.println("🔄 Restarting to retry connection...");
  delay(5000);
  ESP.restart();
}

void sendStartupAnnouncement() {
  DynamicJsonDocument doc(512);
  doc["deviceId"] = deviceId;
  doc["nodeRole"] = nodeRole;
  doc["grainType"] = grainType;
  doc["status"] = "online";
  doc["message"] = "Node started successfully with default credentials";
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  
  String payload;
  serializeJson(doc, payload);
  
  Serial.println("📤 Sending startup announcement...");
  
  // Enhanced POST with better error handling
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  http.setTimeout(15000);
  
  Serial.printf("🔗 Connecting to: %s\n", serverUrl.c_str());
  
  int code = http.POST(payload);
  if (code > 0) {
    Serial.printf("✅ POST successful! Code: %d\n", code);
    String response = http.getString();
    Serial.printf("📥 Server response: %s\n", response.c_str());
  } else {
    Serial.printf("❌ POST failed! Error: %d - %s\n", code, http.errorToString(code).c_str());
    Serial.println("💡 Make sure your server is running at: " + serverUrl);
  }
  http.end();
}

///// GRAIN MONITORING ALGORITHMS /////
float calculateSpoilageRisk(float temp, float hum) {
  float risk = 0;
  
  // Temperature contribution (ideal: 15-25°C)
  if (temp > 25) risk += (temp - 25) * 2;
  if (temp < 15) risk += (15 - temp) * 1;
  
  // Humidity contribution (ideal: 12-15% for grains)
  if (hum > 15) risk += (hum - 15) * 3;
  
  // Use Arduino's min function correctly
  if (risk > 100.0) return 100.0;
  return risk;
}

String determineGrainHealth(float temp, float hum, float mq_ratio) {
  if (temp > TEMP_ALARM || hum > HUMIDITY_ALARM || mq_ratio > MQ_RATIO_ALARM) {
    return "CRITICAL";
  } else if (temp > TEMP_WARN || hum > HUMIDITY_WARN || mq_ratio > MQ_RATIO_WARN) {
    return "WARNING";
  } else if (calculateSpoilageRisk(temp, hum) > 30) {
    return "CAUTION";
  } else {
    return "GOOD";
  }
}

float calculateSafeStorageDays(float spoilageRisk) {
  if (spoilageRisk < 10) return 180;
  if (spoilageRisk < 20) return 90;
  if (spoilageRisk < 30) return 30;
  if (spoilageRisk < 50) return 7;
  return 1;
}

bool readSensors(float &temp, float &hum, float &mq_value) {
  temp = dht.readTemperature();
  hum = dht.readHumidity();
  mq_value = analogRead(MQ_PIN);
  
  if (isnan(temp) || isnan(hum)) {
    Serial.println("❌ Sensor reading error");
    return false;
  }
  
  if (mq_value < 10) {
    Serial.println("⚠️ MQ sensor may be disconnected");
    mq_value = mqBaseline;
  }
  
  return true;
}

void processSensorData(float temp, float hum, float mq_value) {
  float mq_ratio = mq_value / mqBaseline;
  float spoilageRisk = calculateSpoilageRisk(temp, hum);
  String grainHealth = determineGrainHealth(temp, hum, mq_ratio);
  float safeDays = calculateSafeStorageDays(spoilageRisk);
  
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = deviceId;
  doc["nodeRole"] = nodeRole;
  doc["grainType"] = grainType;
  doc["timestamp"] = millis();
  
  // Sensor readings
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["mq_value"] = mq_value;
  doc["mq_ratio"] = mq_ratio;
  doc["mq_baseline"] = mqBaseline;
  
  // Calculated metrics
  doc["spoilageRisk"] = spoilageRisk;
  doc["grainHealth"] = grainHealth;
  doc["safeStorageDays"] = safeDays;
  doc["status"] = grainHealth;
  
  // System info
  doc["rssi"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  doc["freeHeap"] = ESP.getFreeHeap();
  
  String payload;
  serializeJson(doc, payload);
  
  Serial.printf("📊 [%s] Temp: %.1fC, Hum: %.1f%%, Risk: %.1f%%, Health: %s\n",
                deviceId.c_str(), temp, hum, spoilageRisk, grainHealth.c_str());
  
  if (!postJson(payload)) {
    Serial.println("❌ Failed to send data");
  }
}

bool postJson(const String &payload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected");
    return false;
  }
  
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  http.setTimeout(10000);
  
  int code = http.POST(payload);
  if (code > 0 && code < 300) {
    Serial.printf("✅ POST OK code=%d\n", code);
    http.end();
    return true;
  } else {
    Serial.printf("❌ POST failed code=%d\n", code);
    http.end();
    return false;
  }
}

void loop() {
  // Main monitoring loop
  unsigned long now = millis();
  if (now - lastSampleMillis >= SAMPLE_INTERVAL_MS) {
    lastSampleMillis = now;
    
    float temp, hum, mq_value;
    if (readSensors(temp, hum, mq_value)) {
      processSensorData(temp, hum, mq_value);
    }
  }
  
  delay(1000);
}