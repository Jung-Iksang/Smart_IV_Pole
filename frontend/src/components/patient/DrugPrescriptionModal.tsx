import React, { useState, useEffect } from 'react';
import { X, Calculator, Pill, Clock } from 'lucide-react';
import { Patient, IVPrescription } from '../../types';
import { calculateGTT, calculateFlowRate, COMMON_DURATIONS } from '../../utils/gttCalculator';
import { useWardStore } from '../../stores/wardStore';

interface DrugPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
}

// 하드코딩된 약품 목록 (한국 병원 일반적인 IV 약품)
const AVAILABLE_DRUGS = [
  { dripId: 1, dripName: 'Normal Saline 0.9% 500mL' },
  { dripId: 2, dripName: 'Normal Saline 0.9% 1000mL' },
  { dripId: 3, dripName: '5% Dextrose 500mL' },
  { dripId: 4, dripName: '5% Dextrose 1000mL' },
  { dripId: 5, dripName: 'Hartmann Solution 500mL' },
  { dripId: 6, dripName: 'Hartmann Solution 1000mL' },
  { dripId: 7, dripName: 'Ringer Lactate 500mL' },
  { dripId: 8, dripName: 'Ringer Lactate 1000mL' },
  { dripId: 9, dripName: 'Mannitol 20% 250mL' },
  { dripId: 10, dripName: 'Albumin 5% 250mL' },
  { dripId: 11, dripName: 'Albumin 5% 500mL' },
  { dripId: 12, dripName: 'Glucose 50% 50mL' },
  { dripId: 13, dripName: 'Sodium Bicarbonate 8.4% 20mL' },
  { dripId: 14, dripName: 'Potassium Chloride 15mEq/10mL' },
  { dripId: 15, dripName: 'Calcium Gluconate 10% 10mL' }
];

