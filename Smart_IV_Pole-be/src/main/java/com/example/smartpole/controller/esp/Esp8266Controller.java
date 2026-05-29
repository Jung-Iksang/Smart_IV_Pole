package com.example.smartpole.controller.esp;

import com.example.smartpole.entity.AlertLog;
import com.example.smartpole.entity.InfusionSession;
import com.example.smartpole.entity.Pole;
import com.example.smartpole.entity.Prescription;
import com.example.smartpole.repository.InfusionSessionRepository;
import com.example.smartpole.service.AlertLogService;
import com.example.smartpole.service.InfusionSessionService;
import com.example.smartpole.service.PoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/esp")
@RequiredArgsConstructor
public class Esp8266Controller {

    private final InfusionSessionService infusionSessionService;
    private final InfusionSessionRepository infusionSessionRepository;
    private final AlertLogService alertLogService;
    private final PoleService poleService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * ESP8266에서 실시간 센서 데이터 수신 (확장된 데이터 구조)
     * 3초마다 무게, 유속, 편차, 예측 시간, 상태를 전송받음
     */
    @PostMapping("/data")
    public Map<String, Object> receiveData(@RequestBody Map<String, Object> data) {
        try {
            // 1. 확장된 데이터 파싱
            String deviceId = (String) data.get("device_id");

            // 무게 데이터
            Double currentWeight = parseDouble(data.get("current_weight"));
            Double initialWeight = parseDouble(data.get("initial_weight"));
            Double baselineWeight = parseDouble(data.get("baseline_weight"));
            Double weightConsumed = parseDouble(data.get("weight_consumed"));
            Double weightRemaining = parseDouble(data.get("weight_remaining"));

            // 유속 데이터
            Double flowRateMeasured = parseDouble(data.get("flow_rate_measured"));
            Double flowRatePrescribed = parseDouble(data.get("flow_rate_prescribed"));
            Double deviationPercent = parseDouble(data.get("deviation_percent"));

            // 시간 데이터
            Double remainingTimeSec = parseDouble(data.get("remaining_time_sec"));

            // 상태 데이터
            String state = (String) data.get("state");

            System.out.println("=== ESP8266 확장 데이터 수신 ===");
            System.out.println("Device ID: " + deviceId);
            System.out.println("Current Weight: " + currentWeight + "g");
            System.out.println("Flow Rate (Measured): " + flowRateMeasured + " mL/min");
            System.out.println("Flow Rate (Prescribed): " + flowRatePrescribed + " mL/min");
            System.out.println("Deviation: " + deviationPercent + "%");
            System.out.println("Remaining Time: " + (remainingTimeSec != null ? remainingTimeSec / 60.0 : 0) + " min");
            System.out.println("State: " + state);

            // 2. InfusionSession 찾기 (device_id = pole_id)
            Optional<InfusionSession> sessionOpt = infusionSessionService.getActiveSessionByPole(deviceId);

            if (sessionOpt.isEmpty()) {
                System.out.println("⚠️ No active session found for pole: " + deviceId);
                return createResponse("success", "Data received but no active session", data);
            }

            InfusionSession session = sessionOpt.get();

            // 3. InfusionSession 업데이트 (수액팩 무게 보정)
            // 투여량 = 초기 무게 - 현재 무게 (감소량 = 순수 수액량)
            int consumedVolume = 0;
            int remainingVolume = session.getTotalVolumeMl();

            if (initialWeight != null && currentWeight != null) {
                consumedVolume = (int)(initialWeight - currentWeight);
                remainingVolume = Math.max(0, session.getTotalVolumeMl() - consumedVolume);

                // 무게 정보 저장
                session.setInitialWeightGrams(initialWeight);
                session.setBaselineWeightGrams(baselineWeight);
                session.setConsumedVolumeMl(consumedVolume);
                session.setRemainingVolume(remainingVolume);

                System.out.println("📊 투여량 계산: " + consumedVolume + "mL (초기 " + initialWeight + "g - 현재 " + currentWeight + "g)");
                System.out.println("📊 잔량: " + remainingVolume + "mL / " + session.getTotalVolumeMl() + "mL");
            } else {
                // 무게 데이터 없으면 기존 방식 유지
                remainingVolume = weightRemaining != null ? weightRemaining.intValue() : session.getRemainingVolume();
                session.setRemainingVolume(remainingVolume);
            }

            // 실시간 센서 데이터 업데이트
            session.setRealTimeWeight(currentWeight);
            session.setMeasuredFlowRate(flowRateMeasured);
            session.setDeviationPercent(deviationPercent);
            session.setSensorState(state);
            session.setLastSensorUpdate(LocalDateTime.now());

            // 예측 종료 시간 계산 및 저장
            if (remainingTimeSec != null && remainingTimeSec > 0) {
                LocalDateTime endExpTime = LocalDateTime.now().plusSeconds(remainingTimeSec.longValue());
                session.setEndExpTime(endExpTime);
            }

            // DB 저장 (실시간 데이터 포함)
            infusionSessionService.updateRemainingVolume(session.getSessionId(), remainingVolume);

            // 4. 유속 편차가 크면 자동 경고 생성
            if (deviationPercent != null && Math.abs(deviationPercent) > 15.0) {
                String severity = Math.abs(deviationPercent) > 25 ? "critical" : "warning";
                String alertMessage = String.format(
                    "유속 편차 감지: %.1f%% (처방: %.2f mL/min, 측정: %.2f mL/min)",
                    deviationPercent,
                    flowRatePrescribed != null ? flowRatePrescribed : 0,
                    flowRateMeasured != null ? flowRateMeasured : 0
                );

                alertLogService.createAlert(
                    session.getSessionId(),
                    "flow_stopped",
                    severity,
                    alertMessage
                );

                System.out.println("⚠️ 자동 경고 생성: " + alertMessage);
            }

            // 5. WebSocket으로 실시간 브로드캐스트 (확장된 데이터)
            Map<String, Object> wsMessage = new HashMap<>();
            wsMessage.put("device_id", deviceId);
            wsMessage.put("patient_id", session.getPatientId());
            wsMessage.put("session_id", session.getSessionId());

            // 무게 정보 (수액팩 무게 보정 적용)
            wsMessage.put("current_weight", currentWeight);
            wsMessage.put("initial_weight", initialWeight);
            wsMessage.put("consumed_volume", consumedVolume);  // 투여량
            wsMessage.put("remaining_volume", remainingVolume);  // 잔량
            double percentage = (double)consumedVolume / session.getTotalVolumeMl() * 100.0;
            wsMessage.put("percentage", Math.min(100.0, percentage));  // 진행률 (투여량 기준)

            // 유속 정보
            wsMessage.put("flow_rate_measured", flowRateMeasured);
            wsMessage.put("flow_rate_prescribed", flowRatePrescribed);
            wsMessage.put("deviation_percent", deviationPercent);

            // 시간 정보
            wsMessage.put("remaining_time_sec", remainingTimeSec);

            // 상태 정보
            wsMessage.put("state", state);
            wsMessage.put("timestamp", LocalDateTime.now().toString());

            // 전체 클라이언트에게 브로드캐스트
            messagingTemplate.convertAndSend("/topic/pole/" + deviceId, wsMessage);
            messagingTemplate.convertAndSend("/topic/patient/" + session.getPatientId(), wsMessage);
            // 통합 환자 데이터 토픽 (프론트엔드가 단일 토픽 구독)
            messagingTemplate.convertAndSend("/topic/patients", wsMessage);

            System.out.println("✅ 데이터 업데이트 및 브로드캐스트 완료");

            return createResponse("success", "Data processed successfully", wsMessage);

        } catch (Exception e) {
            System.err.println("❌ 데이터 처리 오류: " + e.getMessage());
            e.printStackTrace();
            return createResponse("error", "Failed to process data: " + e.getMessage(), data);
        }
    }

