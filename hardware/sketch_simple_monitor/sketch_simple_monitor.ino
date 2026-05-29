#include <ESP8266WiFi.h>
#include "HX711.h"
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

#include "config.h"

String deviceId = "";

enum MeasurementMode {
  PRODUCTION_MODE,
  TEST_MODE
};

MeasurementMode currentMode = PRODUCTION_MODE;

const int NUM_INTERVALS = 4;
unsigned long INTERVALS[NUM_INTERVALS] = {40000, 50000, 60000, 70000};
String intervalNames[NUM_INTERVALS] = {"40s", "50s", "60s", "70s"};

struct IntervalData {
  unsigned long lastMeasureTime;
  float previousWeight;
  float currentFlowRate;
  int cycleCount;
};

struct ServerLastData {
  float lastFlowRate;
  int lastRemainingVolume;
  float lastDeviation;
  bool hasData;
};

ServerLastData serverLastData = {0, 0, 0, false};

IntervalData intervalData[NUM_INTERVALS];

float combinedAverageFlowRate = 0;

const unsigned long PING_INTERVAL = 30000;
const unsigned long PRESCRIPTION_REQUEST_INTERVAL = 60000;

float calibration_factor = 400;

const float WEIGHT_DETECTION_THRESHOLD = 50.0;
const unsigned long AUTO_START_DELAY = 10000;
const float EMPTY_BAG_WEIGHT = 100.0;

const float WARNING_DEVIATION_THRESHOLD = 10.0;
const float CRITICAL_DEVIATION_THRESHOLD = 20.0;

const unsigned long MIN_SEND_INTERVAL = 5000;

struct PrescriptionInfo {
  float totalVolume;
  float prescribedRate;
  int gttFactor;
  int calculatedGTT;
  bool isInitialized;
};

PrescriptionInfo prescription = {0, 0, 20, 0, false};

struct ValidationData {
  float expectedFlowRate;
  float minAcceptableRate;
  float maxAcceptableRate;
  float warningDeviationPercent;
  float criticalDeviationPercent;
  float totalDurationMin;
  unsigned long startTimeMs;
};

ValidationData validation = {0, 0, 0, 10.0, 20.0, 0, 0};

enum SystemState {
  WAITING_WEIGHT,
  MEASURING,
  COMPLETED
};

SystemState currentState = WAITING_WEIGHT;

float baselineWeight = 0;
float initialWeight = 0;
float currentWeight = 0;

unsigned long weightDetectedTime = 0;
unsigned long measureStartTime = 0;
unsigned long lastDataSendTime = 0;
bool initialDataSent = false;

unsigned long lastPingTime = 0;
unsigned long lastPrescriptionRequestTime = 0;
bool prescriptionRequestFailed = false;

const unsigned long WIFI_RECONNECT_INTERVAL = 30000;
unsigned long lastWifiCheck = 0;
bool wifiConnected = false;

const float SENSOR_ERROR_VALUE = -999.0;
const int MAX_SENSOR_READ_ATTEMPTS = 3;
int sensorErrorCount = 0;

unsigned long TEST_MEASURE_INTERVAL = 60000;
unsigned long lastTestMeasureTime = 0;
float testPreviousWeight = 0;
float testCurrentFlowRate = 0;
float testTotalFlowSum = 0;
int testMeasurementCount = 0;
float testMinFlowRate = 99999;
float testMaxFlowRate = -99999;

HX711 scale;
WiFiClient client;
HTTPClient http;

void checkAndReconnectWiFi() {
  unsigned long now = millis();
  if (now - lastWifiCheck >= WIFI_RECONNECT_INTERVAL) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      Serial.println("WiFi connection lost! Reconnecting...");
      WiFi.disconnect();
      delay(100);
      WiFi.begin(ssid, password);
      int attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
        ESP.wdtFeed();
      }
      if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.println(" reconnected!");
      }
    } else {
      wifiConnected = true;
    }
  }
}

float safeReadSensor() {
  if (!scale.wait_ready_timeout(1000)) {
    Serial.println("[SENSOR ERROR] Sensor not ready");
    sensorErrorCount++;
    return SENSOR_ERROR_VALUE;
  }

  for (int attempt = 1; attempt <= MAX_SENSOR_READ_ATTEMPTS; attempt++) {
    scale.set_scale(calibration_factor);
    float weight = scale.get_units(10);

    if (weight > -100 && weight < 10000) {
      sensorErrorCount = 0;
      return weight;
    }

    if (attempt < MAX_SENSOR_READ_ATTEMPTS) {
      delay(100);
    }
  }

  Serial.println("[SENSOR ERROR] All read attempts failed");
  sensorErrorCount++;
  return SENSOR_ERROR_VALUE;
}