const DrugPrescriptionModal: React.FC<DrugPrescriptionModalProps> = ({
  isOpen,
  onClose,
  patient
}) => {
  const { addIVPrescription } = useWardStore();

  // IV Prescription form state
  const [prescriptionForm, setPrescriptionForm] = useState({
    medicationName: '',
    totalVolume: '',
    duration: '',
    gttFactor: 20 as 20 | 60,
    prescribedBy: '',
    notes: ''
  });

  // Calculated values
  const [calculatedValues, setCalculatedValues] = useState({
    gtt: 0,
    flowRate: 0
  });

  // 프론트엔드 전용 약품 목록 로그 (백엔드 의존성 제거)
  useEffect(() => {
    if (isOpen) {
      console.log('💊 [MODAL-FRONTEND] 하드코딩된 약품 목록 사용:', AVAILABLE_DRUGS.length, '개');
    }
  }, [isOpen]);

  // Initialize form data when patient changes
  useEffect(() => {
    if (patient?.currentPrescription) {
      setPrescriptionForm({
        medicationName: patient.currentPrescription.medicationName,
        totalVolume: patient.currentPrescription.totalVolume.toString(),
        duration: patient.currentPrescription.duration.toString(),
        gttFactor: patient.currentPrescription.gttFactor,
        prescribedBy: patient.currentPrescription.prescribedBy,
        notes: patient.currentPrescription.notes || ''
      });
    }
  }, [patient]);

  // Calculate GTT and flow rate when form values change
  useEffect(() => {
    const volume = parseFloat(prescriptionForm.totalVolume) || 0;
    const duration = parseFloat(prescriptionForm.duration) || 0;

    if (volume > 0 && duration > 0) {
      const gtt = calculateGTT(volume, duration, prescriptionForm.gttFactor);
      const flowRate = calculateFlowRate(volume, duration);

      setCalculatedValues({
        gtt: Math.round(gtt * 10) / 10,
        flowRate: Math.round(flowRate * 10) / 10
      });
    } else {
      setCalculatedValues({ gtt: 0, flowRate: 0 });
    }
  }, [prescriptionForm.totalVolume, prescriptionForm.duration, prescriptionForm.gttFactor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!prescriptionForm.medicationName) {
      alert('약품을 선택해주세요.');
      return;
    }
    if (!prescriptionForm.totalVolume || !prescriptionForm.duration) {
      alert('총 용량과 투여 시간을 입력해주세요.');
      return;
    }

    // Create prescription
    const prescription: Omit<IVPrescription, 'id'> = {
      medicationName: prescriptionForm.medicationName,
      totalVolume: parseFloat(prescriptionForm.totalVolume),
      duration: parseFloat(prescriptionForm.duration),
      gttFactor: prescriptionForm.gttFactor,
      prescribedBy: prescriptionForm.prescribedBy,
      notes: prescriptionForm.notes,
      calculatedGTT: calculatedValues.gtt,
      calculatedFlowRate: calculatedValues.flowRate,
      prescribedAt: new Date(),
      startedAt: new Date() // 처방 추가 즉시 투여 시작으로 간주
    };

    // Add prescription to patient (now async with immediate UI update)
    await addIVPrescription(patient.id, prescription);

    // Close modal and reset form
    handleClose();
  };

  const resetForm = () => {
    setPrescriptionForm({
      medicationName: '',
      totalVolume: '',
      duration: '',
      gttFactor: 20,
      prescribedBy: '',
      notes: ''
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Pill className="w-6 h-6 text-green-600" />
            약품 처방 - {patient.name} ({patient.room}-{patient.bed})
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Patient Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">환자명:</span>
                <span className="ml-2 text-gray-900">{patient.name}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">침대:</span>
                <span className="ml-2 text-gray-900">{patient.room}-{patient.bed}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">나이/성별:</span>
                <span className="ml-2 text-gray-900">{patient.age}세 / {patient.gender === 'male' ? '남성' : '여성'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">담당간호사:</span>
                <span className="ml-2 text-gray-900">{patient.nurseName}</span>
              </div>
            </div>
          </div>

          {/* IV Prescription */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Pill className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">IV 처방 정보</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                약품명 *
              </label>
              <select
                value={prescriptionForm.medicationName}
                onChange={(e) => setPrescriptionForm(prev => ({ ...prev, medicationName: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">약품 선택</option>
                {AVAILABLE_DRUGS.map((drug) => (
                  <option key={drug.dripId} value={drug.dripName}>
                    {drug.dripName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  총 용량 (mL) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={prescriptionForm.totalVolume}
                  onChange={(e) => setPrescriptionForm(prev => ({ ...prev, totalVolume: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  투여 시간 (분) *
                </label>
                <select
                  value={prescriptionForm.duration}
                  onChange={(e) => setPrescriptionForm(prev => ({ ...prev, duration: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="">시간 선택</option>
                  {COMMON_DURATIONS.map((duration) => (
                    <option key={duration.value} value={duration.value}>
                      {duration.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GTT Factor
                </label>
                <select
                  value={prescriptionForm.gttFactor}
                  onChange={(e) => setPrescriptionForm(prev => ({ ...prev, gttFactor: parseInt(e.target.value) as 20 | 60 }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value={20}>20 GTT/mL (Macro drip)</option>
                  <option value={60}>60 GTT/mL (Micro drip)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  처방의사
                </label>
                <input
                  type="text"
                  value={prescriptionForm.prescribedBy}
                  onChange={(e) => setPrescriptionForm(prev => ({ ...prev, prescribedBy: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="김의사"
                />
              </div>
            </div>

            {/* GTT Calculation Results */}
            {prescriptionForm.totalVolume && prescriptionForm.duration && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-green-900">자동 계산 결과</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {calculatedValues.gtt}
                    </div>
                    <div className="text-sm text-green-700">GTT/min (분당 방울 수)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {calculatedValues.flowRate}
                    </div>
                    <div className="text-sm text-green-700">mL/분 (분당 투여 속도)</div>
                  </div>
                </div>
                <div className="border-t border-green-200 pt-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-600" />
                    <div className="text-sm">
                      <span className="font-medium text-green-900">예상 투여 종료 시간: </span>
                      <span className="text-green-700">
                        {(() => {
                          const endTime = new Date();
                          endTime.setMinutes(endTime.getMinutes() + parseInt(prescriptionForm.duration));
                          return endTime.toLocaleString('ko-KR', {
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        })()}
                      </span>
                      <span className="text-green-600 ml-2">
                        ({Math.floor(parseInt(prescriptionForm.duration) / 60)}시간 {parseInt(prescriptionForm.duration) % 60}분 후)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                특이사항
              </label>
              <textarea
                value={prescriptionForm.notes}
                onChange={(e) => setPrescriptionForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="투여 시 주의사항이나 특이사항을 입력하세요"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <Pill className="w-4 h-4" />
              처방 시작
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DrugPrescriptionModal;