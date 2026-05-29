package com.example.smartpole.dto.mobile;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Mobile 앱용 수액 투여 상태 DTO
 * 간호사 초기 설정값 + 하드웨어 실시간 데이터 통합
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InfusionStatusDTO {

    // 세션 기본 정보
    private Integer sessionId;
    private Integer patientId;
    private String poleId;

    // 처방 정보 (간호사 초기 설정)
    private String medicationName;      // 약품명
    private Integer totalVolumeMl;      // 총 용량 (mL)
    private BigDecimal gttFactor;       // GTT factor (20 또는 60)
    private BigDecimal calculatedGtt;   // 계산된 GTT (방울/분)
    private BigDecimal infusionRateMlHr; // 투여 속도 (mL/min) - 필드명은 레거시 호환성 유지

    // 투여량 추적 (수액팩 무게 보정)
    private Integer consumedVolumeMl;    // 투여된 양 (mL) - 무게 감소량 기준
    private Double initialWeightGrams;   // 초기 전체 무게 (수액+팩)
    private Double baselineWeightGrams;  // 영점 무게 (빈 폴대)

    // 하드웨어 실시간 데이터 (없으면 null)
    private Integer currentWeightGrams;  // 현재 무게 (g) - load cell 센서값
    private Integer remainingVolumeMl;   // 남은 용량 (mL) - 센서 기반 계산
    private BigDecimal currentFlowRate;  // 현재 투여 속도 (mL/min) - 실시간 측정

    // 계산된 정보
    private Double remainingPercentage;  // 잔량 퍼센트 (%)
    private Integer remainingTimeMinutes; // 남은 시간 (분)
    private LocalDateTime expectedEndTime; // 종료 예정 시간

    // 시간 정보
    private LocalDateTime startTime;     // 투여 시작 시간
    private LocalDateTime lastUpdate;    // 마지막 업데이트 시간

    // 상태 정보
    private String status;               // ACTIVE, PAUSED, ENDED
    private String dataSource;           // HARDWARE, INITIAL_SETTING
    private Boolean isHardwareConnected; // 하드웨어 연결 여부

    /**
     * 하드웨어 데이터가 있는지 확인
     */
    public boolean hasHardwareData() {
        return currentWeightGrams != null && remainingVolumeMl != null;
    }

    /**
     * 상태 색상 반환 (앱 UI용)
     */
    public String getStatusColor() {
        if (remainingPercentage == null) return "OFFLINE";
        if (remainingPercentage < 10) return "CRITICAL";
        if (remainingPercentage <= 30) return "WARNING";
        return "NORMAL";
    }
}