float calculateFlowRate(float prevWeight, float currWeight, unsigned long intervalMs) {
  float weightChange = prevWeight - currWeight;

  // 극미량 변화(노이즈)는 무시
  if (abs(weightChange) < 0.05) {
    return 0;
  }

  // 무게 증가(센서 오류)는 심각한 경우만 무시
  if (weightChange < 0 && weightChange < -2.0) {
    return 0;  // 2g 이상 증가는 센서 오류
  }

  float actualInterval = intervalMs / 1000.0;
  float flowRatePerMin = (weightChange / actualInterval) * 60.0;

  return flowRatePerMin;
}

void calculateCombinedAverage() {
  float sum = 0;
  int count = 0;

  for (int i = 0; i < NUM_INTERVALS; i++) {
    if (intervalData[i].cycleCount > 0) {
      sum += intervalData[i].currentFlowRate;
      count++;
    }
  }

  if (count > 0) {
    combinedAverageFlowRate = sum / count;
  }
}

void configureIntervals() {
  Serial.println();
  Serial.println("====================================");
  Serial.println("Interval Configuration (4 intervals)");
  Serial.println("====================================");
  Serial.println();
  Serial.println("Enter 4 intervals in seconds (5-300)");
  Serial.println("Format: 40,50,60,70 (default: 40, 50, 60, 70 seconds)");
  Serial.println();
  Serial.print("Enter intervals: ");

  while (!Serial.available()) {
    delay(100);
  }

  String input = Serial.readStringUntil('\n');
  input.trim();
  Serial.println(input);

  int values[NUM_INTERVALS];
  int valueCount = 0;
  int startIndex = 0;

  for (int i = 0; i <= input.length(); i++) {
    if (i == input.length() || input.charAt(i) == ',') {
      String token = input.substring(startIndex, i);
      token.trim();
      if (token.length() > 0 && valueCount < NUM_INTERVALS) {
        values[valueCount] = token.toInt();
        valueCount++;
      }
      startIndex = i + 1;
    }
  }

  if (valueCount == NUM_INTERVALS) {
    bool allValid = true;
    for (int i = 0; i < NUM_INTERVALS; i++) {
      if (values[i] < 5 || values[i] > 300) {
        allValid = false;
        break;
      }
    }

    if (allValid) {
      for (int i = 0; i < NUM_INTERVALS; i++) {
        INTERVALS[i] = values[i] * 1000;
        intervalNames[i] = String(values[i]) + "s";
      }

      Serial.println();
      Serial.println("Intervals updated successfully:");
      for (int i = 0; i < NUM_INTERVALS; i++) {
        Serial.print("  Interval ");
        Serial.print(i + 1);
        Serial.print(": ");
        Serial.println(intervalNames[i]);
      }
    } else {
      Serial.println("ERROR: Intervals must be between 5-300 seconds");
      Serial.println("Using default: 40, 50, 60, 70 seconds");
    }
  } else {
    Serial.print("ERROR: Expected 4 intervals, got ");
    Serial.print(valueCount);
    Serial.println();
    Serial.println("Using default: 40, 50, 60, 70 seconds");
  }
  Serial.println();
}

void printMultiStatistics() {
  Serial.println();
  Serial.println("========================================");
  Serial.println("Multi-Interval Statistics");
  Serial.println("========================================");

  for (int i = 0; i < NUM_INTERVALS; i++) {
    Serial.println();
    Serial.print("[");
    Serial.print(intervalNames[i]);
    Serial.println(" Interval]");

    if (intervalData[i].cycleCount > 0) {
      Serial.print("  Cycle Count: ");
      Serial.println(intervalData[i].cycleCount);
      Serial.print("  Current Flow Rate: ");
      Serial.print(intervalData[i].currentFlowRate, 2);
      Serial.println(" mL/min");
    } else {
      Serial.println("  No measurements yet");
    }
  }

  Serial.println();
  Serial.println("========================================");
  Serial.println("Combined Statistics (4 Intervals)");
  Serial.println("========================================");

  int completedCount = 0;
  for (int i = 0; i < NUM_INTERVALS; i++) {
    if (intervalData[i].cycleCount > 0) {
      completedCount++;
    }
  }

  if (completedCount > 0) {
    Serial.print("  Intervals Measured: ");
    Serial.print(completedCount);
    Serial.println(" / 4");
    Serial.print("  Combined Average Flow Rate: ");
    Serial.print(combinedAverageFlowRate, 2);
    Serial.println(" mL/min");
    Serial.println();

    for (int i = 0; i < NUM_INTERVALS; i++) {
      if (intervalData[i].cycleCount > 0) {
        Serial.print("  - ");
        Serial.print(intervalNames[i]);
        Serial.print(": ");
        Serial.print(intervalData[i].currentFlowRate, 2);
        Serial.println(" mL/min");
      }
    }
  } else {
    Serial.println("  No measurements yet");
  }
  Serial.println();
}

float calculateRemainingTime(float remainingWeight, float measuredFlowRate) {
  if (measuredFlowRate <= 0 || remainingWeight <= 0) {
    return -1;
  }
  return remainingWeight / measuredFlowRate;
}