    /**
     * ESP8266에서 경고 알림 수신
     * 유속 이상 감지 시 호출됨
     */
    @PostMapping("/alert")
    public Map<String, Object> receiveAlert(@RequestBody Map<String, Object> data) {
        try {
            // 1. 데이터 파싱
            String deviceId = (String) data.get("device_id");
            String alertType = (String) data.get("alert_type");
            Double deviationPercent = parseDouble(data.get("deviation_percent"));
            Long timestamp = parseLong(data.get("timestamp"));

            System.out.println("=== ESP8266 경고 수신 ===");
            System.out.println("Device ID: " + deviceId);
            System.out.println("Alert Type: " + alertType);
            System.out.println("Deviation: " + deviationPercent + "%");

            // 2. InfusionSession 찾기
            Optional<InfusionSession> sessionOpt = infusionSessionService.getActiveSessionByPole(deviceId);

            if (sessionOpt.isEmpty()) {
                System.out.println("⚠️ No active session found for pole: " + deviceId);
                return createResponse("success", "Alert received but no active session", data);
            }

            InfusionSession session = sessionOpt.get();

            // 3. AlertLog 생성
            String message = String.format(
                "유속 이상 감지: 예상값과 %.1f%% 차이 (Pole: %s, Patient ID: %d)",
                deviationPercent,
                deviceId,
                session.getPatientId()
            );

            // severity: 15% 이상 = warning, 25% 이상 = critical
            String severity = deviationPercent > 25 ? "critical" : "warning";

            AlertLog alert = alertLogService.createAlert(
                session.getSessionId(),
                "flow_stopped",  // AlertType enum 값
                severity,
                message
            );

            System.out.println("✅ 경고 로그 생성 완료: Alert ID " + alert.getAlertId());

            // 4. WebSocket으로 경고 브로드캐스트
            Map<String, Object> wsAlert = new HashMap<>();
            wsAlert.put("alert_id", alert.getAlertId());
            wsAlert.put("device_id", deviceId);
            wsAlert.put("patient_id", session.getPatientId());
            wsAlert.put("session_id", session.getSessionId());
            wsAlert.put("alert_type", alertType);
            wsAlert.put("severity", severity);
            wsAlert.put("message", message);
            wsAlert.put("deviation_percent", deviationPercent);
            wsAlert.put("timestamp", LocalDateTime.now().toString());

            // 경고 전용 토픽으로 브로드캐스트
            messagingTemplate.convertAndSend("/topic/alerts", wsAlert);
            messagingTemplate.convertAndSend("/topic/pole/" + deviceId + "/alert", wsAlert);

            System.out.println("✅ 경고 브로드캐스트 완료");

            return createResponse("success", "Alert processed successfully", wsAlert);

        } catch (Exception e) {
            System.err.println("❌ 경고 처리 오류: " + e.getMessage());
            e.printStackTrace();
            return createResponse("error", "Failed to process alert: " + e.getMessage(), data);
        }
    }

