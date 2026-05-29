package com.example.smartpole.controller.mobile;

import com.example.smartpole.dto.ApiResponse;
import com.example.smartpole.dto.mobile.InfusionStatusDTO;
import com.example.smartpole.entity.*;
import com.example.smartpole.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/mobile/patients")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:5173"})
public class MobileInfusionController {

    private final PatientRepository patientRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final InfusionSessionRepository infusionSessionRepository;
    private final DrugTypeRepository drugTypeRepository;

    /**
     * 환자의 현재 수액 투여 상태 조회 (Mobile 앱용)
     * GET /api/v1/mobile/patients/{patientId}/current-infusion
     *
     * 하드웨어 데이터가 있으면 실시간 값 반환, 없으면 초기 설정값 반환
     */
    @GetMapping("/{patientId}/current-infusion")
    public ApiResponse<InfusionStatusDTO> getCurrentInfusion(@PathVariable Integer patientId) {
        try {
            // 1. 환자 확인
            Patient patient = patientRepository.findById(patientId)
                    .orElseThrow(() -> new RuntimeException("Patient not found with id: " + patientId));

            // 2. 활성 수액 세션 조회
            Optional<InfusionSession> activeSessionOpt = infusionSessionRepository
                    .findByPatientIdAndStatus(patientId, InfusionSession.SessionStatus.ACTIVE);

            if (activeSessionOpt.isEmpty()) {
                // 활성 세션 없음 → 처방만 확인
                return getCurrentPrescriptionOnly(patientId);
            }

            InfusionSession session = activeSessionOpt.get();

            // 3. 처방 정보 조회
            Prescription prescription = prescriptionRepository.findById(session.getPrescriptionId())
                    .orElseThrow(() -> new RuntimeException("Prescription not found"));

            // 4. 약품 정보 조회
            DrugType drugType = drugTypeRepository.findById(session.getDripId())
                    .orElseThrow(() -> new RuntimeException("Drug type not found"));

            // 5. DTO 생성
            InfusionStatusDTO dto = buildInfusionStatusDTO(session, prescription, drugType);

            return ApiResponse.success(dto);
        } catch (Exception e) {
            return ApiResponse.error("수액 정보 조회 실패: " + e.getMessage());
        }
    }

    /**
     * 환자의 현재 처방 정보만 조회 (수액 세션 없을 때)
     * GET /api/v1/mobile/patients/{patientId}/prescription
     */
    @GetMapping("/{patientId}/prescription")
    public ApiResponse<InfusionStatusDTO> getCurrentPrescriptionOnly(@PathVariable Integer patientId) {
        try {
            // 최신 처방 조회
            Optional<Prescription> prescriptionOpt = prescriptionRepository
                    .findLatestByPatientId(patientId);

            if (prescriptionOpt.isEmpty()) {
                return ApiResponse.error("처방 정보가 없습니다");
            }

            Prescription prescription = prescriptionOpt.get();

            // 약품 정보 조회
            DrugType drugType = drugTypeRepository.findById(prescription.getDrugTypeId())
                    .orElseThrow(() -> new RuntimeException("Drug type not found"));

            // DTO 생성 (수액 세션 없이 처방 정보만)
            InfusionStatusDTO dto = InfusionStatusDTO.builder()
                    .sessionId(null)
                    .patientId(patientId)
                    .poleId(null)
                    .medicationName(drugType.getDripName())
                    .totalVolumeMl(prescription.getTotalVolumeMl())
                    .gttFactor(BigDecimal.valueOf(prescription.getGttFactor()))
                    .calculatedGtt(BigDecimal.valueOf(prescription.getCalculatedGtt()))
                    .infusionRateMlHr(BigDecimal.valueOf(prescription.getInfusionRateMlHr()))
                    // 하드웨어 데이터 없음
                    .currentWeightGrams(null)
                    .remainingVolumeMl(prescription.getTotalVolumeMl()) // 초기값
                    .currentFlowRate(null)
                    // 계산된 정보
                    .remainingPercentage(100.0)
                    .remainingTimeMinutes((int) (prescription.getDurationHours() * 60))
                    .expectedEndTime(null)
                    // 시간 정보
                    .startTime(null)
                    .lastUpdate(LocalDateTime.now())
                    // 상태
                    .status("PRESCRIBED")
                    .dataSource("INITIAL_SETTING")
                    .isHardwareConnected(false)
                    .build();

            return ApiResponse.success(dto);
        } catch (Exception e) {
            return ApiResponse.error("처방 정보 조회 실패: " + e.getMessage());
        }
    }

