package com.example.smartpole.service;

import com.example.smartpole.entity.InfusionSession;
import com.example.smartpole.entity.Pole;
import com.example.smartpole.entity.Prescription;
import com.example.smartpole.repository.PrescriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final InfusionSessionService infusionSessionService;
    private final PoleService poleService;

    public List<Prescription> getAllPrescriptions() {
        return prescriptionRepository.findAll();
    }

    public Optional<Prescription> getPrescriptionById(Integer id) {
        return prescriptionRepository.findById(id);
    }

    public List<Prescription> getPrescriptionsByPatient(Integer patientId) {
        return prescriptionRepository.findByPatientId(patientId);
    }

    public List<Prescription> getActivePrescriptionsByPatient(Integer patientId) {
        return prescriptionRepository.findActiveByPatientId(patientId);
    }

    public List<Prescription> getPendingPrescriptions() {
        return prescriptionRepository.findPendingPrescriptions();
    }

    public List<Prescription> getStartablePrescriptions(Integer patientId) {
        return prescriptionRepository.findStartablePrescriptions(patientId);
    }

    public List<Prescription> getOverduePrescriptions() {
        return prescriptionRepository.findOverduePrescriptions();
    }

    public Long countActiveByPatient(Integer patientId) {
        return prescriptionRepository.countActiveByPatientId(patientId);
    }

    public List<Prescription> getRecentPrescriptions() {
        LocalDateTime since = LocalDateTime.now().minusHours(24);
        return prescriptionRepository.findRecentPrescriptions(since);
    }

    @Transactional
    public Prescription createPrescription(Prescription prescription) {
        System.out.println("\n[PRESCRIPTION-CREATE] 처방 생성 시작 - Patient ID: " + prescription.getPatientId());

        // Validate required fields
        validatePrescription(prescription);

        // Mark existing active/prescribed prescriptions as COMPLETED for this patient
        List<Prescription> existingPrescriptions = prescriptionRepository.findByPatientId(prescription.getPatientId());
        for (Prescription existing : existingPrescriptions) {
            if (existing.getStatus() == Prescription.PrescriptionStatus.ACTIVE ||
                existing.getStatus() == Prescription.PrescriptionStatus.PRESCRIBED) {
                System.out.println("[PRESCRIPTION-CREATE] 기존 처방 완료 처리: Prescription ID " + existing.getId());
                existing.setStatus(Prescription.PrescriptionStatus.COMPLETED);
                existing.setCompletedAt(LocalDateTime.now());
                prescriptionRepository.save(existing);
            }
        }

        // Set default values for new prescription
        if (prescription.getPrescribedAt() == null) {
            prescription.setPrescribedAt(LocalDateTime.now());
        }
        if (prescription.getStatus() == null) {
            prescription.setStatus(Prescription.PrescriptionStatus.PRESCRIBED);
        }

        Prescription savedPrescription = prescriptionRepository.save(prescription);
        System.out.println("[PRESCRIPTION-CREATE] ✅ 처방 저장 완료 - Prescription ID: " + savedPrescription.getId());
        System.out.println("[PRESCRIPTION-CREATE] 📊 유속: " + savedPrescription.getInfusionRateMlHr() + " (필드명: infusionRateMlHr, 실제 단위: mL/min)");

        // ✨ AUTO-CREATE InfusionSession if patient has a pole connected
        Optional<Pole> activePole = poleService.getActivePoleByPatient(prescription.getPatientId());
        if (activePole.isPresent()) {
            String poleId = activePole.get().getPoleId();
            System.out.println("[PRESCRIPTION-CREATE] 환자에게 폴대 연결됨 - Pole ID: " + poleId);
            System.out.println("[PRESCRIPTION-CREATE] InfusionSession 자동 생성 중...");

            try {
                // End any existing active sessions for this patient
                Optional<InfusionSession> existingSession = infusionSessionService.getActiveSessionByPatient(prescription.getPatientId());
                if (existingSession.isPresent()) {
                    System.out.println("[PRESCRIPTION-CREATE] 기존 활성 세션 종료 - Session ID: " + existingSession.get().getSessionId());
                    infusionSessionService.endInfusion(existingSession.get().getSessionId());
                }

                // Create new InfusionSession
                InfusionSession session = new InfusionSession();
                session.setPatientId(prescription.getPatientId());
                session.setPrescriptionId(savedPrescription.getId());
                session.setDripId(prescription.getDrugTypeId());
                session.setIvPoleId(poleId);
                session.setTotalVolumeMl(prescription.getTotalVolumeMl());
                session.setRemainingVolume(prescription.getTotalVolumeMl());
                session.setFlowRate(new java.math.BigDecimal(prescription.getInfusionRateMlHr()));
                System.out.println("[SESSION-CREATE] 📊 InfusionSession.flowRate 설정: " + prescription.getInfusionRateMlHr() + " mL/min");

                // Calculate expected end time
                double durationHours = prescription.getDurationHours();
                LocalDateTime expectedEndTime = LocalDateTime.now().plusMinutes((long)(durationHours * 60));
                session.setEndExpTime(expectedEndTime);

                session.setStartTime(LocalDateTime.now());
                session.setStatus(InfusionSession.SessionStatus.ACTIVE);

                InfusionSession savedSession = infusionSessionService.createSession(session);
                System.out.println("[PRESCRIPTION-CREATE] ✅ InfusionSession 생성 완료 - Session ID: " + savedSession.getSessionId());
                System.out.println("[PRESCRIPTION-CREATE]    - Pole ID: " + poleId);
                System.out.println("[PRESCRIPTION-CREATE]    - Total Volume: " + savedSession.getTotalVolumeMl() + " mL");
                System.out.println("[PRESCRIPTION-CREATE]    - Flow Rate: " + savedSession.getFlowRate() + " mL/hr");
                System.out.println("[PRESCRIPTION-CREATE]    - Expected End: " + expectedEndTime);
                System.out.println("[PRESCRIPTION-CREATE] 💡 ESP8266이 이제 /api/esp/init 엔드포인트로 처방 정보를 받을 수 있습니다");

            } catch (Exception e) {
                System.err.println("[PRESCRIPTION-CREATE] ⚠️ InfusionSession 생성 실패 (처방은 저장됨): " + e.getMessage());
                e.printStackTrace();
                // Don't throw exception - prescription was saved successfully
                // Nurse can manually start infusion later
            }
        } else {
            System.out.println("[PRESCRIPTION-CREATE] ℹ️ 환자에게 연결된 폴대 없음 - InfusionSession 생성 건너뜀");
            System.out.println("[PRESCRIPTION-CREATE] 💡 간호사가 폴대를 연결하면 InfusionSession이 생성됩니다");
        }

        return savedPrescription;
    }

    @Transactional
    public Prescription updatePrescription(Integer id, Prescription updatedPrescription) {
        Prescription existing = prescriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Prescription not found with id: " + id));

        // Only allow updates if prescription hasn't started
        if (existing.getStatus() != Prescription.PrescriptionStatus.PRESCRIBED) {
            throw new RuntimeException("Cannot modify prescription that has already started");
        }

        // Update allowed fields
        existing.setTotalVolumeMl(updatedPrescription.getTotalVolumeMl());
        existing.setInfusionRateMlHr(updatedPrescription.getInfusionRateMlHr());
        existing.setGttFactor(updatedPrescription.getGttFactor());
        existing.setCalculatedGtt(updatedPrescription.getCalculatedGtt());
        existing.setDurationHours(updatedPrescription.getDurationHours());
        existing.setSpecialInstructions(updatedPrescription.getSpecialInstructions());

        return prescriptionRepository.save(existing);
    }

    @Transactional
    public Prescription startPrescription(Integer id) {
        Prescription prescription = prescriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Prescription not found with id: " + id));

        prescription.startInfusion();
        return prescriptionRepository.save(prescription);
    }

    @Transactional
    public Prescription pausePrescription(Integer id) {
        Prescription prescription = prescriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Prescription not found with id: " + id));

        prescription.pauseInfusion();
        return prescriptionRepository.save(prescription);
    }

    @Transactional
    public Prescription resumePrescription(Integer id) {
        Prescription prescription = prescriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Prescription not found with id: " + id));

        prescription.resumeInfusion();
        return prescriptionRepository.save(prescription);
    }

    @Transactional
    public Prescription completePrescription(Integer id) {
        Prescription prescription = prescriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Prescription not found with id: " + id));

        prescription.completeInfusion();
        return prescriptionRepository.save(prescription);
    }

    @Transactional
    public Prescription cancelPrescription(Integer id) {
        Prescription prescription = prescriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Prescription not found with id: " + id));

        prescription.setStatus(Prescription.PrescriptionStatus.CANCELLED);
        prescription.setCompletedAt(LocalDateTime.now());
        return prescriptionRepository.save(prescription);
    }

    @Transactional
    public void deletePrescription(Integer id) {
        Prescription prescription = prescriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Prescription not found with id: " + id));

        // Only allow deletion if prescription hasn't started
        if (prescription.getStatus() != Prescription.PrescriptionStatus.PRESCRIBED) {
            throw new RuntimeException("Cannot delete prescription that has already started. Use cancel instead.");
        }

        prescriptionRepository.delete(prescription);
    }

    private void validatePrescription(Prescription prescription) {
        if (prescription.getPatientId() == null) {
            throw new RuntimeException("Patient ID is required");
        }
        if (prescription.getDrugTypeId() == null) {
            throw new RuntimeException("Drug Type ID is required");
        }
        if (prescription.getTotalVolumeMl() == null || prescription.getTotalVolumeMl() <= 0) {
            throw new RuntimeException("Total volume must be greater than 0");
        }
        if (prescription.getInfusionRateMlHr() == null || prescription.getInfusionRateMlHr() <= 0) {
            throw new RuntimeException("Infusion rate must be greater than 0");
        }
        if (prescription.getGttFactor() == null || (prescription.getGttFactor() != 20 && prescription.getGttFactor() != 60)) {
            throw new RuntimeException("GTT factor must be 20 (macro) or 60 (micro)");
        }
        if (prescription.getDurationHours() == null || prescription.getDurationHours() <= 0) {
            throw new RuntimeException("Duration must be greater than 0");
        }
        if (prescription.getPrescribedBy() == null || prescription.getPrescribedBy().trim().isEmpty()) {
            throw new RuntimeException("Prescriber name is required");
        }
    }
}