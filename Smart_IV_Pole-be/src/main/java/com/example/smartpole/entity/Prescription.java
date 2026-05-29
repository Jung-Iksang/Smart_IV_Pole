package com.example.smartpole.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "prescriptions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Prescription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "patient_id", nullable = false)
    private Integer patientId;

    @Column(name = "drug_type_id", nullable = false)
    private Integer drugTypeId;

    @Column(name = "total_volume_ml", nullable = false)
    private Integer totalVolumeMl;

    @Column(name = "infusion_rate_ml_hr", nullable = false)
    private Double infusionRateMlHr; // mL/min 단위로 저장 (Double로 소수점 유지)

    @Column(name = "gtt_factor", nullable = false)
    private Integer gttFactor; // 20 for macro, 60 for micro

    @Column(name = "calculated_gtt", nullable = false)
    private Integer calculatedGtt;

    @Column(name = "duration_hours", nullable = false)
    private Double durationHours;

    @Column(name = "special_instructions", length = 500)
    private String specialInstructions;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PrescriptionStatus status = PrescriptionStatus.PRESCRIBED;

    @Column(name = "prescribed_at", nullable = false)
    private LocalDateTime prescribedAt;

    @Column(name = "prescribed_by", nullable = false, length = 100)
    private String prescribedBy; // nurse name or ID

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    // Relationships
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", insertable = false, updatable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "drug_type_id", insertable = false, updatable = false)
    private DrugType drugType;

    public enum PrescriptionStatus {
        PRESCRIBED,    // 처방됨 - nurse entered prescription
        ACTIVE,        // 활성 - connected to pole and infusion started
        PAUSED,        // 일시정지 - temporarily stopped
        COMPLETED,     // 완료 - infusion finished normally
        CANCELLED      // 취소 - prescription cancelled
    }

    @PrePersist
    protected void onCreate() {
        if (prescribedAt == null) {
            prescribedAt = LocalDateTime.now();
        }
        if (status == null) {
            status = PrescriptionStatus.PRESCRIBED;
        }
    }

    // Helper methods for business logic
    public boolean canBeStarted() {
        return status == PrescriptionStatus.PRESCRIBED;
    }

    public boolean isActive() {
        return status == PrescriptionStatus.ACTIVE;
    }

    public boolean isCompleted() {
        return status == PrescriptionStatus.COMPLETED || status == PrescriptionStatus.CANCELLED;
    }

    public void startInfusion() {
        if (canBeStarted()) {
            this.status = PrescriptionStatus.ACTIVE;
            this.startedAt = LocalDateTime.now();
        } else {
            throw new IllegalStateException("Cannot start prescription with status: " + status);
        }
    }

    public void completeInfusion() {
        if (isActive() || status == PrescriptionStatus.PAUSED) {
            this.status = PrescriptionStatus.COMPLETED;
            this.completedAt = LocalDateTime.now();
        } else {
            throw new IllegalStateException("Cannot complete prescription with status: " + status);
        }
    }

    public void pauseInfusion() {
        if (isActive()) {
            this.status = PrescriptionStatus.PAUSED;
        } else {
            throw new IllegalStateException("Cannot pause prescription with status: " + status);
        }
    }

    public void resumeInfusion() {
        if (status == PrescriptionStatus.PAUSED) {
            this.status = PrescriptionStatus.ACTIVE;
        } else {
            throw new IllegalStateException("Cannot resume prescription with status: " + status);
        }
    }
}