float calculateFlowDeviation(float measuredRate) {
  if (!prescription.isInitialized || prescription.prescribedRate <= 0) {
    return 0;
  }

  float deviation = (measuredRate - prescription.prescribedRate) / prescription.prescribedRate;
  return deviation * 100.0;
}

String getDeviationStatus(float deviation) {
  float absDeviation = abs(deviation);

  if (absDeviation < WARNING_DEVIATION_THRESHOLD) {
    return "Normal";
  } else if (absDeviation < CRITICAL_DEVIATION_THRESHOLD) {
    return "Warning";
  } else {
    return "Critical";
  }
}

void generateValidationData() {
  if (!prescription.isInitialized) {
    return;
  }

  validation.expectedFlowRate = prescription.prescribedRate;
  validation.minAcceptableRate = prescription.prescribedRate * 0.85;
  validation.maxAcceptableRate = prescription.prescribedRate * 1.15;
  validation.warningDeviationPercent = 15.0;
  validation.criticalDeviationPercent = 25.0;
  validation.totalDurationMin = prescription.totalVolume / prescription.prescribedRate;
  validation.startTimeMs = millis();

  Serial.println();
  Serial.println("Validation Data Generated:");
  Serial.print("  Expected Flow Rate: ");
  Serial.print(validation.expectedFlowRate, 2);
  Serial.println(" mL/min");
}

void sendPing() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  static int batteryLevel = 100;
  if (millis() > 60000) {
    batteryLevel = max(20, 100 - int((millis() - 60000) / 600000));
  }

  JsonDocument doc;
  doc["device_id"] = deviceId;
  doc["battery_level"] = batteryLevel;

  String json;
  serializeJson(doc, json);

  http.begin(client, serverHost, serverPort, "/api/esp/ping");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  int code = http.POST(json);

  if (code == 200) {
    String payload = http.getString();

    JsonDocument responseDoc;
    DeserializationError error = deserializeJson(responseDoc, payload);

    if (!error && responseDoc.containsKey("last_data")) {
      JsonObject lastData = responseDoc["last_data"].as<JsonObject>();
      if (!lastData.isNull()) {
        serverLastData.lastFlowRate = lastData["flow_rate"].as<float>();
        serverLastData.lastRemainingVolume = lastData["remaining_volume"].as<int>();
        serverLastData.lastDeviation = lastData["deviation"].as<float>();
        serverLastData.hasData = true;

        Serial.println("[PING] Server response received:");
        Serial.print("  Last Flow Rate: ");
        Serial.print(serverLastData.lastFlowRate, 2);
        Serial.println(" mL/min");
        Serial.print("  Last Remaining: ");
        Serial.print(serverLastData.lastRemainingVolume);
        Serial.println(" mL");
      } else {
        serverLastData.hasData = false;
      }
    }

    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
    digitalWrite(LED_BUILTIN, HIGH);
  }

  http.end();
}

bool shouldSendData(float currentDeviation) {
  if (!prescription.isInitialized) {
    Serial.println("[NO PRESCRIPTION] Skipping - no prescription data");
    return false;
  }

  if (abs(currentDeviation) < WARNING_DEVIATION_THRESHOLD) {
    Serial.print("[DEVIATION OK] ");
    Serial.print(currentDeviation, 1);
    Serial.print("% < ");
    Serial.print(WARNING_DEVIATION_THRESHOLD, 0);
    Serial.println("% - skipping");
    return false;
  }

  Serial.print("[DEVIATION ALERT] ");
  Serial.print(currentDeviation, 1);
  Serial.print("% >= ");
  Serial.print(WARNING_DEVIATION_THRESHOLD, 0);
  Serial.println("% - will transmit");
  return true;
}

void sendAlert(const char* alertType, float value) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  JsonDocument doc;
  doc["device_id"] = deviceId;
  doc["alert_type"] = alertType;
  doc["value"] = value;
  doc["deviation_percent"] = value;
  doc["timestamp"] = millis();

  String json;
  serializeJson(doc, json);

  http.begin(client, serverHost, serverPort, "/api/esp/alert");
  http.addHeader("Content-Type", "application/json");
  http.POST(json);
  http.end();
}

void sendData(float currentWeight, float measuredRate, float remainingTime, float deviation, const char* state) {
  float remainingLiquidWeight = currentWeight - EMPTY_BAG_WEIGHT - baselineWeight;
  float initialLiquidWeight = initialWeight - EMPTY_BAG_WEIGHT - baselineWeight;
  float consumedWeight = initialLiquidWeight - remainingLiquidWeight;

  JsonDocument doc;
  doc["device_id"] = deviceId;
  doc["current_weight"] = currentWeight;
  doc["initial_weight"] = initialWeight;
  doc["baseline_weight"] = baselineWeight;
  doc["weight_consumed"] = consumedWeight;
  doc["weight_remaining"] = remainingLiquidWeight;
  doc["flow_rate_measured"] = measuredRate;
  doc["flow_rate_prescribed"] = prescription.isInitialized ? prescription.prescribedRate : 0;
  doc["remaining_time_sec"] = remainingTime;
  doc["deviation_percent"] = deviation;
  doc["state"] = state;
  doc["prescription_available"] = prescription.isInitialized;
  doc["timestamp"] = millis();

  String json;
  serializeJson(doc, json);

  if (WiFi.status() == WL_CONNECTED) {
    http.begin(client, serverHost, serverPort, serverPath);
    http.addHeader("Content-Type", "application/json");

    Serial.println("[TRANSMIT] Sending data to server");

    int code = http.POST(json);

    if (code == 200) {
      Serial.println("[SUCCESS] Data transmitted");
    } else {
      Serial.print("[ERROR] HTTP response code: ");
      Serial.println(code);
    }

    http.end();
  }
}