    /**
     * ESP8266 초기화 - 처방 정보 전달
     * ESP8266이 부팅 시 이 엔드포인트를 호출하여 간호사가 입력한 처방 정보를 받음
     * Fallback: iv_pole_id가 NULL인 경우 Pole 테이블 조회 후 자동 연결
     */
    @GetMapping("/init")
    public Map<String, Object> initializeDevice(@RequestParam String device_id) {
        try {
            System.out.println("=== ESP8266 초기화 요청 ===");
            System.out.println("Device ID: " + device_id);

            // 1차: iv_pole_id로 InfusionSession 찾기 (활성화된 세션)
            Optional<InfusionSession> sessionOpt = infusionSessionService.getActiveSessionByPole(device_id);

            // 2차: 실패 시 Pole 테이블에서 patient_id 조회 후 환자의 세션 찾기
            if (sessionOpt.isEmpty()) {
                System.out.println("[ESP INIT] Primary lookup failed - attempting fallback via Pole table");

                Optional<Pole> poleOpt = poleService.getPoleById(device_id);
                if (poleOpt.isPresent() && poleOpt.get().getPatientId() != null) {
                    Integer patientId = poleOpt.get().getPatientId();
                    System.out.println("[ESP INIT] Pole " + device_id + " → Patient " + patientId);

                    sessionOpt = infusionSessionService.getActiveSessionByPatient(patientId);

                    if (sessionOpt.isPresent()) {
                        // 세션을 찾았으면 iv_pole_id 자동 업데이트 (동기화)
                        InfusionSession session = sessionOpt.get();
                        session.setIvPoleId(device_id);
                        infusionSessionService.createSession(session); // @Transactional save
                        System.out.println("[ESP INIT] Auto-linked pole to session - Session " + session.getSessionId() + " → Pole " + device_id);
                    } else {
                        System.out.println("⚠️ No active session found for patient " + patientId);
                        return createResponse("error", "No active session found for patient " + patientId, null);
                    }
                } else {
                    System.out.println("⚠️ Pole not found or not assigned to any patient: " + device_id);
                    return createResponse("error", "No active session found for this device", null);
                }
            }

            InfusionSession session = sessionOpt.get();

            // 2. Prescription 정보 가져오기
            if (session.getPrescriptionId() == null) {
                System.out.println("⚠️ No prescription linked to session: " + session.getSessionId());
                return createResponse("error", "No prescription linked to this session", null);
            }

            // 3. 처방 정보 구성
            Map<String, Object> prescriptionData = new HashMap<>();
            prescriptionData.put("device_id", device_id);
            prescriptionData.put("session_id", session.getSessionId());
            prescriptionData.put("patient_id", session.getPatientId());
            prescriptionData.put("total_volume_ml", session.getTotalVolumeMl());

            // FlowRate는 mL/min으로 저장되어 있음 (그대로 전송)
            double flowRateMlMin = session.getFlowRate().doubleValue();
            prescriptionData.put("flow_rate_ml_min", flowRateMlMin);

            // Prescription 엔티티에서 실제 GTT 정보 가져오기
            Prescription prescription = session.getPrescription();
            if (prescription != null) {
                // 간호사가 입력한 실제 GTT 정보 사용
                prescriptionData.put("gtt_factor", prescription.getGttFactor());
                prescriptionData.put("calculated_gtt", prescription.getCalculatedGtt());

                System.out.println("GTT Factor: " + prescription.getGttFactor() + " 방울/mL");
                System.out.println("계산된 GTT: " + prescription.getCalculatedGtt() + " 방울/분");
            } else {
                // Fallback: Prescription 없으면 기본값 사용
                // 간호사 실제 공식: GTT/min = (총용량 mL × GTT factor) ÷ 시간(분)
                int gttFactor = 20;  // 기본: macro drip (20 drops/mL)
                double totalDurationMin = session.getTotalVolumeMl() / flowRateMlMin;
                int calculatedGtt = (int)((session.getTotalVolumeMl() * gttFactor) / totalDurationMin);

                prescriptionData.put("gtt_factor", gttFactor);
                prescriptionData.put("calculated_gtt", calculatedGtt);

                System.out.println("⚠️ Prescription 없음 - 기본값 사용 (GTT Factor: 20 방울/mL)");
                System.out.println("계산된 GTT: " + calculatedGtt + " 방울/분 (fallback 계산)");
            }

            // 4. 초기 무게 정보 (현재 남은 용량)
            prescriptionData.put("initial_volume_ml", session.getRemainingVolume());
            prescriptionData.put("start_time", session.getStartTime().toString());

            if (session.getEndExpTime() != null) {
                prescriptionData.put("expected_end_time", session.getEndExpTime().toString());
            }

            System.out.println("✅ 처방 정보 전송 완료");
            System.out.println("총 용량: " + session.getTotalVolumeMl() + " mL");
            System.out.println("유속: " + flowRateMlMin + " mL/min");

            return createResponse("success", "Prescription data retrieved successfully", prescriptionData);

        } catch (Exception e) {
            System.err.println("❌ 초기화 오류: " + e.getMessage());
            e.printStackTrace();
            return createResponse("error", "Failed to initialize device: " + e.getMessage(), null);
        }
    }