    /**
     * InfusionSession → InfusionStatusDTO 변환
     * 하드웨어 데이터 우선순위 로직 적용
     */
    private InfusionStatusDTO buildInfusionStatusDTO(
            InfusionSession session,
            Prescription prescription,
            DrugType drugType
    ) {
        // 하드웨어 데이터 확인 (consumedVolume이 있으면 하드웨어가 업데이트한 것)
        boolean hasHardwareData = session.getConsumedVolumeMl() != null && session.getConsumedVolumeMl() > 0;

        // 퍼센트 계산 (투여량 기준으로 변경 - 수액팩 무게 보정)
        double consumedPercentage = 0;
        double remainingPercentage = 100.0;

        if (hasHardwareData) {
            // 하드웨어 데이터 있을 때: 투여량 기준 (무게 감소량)
            consumedPercentage = (session.getConsumedVolumeMl().doubleValue() / session.getTotalVolumeMl()) * 100.0;
            remainingPercentage = 100.0 - Math.min(100.0, consumedPercentage);
        } else {
            // 하드웨어 없을 때: 시간 기반 계산
            long elapsedMinutes = java.time.Duration.between(session.getStartTime(), LocalDateTime.now()).toMinutes();
            double totalDurationMin = session.getTotalVolumeMl() / session.getFlowRate().doubleValue();
            consumedPercentage = (elapsedMinutes / totalDurationMin) * 100.0;
            remainingPercentage = 100.0 - Math.min(100.0, consumedPercentage);
        }

        // 남은 시간 계산 (현재 투여 속도 기준)
        // FlowRate는 mL/min 단위이므로 분으로 바로 계산
        int remainingTimeMinutes = 0;
        if (session.getFlowRate().compareTo(BigDecimal.ZERO) > 0) {
            double remainingMin = session.getRemainingVolume().doubleValue() / session.getFlowRate().doubleValue();
            remainingTimeMinutes = (int) remainingMin;
        }

        // 종료 예정 시간 계산
        LocalDateTime expectedEndTime = session.getStartTime().plusMinutes(remainingTimeMinutes);

        return InfusionStatusDTO.builder()
                .sessionId(session.getSessionId())
                .patientId(session.getPatientId())
                .poleId(session.getIvPoleId())
                // 처방 정보
                .medicationName(drugType.getDripName())
                .totalVolumeMl(session.getTotalVolumeMl())
                .gttFactor(BigDecimal.valueOf(prescription.getGttFactor()))
                .calculatedGtt(BigDecimal.valueOf(prescription.getCalculatedGtt()))
                .infusionRateMlHr(BigDecimal.valueOf(prescription.getInfusionRateMlHr()))
                // 투여량 추적 (수액팩 무게 보정)
                .consumedVolumeMl(session.getConsumedVolumeMl())
                .initialWeightGrams(session.getInitialWeightGrams())
                .baselineWeightGrams(session.getBaselineWeightGrams())
                // 하드웨어 데이터 (있으면)
                .currentWeightGrams(hasHardwareData ? session.getRealTimeWeight() != null ? session.getRealTimeWeight().intValue() : null : null)
                .remainingVolumeMl(session.getRemainingVolume())
                .currentFlowRate(session.getFlowRate())
                // 계산된 정보
                .remainingPercentage(remainingPercentage)
                .remainingTimeMinutes(remainingTimeMinutes)
                .expectedEndTime(expectedEndTime)
                // 시간 정보
                .startTime(session.getStartTime())
                .lastUpdate(LocalDateTime.now())
                // 상태
                .status(session.getStatus().name())
                .dataSource(hasHardwareData ? "HARDWARE" : "INITIAL_SETTING")
                .isHardwareConnected(hasHardwareData)
                .build();
    }
}