void requestPrescriptionInfo() {
  unsigned long now = millis();

  if (prescription.isInitialized) {
    if (now - lastPrescriptionRequestTime < PRESCRIPTION_REQUEST_INTERVAL) {
      return;
    }
  }

  if (prescriptionRequestFailed) {
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  String initUrl = "/api/esp/init?device_id=" + deviceId;

  http.begin(client, serverHost, serverPort, initUrl);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    Serial.println(payload);

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc.containsKey("data")) {
      JsonObject data = doc["data"].as<JsonObject>();

      if (data.containsKey("total_volume_ml") && data.containsKey("flow_rate_ml_min")) {
        prescription.totalVolume = data["total_volume_ml"].as<float>();
        prescription.prescribedRate = data["flow_rate_ml_min"].as<float>();
        prescription.gttFactor = data.containsKey("gtt_factor") ? data["gtt_factor"].as<int>() : 20;
        prescription.calculatedGTT = data.containsKey("calculated_gtt") ? data["calculated_gtt"].as<int>() : (int)(prescription.prescribedRate * prescription.gttFactor);
        prescription.isInitialized = true;
        prescriptionRequestFailed = false;

        Serial.println();
        Serial.println("========================================");
        Serial.println("Prescription Information Loaded!");
        Serial.println("========================================");
        Serial.print("  Total Volume: ");
        Serial.print(prescription.totalVolume, 0);
        Serial.println(" mL");
        Serial.print("  Flow Rate: ");
        Serial.print(prescription.prescribedRate, 2);
        Serial.println(" mL/min");
        Serial.print("  GTT Factor: ");
        Serial.println(prescription.gttFactor);
        Serial.print("  GTT: ");
        Serial.print(prescription.calculatedGTT);
        Serial.println(" gtt/min");
        Serial.print("  Expected Duration: ");
        float expectedTime = prescription.totalVolume / prescription.prescribedRate;
        Serial.print(expectedTime, 1);
        Serial.print(" min (");
        Serial.print(expectedTime / 60.0, 1);
        Serial.println(" hours)");
        Serial.println("========================================");
        Serial.println();
        Serial.println("Monitoring will now track against prescription.");
        Serial.println();

        generateValidationData();
      }

      lastPrescriptionRequestTime = now;
    }

    http.end();
    return;

  } else if (httpCode > 0) {
    if (!prescriptionRequestFailed) {
      Serial.print("[HTTP ERROR] Failed to get prescription: ");
      Serial.println(httpCode);
      prescriptionRequestFailed = true;
    }
  }

  lastPrescriptionRequestTime = now;
  http.end();
}

const char* getStateString(SystemState state) {
  switch (state) {
    case WAITING_WEIGHT: return "WAITING_WEIGHT";
    case MEASURING: return "MEASURING";
    case COMPLETED: return "COMPLETED";
    default: return "UNKNOWN";
  }
}

void resetSystemForNewSession() {
  Serial.println();
  Serial.println("========================================");
  Serial.println("System Reset - New Session");
  Serial.println("========================================");
  Serial.println();
  Serial.println("Resetting baseline weight...");

  delay(3000);
  scale.tare();
  delay(2000);
  baselineWeight = scale.get_units(10);

  Serial.print("New baseline: ");
  Serial.print(baselineWeight);
  Serial.println(" g");

  for (int i = 0; i < NUM_INTERVALS; i++) {
    intervalData[i].currentFlowRate = 0;
    intervalData[i].cycleCount = 0;
  }

  initialDataSent = false;
  weightDetectedTime = 0;

  Serial.println();
  Serial.println("System ready for new session...");
  Serial.println();

  currentState = WAITING_WEIGHT;
}

float calculateTestFlowRate(float prevWeight, float currWeight, unsigned long intervalMs) {
  if (prevWeight <= 0 || currWeight <= 0) {
    return 0;
  }

  float weightChange = prevWeight - currWeight;

  if (weightChange < 0) {
    Serial.println("[WARNING] Negative weight change detected (weight increased)");
    return 0;
  }

  if (weightChange < 0.1) {
    return 0;
  }

  float actualInterval = intervalMs / 1000.0;
  float flowRatePerMin = (weightChange / actualInterval) * 60.0;

  return flowRatePerMin;
}