    /**
     * ESP8266 연결 테스트 엔드포인트
     */
    @GetMapping("/test")
    public Map<String, Object> test() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "ESP8266 서버 정상 작동 중!");
        response.put("timestamp", LocalDateTime.now().toString());
        return response;
    }

    /**
     * ESP8266 핑 수신 - 폴대 온라인 상태 관리
     * ESP8266이 30초마다 핑을 보내 온라인 상태 유지
     */
    @PostMapping("/ping")
public Map<String, Object> receivePing(@RequestBody Map<String, Object> data) {
    try {
        String deviceId = (String) data.get("device_id");
        Integer batteryLevel = parseInteger(data.get("battery_level"));

        System.out.println("[ESP PING] Device: " + deviceId + " | Battery: " + batteryLevel + "%");

        // Pole 업데이트
        Pole pole = poleService.getPoleById(deviceId)
                .orElseGet(() -> {
                    Pole newPole = new Pole();
                    newPole.setPoleId(deviceId);
                    newPole.setStatus(Pole.PoleStatus.active);
                    newPole.setBatteryLevel(batteryLevel != null ? batteryLevel : 100);
                    newPole.setIsOnline(true);
                    newPole.setCreatedAt(LocalDateTime.now());
                    newPole.setUpdatedAt(LocalDateTime.now());
                    return poleService.savePole(newPole);
                });

        pole.updatePing();
        if (batteryLevel != null) {
            pole.setBatteryLevel(batteryLevel);
        }
        poleService.savePole(pole);

        // ✅ 활성 세션의 최근 데이터 조회
        Optional<InfusionSession> activeSession = infusionSessionRepository
                .findByIvPoleIdAndStatus(deviceId, InfusionSession.SessionStatus.ACTIVE);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Ping received");
        response.put("device_id", deviceId);
        response.put("battery_level", pole.getBatteryLevel());
        response.put("is_online", true);

        // ✅ 세션이 있으면 최근 측정 데이터 포함
        if (activeSession.isPresent()) {
            InfusionSession session = activeSession.get();
            
            Map<String, Object> lastData = new HashMap<>();
            lastData.put("flow_rate", session.getMeasuredFlowRate());           // 마지막 유속
            lastData.put("remaining_volume", session.getRemainingVolume());     // 마지막 잔량
            lastData.put("deviation", session.getDeviationPercent());           // 마지막 편차
            lastData.put("last_update", session.getLastSensorUpdate());         // 마지막 업데이트 시간
            
            response.put("has_session", true);
            response.put("has_prescription", session.getPrescriptionId() != null);
            response.put("last_data", lastData);  // ✅ 서버의 최근 데이터
            
            System.out.println("[ESP PING] Last data - Flow: " + session.getMeasuredFlowRate() + 
                             " mL/min, Remaining: " + session.getRemainingVolume() + " mL");
        } else {
            response.put("has_session", false);
            response.put("has_prescription", false);
            response.put("last_data", null);
        }

        response.put("timestamp", LocalDateTime.now().toString());

        // WebSocket 브로드캐스트
        Map<String, Object> wsMessage = new HashMap<>();
        wsMessage.put("type", "battery_update");
        wsMessage.put("device_id", deviceId);
        wsMessage.put("battery_level", pole.getBatteryLevel());
        wsMessage.put("is_online", true);
        wsMessage.put("timestamp", LocalDateTime.now().toString());

        messagingTemplate.convertAndSend("/topic/poles/status", wsMessage);
        messagingTemplate.convertAndSend("/topic/patients", wsMessage);

        return response;

    } catch (Exception e) {
        System.err.println("[ESP PING] Error: " + e.getMessage());
        e.printStackTrace();
        return createResponse("error", "Failed to process ping: " + e.getMessage(), data);
    }
}


    /**
     * 구형 센서 데이터 엔드포인트 (하위 호환성)
     */
    @PostMapping("/sensor")
    public Map<String, Object> receiveSensorData(
        @RequestParam(required = false) String device_id,
        @RequestParam(required = false) String weight,
        @RequestParam(required = false) String predicted_time
    ) {
        Map<String, Object> data = new HashMap<>();
        data.put("device_id", device_id);
        data.put("weight", weight);
        data.put("predicted_time", predicted_time);

        return receiveData(data);
    }

    // ===== Helper Methods =====

    private Double parseDouble(Object value) {
        if (value == null) return null;
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Long parseLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer parseInteger(Object value) {
        if (value == null) return null;
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Map<String, Object> createResponse(String status, String message, Object data) {
        Map<String, Object> response = new HashMap<>();
        response.put("status", status);
        response.put("message", message);
        response.put("data", data);
        response.put("timestamp", LocalDateTime.now().toString());
        return response;
    }
}