void printTestStatistics() {
  if (testMeasurementCount == 0) {
    Serial.println("No measurements available");
    return;
  }

  float avgFlowRate = testTotalFlowSum / testMeasurementCount;
  float range = testMaxFlowRate - testMinFlowRate;
  float variability = (avgFlowRate > 0) ? (range / avgFlowRate) * 100.0 : 0;

  Serial.println();
  Serial.println("========================================");
  Serial.println("Test Statistics");
  Serial.println("========================================");
  Serial.print("Interval: ");
  Serial.print(TEST_MEASURE_INTERVAL / 1000);
  Serial.println(" seconds");
  Serial.print("Measurement Count: ");
  Serial.println(testMeasurementCount);
  Serial.print("Average Flow Rate: ");
  Serial.print(avgFlowRate, 2);
  Serial.println(" mL/min");
  Serial.print("Min Flow Rate: ");
  Serial.print(testMinFlowRate, 2);
  Serial.println(" mL/min");
  Serial.print("Max Flow Rate: ");
  Serial.print(testMaxFlowRate, 2);
  Serial.println(" mL/min");
  Serial.print("Range: ");
  Serial.print(range, 2);
  Serial.println(" mL/min");
  Serial.print("Variability: ");
  Serial.print(variability, 1);
  Serial.println("%");
  Serial.println();
}

void setup() {
  delay(1000);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);

  ESP.wdtDisable();
  ESP.wdtEnable(8000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("Smart IV Pole - Multi-Interval Mode");
  Serial.println("========================================");
  Serial.println();
  Serial.println("Select Mode:");
  Serial.println("  1 - Production Mode (Multi-interval)");
  Serial.println("  2 - Test Mode (Single interval)");
  Serial.print("Enter 1 or 2 (auto-select in 10s): ");

  unsigned long modeSelectStart = millis();
  while (!Serial.available() && (millis() - modeSelectStart < 10000)) {
    delay(100);
    ESP.wdtFeed();
  }

  if (Serial.available()) {
    String modeInput = Serial.readStringUntil('\n');
    modeInput.trim();
    Serial.println(modeInput);

    if (modeInput == "2") {
      currentMode = TEST_MODE;
      Serial.println("TEST MODE selected");
    } else {
      currentMode = PRODUCTION_MODE;
      Serial.println("PRODUCTION MODE selected");
    }
  } else {
    currentMode = PRODUCTION_MODE;
    Serial.println("PRODUCTION MODE (auto-selected)");
  }

  Serial.println();

  uint8_t mac[6];
  WiFi.macAddress(mac);
  deviceId = "IV_POLE_";
  for (int i = 2; i < 6; i++) {
    if (mac[i] < 16) deviceId += "0";
    deviceId += String(mac[i], HEX);
  }
  deviceId.toUpperCase();

  Serial.print("[DEVICE] Unique ID: ");
  Serial.println(deviceId);

  Serial.println("[SENSOR] Initializing HX711...");
  scale.begin(D0, D1);
  delay(1000);

  bool sensorReady = scale.wait_ready_timeout(1000);

  if (sensorReady) {
    Serial.println("[OK] HX711 initialized");
    Serial.println("Calibrating baseline weight...");

    delay(3000);
    scale.set_scale();
    delay(2000);
    scale.tare();
    delay(2000);
    scale.set_scale(calibration_factor);

    baselineWeight = scale.get_units(10);

    Serial.print("[OK] Baseline: ");
    Serial.print(baselineWeight);
    Serial.println(" g");
  } else {
    Serial.println("[ERROR] HX711 initialization failed!");
    Serial.println("Check connections: DT=D0, SCK=D1, VCC=3.3V, GND=GND");
    delay(2000);
  }

  if (currentMode == PRODUCTION_MODE) {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);
    WiFi.begin(ssid, password);

    Serial.print("WiFi connecting");
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 60) {
      delay(500);
      Serial.print(".");
      attempts++;
      ESP.wdtFeed();
    }

    wifiConnected = (WiFi.status() == WL_CONNECTED);

    if (wifiConnected) {
      Serial.println();
      Serial.println("WiFi connected");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());
      Serial.println();
      Serial.println("Requesting prescription info...");

      requestPrescriptionInfo();
    } else {
      Serial.println();
      Serial.println("WiFi connection failed");
      Serial.println("Operating in offline mode");
    }
  }

  currentState = WAITING_WEIGHT;

  Serial.println();
  Serial.println("System ready...");

  delay(5000);

  currentWeight = safeReadSensor();
  Serial.print("Current net weight: ");
  Serial.print(currentWeight - baselineWeight);
  Serial.print("g (total: ");
  Serial.print(currentWeight);
  Serial.println("g)");

  if (currentMode == TEST_MODE) {
    testPreviousWeight = currentWeight;
    lastTestMeasureTime = millis();

    Serial.println();
    Serial.println("========================================");
    Serial.println("TEST MODE");
    Serial.println("========================================");
    Serial.println();
    Serial.println("Commands:");
    Serial.println("  - [number]: Change interval (5-300 seconds)");
    Serial.println("  - 's': Show statistics");
    Serial.println("  - 'r': Reset statistics");
    Serial.println("  - 't': Tare and restart");
    Serial.println();
    Serial.print("Current interval: ");
    Serial.print(TEST_MEASURE_INTERVAL / 1000);
    Serial.println(" seconds");
  } else {
    unsigned long now = millis();
    for (int i = 0; i < NUM_INTERVALS; i++) {
      intervalData[i].previousWeight = currentWeight;
      intervalData[i].lastMeasureTime = now;
      intervalData[i].currentFlowRate = 0;
      intervalData[i].cycleCount = 0;
    }

    lastPingTime = millis();
    lastPrescriptionRequestTime = millis();

    Serial.println();
    Serial.println("========================================");
    Serial.println("PRODUCTION MODE - Multi-Interval");
    Serial.println("========================================");
    Serial.println();
    Serial.println("Commands:");
    Serial.println("  - 's': Show statistics");
    Serial.println("  - 'c': Configure intervals");
    Serial.println("  - 'r': Reset statistics");
    Serial.println("  - 't': Tare and restart");
    Serial.println();
    Serial.print("Intervals: ");
    for (int i = 0; i < NUM_INTERVALS; i++) {
      Serial.print(intervalNames[i]);
      if (i < NUM_INTERVALS - 1) {
        Serial.print(", ");
      }
    }
    Serial.println();
    Serial.println();
    Serial.println("Monitoring in 10 seconds...");
  }

  delay(10000);
  ESP.wdtFeed();
}

void loop() {
  ESP.wdtFeed();
  unsigned long now = millis();

  if (currentMode == TEST_MODE) {
    if (Serial.available()) {
      String input = Serial.readStringUntil('\n');
      input.trim();

      if (input.length() > 0 && isDigit(input[0])) {
        int newInterval = input.toInt();
        if (newInterval >= 5 && newInterval <= 300) {
          TEST_MEASURE_INTERVAL = newInterval * 1000;
          Serial.print("Interval changed to: ");
          Serial.print(newInterval);
          Serial.println(" seconds");

          testPreviousWeight = safeReadSensor();
          lastTestMeasureTime = now;
          testMeasurementCount = 0;
          testTotalFlowSum = 0;
          testMinFlowRate = 99999;
          testMaxFlowRate = -99999;

          Serial.println("Statistics reset for new interval");
        } else {
          Serial.println("Invalid interval (5-300 seconds)");
        }
      } else if (input == "s" || input == "S") {
        printTestStatistics();
      } else if (input == "r" || input == "R") {
        testMeasurementCount = 0;
        testTotalFlowSum = 0;
        testMinFlowRate = 99999;
        testMaxFlowRate = -99999;
        Serial.println("Statistics reset");
      } else if (input == "t" || input == "T") {
        Serial.println("Taring scale!");
        delay(3000);

        scale.tare();
        delay(2000);
        baselineWeight = scale.get_units(10);

        Serial.print("New baseline: ");
        Serial.print(baselineWeight);
        Serial.println(" g");

        Serial.println("Restarting measurement...");
        delay(5000);

        testPreviousWeight = safeReadSensor();
        lastTestMeasureTime = now;
        testMeasurementCount = 0;
        testTotalFlowSum = 0;
        testMinFlowRate = 99999;
        testMaxFlowRate = -99999;

        Serial.print("Net weight: ");
        Serial.print(testPreviousWeight - baselineWeight);
        Serial.println(" g");
      }
    }

    if (now - lastTestMeasureTime >= TEST_MEASURE_INTERVAL) {
      currentWeight = safeReadSensor();

      if (currentWeight != SENSOR_ERROR_VALUE) {
        testCurrentFlowRate = calculateTestFlowRate(
          testPreviousWeight,
          currentWeight,
          TEST_MEASURE_INTERVAL
        );

        testMeasurementCount++;

        if (testCurrentFlowRate > 0) {
          testTotalFlowSum += testCurrentFlowRate;
          if (testCurrentFlowRate < testMinFlowRate) {
            testMinFlowRate = testCurrentFlowRate;
          }
          if (testCurrentFlowRate > testMaxFlowRate) {
            testMaxFlowRate = testCurrentFlowRate;
          }
        }

        float netWeight = currentWeight - baselineWeight;
        float consumed = testPreviousWeight - currentWeight;

        Serial.println();
        Serial.print("Measurement #");
        Serial.print(testMeasurementCount);
        Serial.print(" [");
        Serial.print(TEST_MEASURE_INTERVAL / 1000);
        Serial.println(" sec]");
        Serial.println("----------------------------------------");
        Serial.print("  Previous: ");
        Serial.print(testPreviousWeight, 2);
        Serial.println(" g");
        Serial.print("  Current: ");
        Serial.print(currentWeight, 2);
        Serial.println(" g");
        Serial.print("  Consumed: ");
        Serial.print(consumed, 2);
        Serial.println(" g");
        Serial.println("----------------------------------------");
        Serial.print("  Flow Rate: ");
        Serial.print(testCurrentFlowRate, 2);
        Serial.println(" mL/min");
        Serial.println("----------------------------------------");
        Serial.print("  Net Weight: ");
        Serial.print(netWeight, 1);
        Serial.println(" g");

        if (testMeasurementCount > 0) {
          float avgFlowRate = testTotalFlowSum / testMeasurementCount;
          Serial.print("  Average: ");
          Serial.print(avgFlowRate, 2);
          Serial.println(" mL/min");
        }
        Serial.println();
      }

      testPreviousWeight = currentWeight;
      lastTestMeasureTime = now;
    }

    delay(10);
    return;
  }

  checkAndReconnectWiFi();

  if (now - lastPingTime >= PING_INTERVAL) {
    sendPing();
    lastPingTime = now;
  }

  requestPrescriptionInfo();

  if (Serial.available()) {
    char command = Serial.read();

    if (command == 's' || command == 'S') {
      printMultiStatistics();
    } else if (command == 'c' || command == 'C') {
      configureIntervals();
      float newWeight = safeReadSensor();
      for (int i = 0; i < NUM_INTERVALS; i++) {
        intervalData[i].previousWeight = newWeight;
        intervalData[i].lastMeasureTime = now;
        intervalData[i].currentFlowRate = 0;
        intervalData[i].cycleCount = 0;
      }
      Serial.println("Measurement restarted with new intervals");
    } else if (command == 'r' || command == 'R') {
      for (int i = 0; i < NUM_INTERVALS; i++) {
        intervalData[i].currentFlowRate = 0;
        intervalData[i].cycleCount = 0;
      }
      Serial.println("Statistics reset");
    } else if (command == 't' || command == 'T') {
      Serial.println("Taring scale!");
      delay(3000);

      scale.tare();
      delay(2000);
      baselineWeight = scale.get_units(10);

      Serial.print("New baseline: ");
      Serial.print(baselineWeight);
      Serial.println(" g");

      Serial.println("Restarting measurement...");
      delay(15000);

      float newWeight = safeReadSensor();
      for (int i = 0; i < NUM_INTERVALS; i++) {
        intervalData[i].previousWeight = newWeight;
        intervalData[i].lastMeasureTime = now;
        intervalData[i].currentFlowRate = 0;
        intervalData[i].cycleCount = 0;
      }

      Serial.print("Net weight: ");
      Serial.print(newWeight - baselineWeight);
      Serial.println(" g");
    }
  }

  switch (currentState) {
    case WAITING_WEIGHT: {
        currentWeight = safeReadSensor();

        if (currentWeight == SENSOR_ERROR_VALUE) {
          delay(1000);
          break;
        }

        if (currentWeight - baselineWeight >= WEIGHT_DETECTION_THRESHOLD) {
          if (weightDetectedTime == 0) {
            weightDetectedTime = now;
            Serial.print("Weight detected: ");
            Serial.print(currentWeight - baselineWeight);
            Serial.println(" g - starting in 10 seconds...");
          }

          if (now - weightDetectedTime >= AUTO_START_DELAY) {
            initialWeight = currentWeight;
            measureStartTime = now;

            for (int i = 0; i < NUM_INTERVALS; i++) {
              intervalData[i].previousWeight = currentWeight;
              intervalData[i].lastMeasureTime = now;
            }

            Serial.print("Starting measurement - Initial weight: ");
            Serial.print(initialWeight);
            Serial.println(" g");
            Serial.println("Measurement started!");

            currentState = MEASURING;
            weightDetectedTime = 0;
          }
        } else {
          weightDetectedTime = 0;
        }

        delay(500);
        break;
      }

    case MEASURING: {
        bool anyMeasurement = false;
        bool allIntervalsCompleted = false;

        for (int i = 0; i < NUM_INTERVALS; i++) {
          if (now - intervalData[i].lastMeasureTime >= INTERVALS[i]) {
            float freshWeight = safeReadSensor();

            if (freshWeight == SENSOR_ERROR_VALUE) {
              intervalData[i].lastMeasureTime = now;
              continue;
            }

            float flowRate = calculateFlowRate(
              intervalData[i].previousWeight,
              freshWeight,
              INTERVALS[i]
            );

            intervalData[i].currentFlowRate = flowRate;
            intervalData[i].cycleCount++;

            float weightChange = intervalData[i].previousWeight - freshWeight;

            Serial.print("[");
            Serial.print(intervalNames[i]);
            Serial.print(" #");
            Serial.print(intervalData[i].cycleCount);
            Serial.print("] ");
            Serial.print(intervalData[i].previousWeight, 1);
            Serial.print("g -> ");
            Serial.print(freshWeight, 1);
            Serial.print("g (");

            if (weightChange >= 0) {
              Serial.print(weightChange, 2);
              Serial.print("g decrease");
            } else {
              Serial.print("WARNING: ");
              Serial.print(abs(weightChange), 2);
              Serial.print("g increase");
            }

            Serial.print(") -> Flow rate: ");
            Serial.print(flowRate, 2);
            Serial.println(" mL/min");

            intervalData[i].previousWeight = freshWeight;
            intervalData[i].lastMeasureTime = now;
            currentWeight = freshWeight;

            anyMeasurement = true;
          }
        }

        allIntervalsCompleted = true;
        for (int j = 0; j < NUM_INTERVALS; j++) {
          if (intervalData[j].cycleCount == 0) {
            allIntervalsCompleted = false;
            break;
          }
        }

        delay(200);

        if (anyMeasurement && allIntervalsCompleted) {
          calculateCombinedAverage();

          Serial.println();
          Serial.println("========================================");
          Serial.println("Combined Results (4 Intervals Completed)");
          Serial.println("========================================");
          Serial.println();

          for (int i = 0; i < NUM_INTERVALS; i++) {
            if (intervalData[i].cycleCount > 0) {
              Serial.print("  ");
              Serial.print(intervalNames[i]);
              Serial.print(": ");
              Serial.print(intervalData[i].currentFlowRate, 2);
              Serial.println(" mL/min");
            }
          }

          Serial.println();
          Serial.print("  Combined average: ");
          Serial.print(combinedAverageFlowRate, 2);
          Serial.println(" mL/min");

          if (prescription.isInitialized) {
            float deviation = calculateFlowDeviation(combinedAverageFlowRate);
            String status = getDeviationStatus(deviation);

            Serial.print("  Target: ");
            Serial.print(prescription.prescribedRate, 2);
            Serial.print(" mL/min | Deviation: ");
            if (deviation >= 0) {
              Serial.print("+");
            }
            Serial.print(deviation, 1);
            Serial.print("% ");
            Serial.println(status);
          }

          Serial.println();
          Serial.println("========================================");

          if (combinedAverageFlowRate > 0) {
            float remainingLiquidWeight = currentWeight - EMPTY_BAG_WEIGHT - baselineWeight;
            float initialLiquidWeight = initialWeight - EMPTY_BAG_WEIGHT - baselineWeight;
            float consumedLiquidWeight = initialLiquidWeight - remainingLiquidWeight;

            float percentage = 0;
            if (initialLiquidWeight > 0) {
              percentage = (remainingLiquidWeight / initialLiquidWeight) * 100.0;
            }

            int remainingVolume = int(remainingLiquidWeight);
            float remainingTime = calculateRemainingTime(remainingLiquidWeight, combinedAverageFlowRate);
            float deviation = calculateFlowDeviation(combinedAverageFlowRate);

            bool shouldSend = false;
            String sendReason = "";

            if (!initialDataSent) {
              shouldSend = true;
              sendReason = "[INITIAL] First transmission";
              initialDataSent = true;
            } else if (shouldSendData(deviation)) {
              shouldSend = true;
              if (abs(deviation) >= CRITICAL_DEVIATION_THRESHOLD) {
                sendReason = "[CRITICAL] Deviation >= 20%";
                sendAlert("FLOW_RATE_CRITICAL", deviation);
              } else {
                sendReason = "[WARNING] Deviation >= 10%";
                sendAlert("FLOW_RATE_WARNING", deviation);
              }
            }

            if (shouldSend && (now - lastDataSendTime >= MIN_SEND_INTERVAL)) {
              Serial.print("[TRANSMIT] ");
              Serial.println(sendReason);
              sendData(currentWeight, combinedAverageFlowRate, remainingTime * 60.0, deviation, getStateString(currentState));

              serverLastData.lastFlowRate = combinedAverageFlowRate;
              serverLastData.lastRemainingVolume = remainingVolume;
              serverLastData.lastDeviation = deviation;
              serverLastData.hasData = true;

              lastDataSendTime = now;
            }

            if (remainingLiquidWeight <= 0) {
              Serial.println();
              Serial.println("========================================");
              Serial.println("Infusion Completed!");
              Serial.println("========================================");
              Serial.println();
              Serial.print("  Total consumed: ");
              Serial.print(consumedLiquidWeight, 2);
              Serial.println(" mL");
              Serial.print("  Duration: ");
              Serial.print((now - measureStartTime) / 1000.0);
              Serial.println(" seconds");

              sendAlert("INFUSION_COMPLETE", consumedLiquidWeight);
              sendData(currentWeight, combinedAverageFlowRate, 0, deviation, "COMPLETED");

              currentState = COMPLETED;
            }
          }
        } else if (anyMeasurement && !allIntervalsCompleted) {
          Serial.println("Waiting for all intervals to complete...");
        }

        break;
      }

    case COMPLETED: {
        static bool completedMessageShown = false;
        if (!completedMessageShown) {
          Serial.println("Session completed");
          completedMessageShown = true;
        }
        delay(3000);
        resetSystemForNewSession();
        completedMessageShown = false;
        break;
      }
  }

  delay(10);
}
