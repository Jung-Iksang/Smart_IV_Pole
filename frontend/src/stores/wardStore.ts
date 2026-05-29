import { create } from 'zustand';
import { Patient, PoleData, Alert, BedInfo, WardStats, StatusColor, IVPrescription } from '../types';
import { createIVPrescription } from '../utils/gttCalculator';
import { patientAPI, prescriptionAPI, ivSessionAPI, checkServerConnection, PatientDB, PrescriptionDB, IVSessionDB, dripAPI, initializeDefaultDrugs } from '../services/api';
import storageService from '../services/storageService';

interface WardStore {
  // State
  beds: BedInfo[];
  alerts: Alert[];
  patients: Patient[];
  poleData: Map<string, PoleData>;
  wardStats: WardStats;
  selectedPatientId: string | null;
  isLoading: boolean;
  error: string | null;
  isServerConnected: boolean;
  patientBedMapping: Map<string, string>; // patientId -> bedNumber mapping
  prescriptionCallbacks: Map<string, () => void>; // 🔄 NEW: 처방 정보 변경 콜백

  // Actions
  updatePoleData: (poleId: string, data: Partial<PoleData>) => void;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (alertId: string, nurseId: string) => void;
  removeAlert: (alertId: string) => void;
  setSelectedPatient: (patientId: string | null) => void;
  updateWardStats: () => void;
  loadStoredData: () => boolean;
  saveToStorage: () => void;
  
  // Patient Management (with API integration)
  fetchPatients: () => Promise<void>;
  addPatient: (patient: Omit<Patient, 'id'>, bedNumber: string, prescription?: Omit<IVPrescription, 'id'>) => Promise<void>;
  updatePatient: (patientId: string, updates: Partial<Patient>) => Promise<void>;
  removePatient: (patientId: string) => Promise<void>;
  deletePatient: (patientId: string) => Promise<void>;
  endIVSession: (patientId: string) => Promise<void>;
  addIVPrescription: (patientId: string, prescription: Omit<IVPrescription, 'id'>) => Promise<void>;
  updateIVPrescription: (patientId: string, prescription: Partial<IVPrescription>) => void;
  
  // Getters
  getBedStatus: (bedNumber: string) => StatusColor;
  getActiveAlerts: () => Alert[];
  getCriticalAlerts: () => Alert[];
  getPatientById: (patientId: string) => Patient | undefined;
  getBedByNumber: (bedNumber: string) => BedInfo | undefined;
  
  // Server connection
  checkConnection: () => Promise<void>;

  // Alert Management with Backend API
  fetchAlerts: () => Promise<void>;
  acknowledgeAlertBackend: (alertId: string, nurseId: string) => Promise<void>;

  // 🔄 NEW: Real-time sync callbacks
  registerPrescriptionCallback: (patientId: string, callback: () => void) => void;
  unregisterPrescriptionCallback: (patientId: string) => void;
  triggerPrescriptionCallbacks: (patientId: string) => void;
  forcePrescriptionSync: (patientId: string) => Promise<void>;

  // 🔄 NEW: Navigation-safe methods
  validatePrescriptionData: (patientId: string) => boolean;
  autoRecoverPrescription: (patientId: string) => Promise<boolean>;
  ensurePrescriptionConsistency: (patientId: string) => Promise<void>;
  getPrescriptionStatus: (patientId: string) => 'loading' | 'available' | 'missing' | 'error';

  // 🔌 NEW: Pole connection management
  connectPoleToPatient: (patientId: string, poleId: string) => Promise<void>;
  disconnectPoleFromPatient: (patientId: string) => Promise<void>;
}

// Helper function to determine status color based on ALERT STATE (not percentage)
// 🔥 FIX: Only show red/yellow when there's an ACTIVE ALERT from ESP8266
// Normal 30-second data updates should NOT change color
const getStatusColor = (poleData?: PoleData): StatusColor => {
  if (!poleData || poleData.status === 'offline') return 'offline';

  // ✅ PRIORITY 1: Check for active alert (from ESP8266 /api/esp/alert)
  if (poleData.hasActiveAlert) {
    // Use alert severity to determine color
    return poleData.alertSeverity === 'critical' ? 'critical' : 'warning';
  }

  // ✅ PRIORITY 2: Check hardware status
  if (poleData.status === 'error') return 'critical';

  // ✅ DEFAULT: No active alert = normal (ignore percentage thresholds)
  return 'normal';
};

// Helper function to convert DB prescription to frontend IVPrescription type
const convertDBPrescriptionToFrontend = (dbPrescription: PrescriptionDB, drugName: string): IVPrescription => {
  return {
    id: `RX${dbPrescription.id}`,
    medicationName: drugName,
    totalVolume: dbPrescription.totalVolumeMl,
    duration: dbPrescription.durationHours * 60, // Convert hours to minutes
    gttFactor: dbPrescription.gttFactor as 20 | 60,
    calculatedGTT: dbPrescription.calculatedGtt,
    calculatedFlowRate: dbPrescription.infusionRateMlHr,
    prescribedBy: dbPrescription.prescribedBy,
    prescribedAt: new Date(dbPrescription.prescribedAt || Date.now()),
    startedAt: dbPrescription.startedAt ? new Date(dbPrescription.startedAt) : undefined, // 투여 시작 시간
    notes: dbPrescription.specialInstructions || undefined,
  };
};

// Helper function to convert DB patient to frontend Patient type
// 매핑 테이블을 사용하여 올바른 침대 할당
const convertDBPatientToFrontend = (
  dbPatient: PatientDB,
  existingPatient?: Patient,
  patientBedMapping?: Map<string, string>,
  currentPrescription?: IVPrescription,
  prescriptionHistory?: IVPrescription[]
): Patient => {
  const patientId = `P${dbPatient.patientId}`;

  // 🔄 NEW: DB에서 침대 정보를 직접 사용 (매핑 시스템보다 우선)
  // 1. DB에서 침대 정보 사용 (최우선)
  // 2. 없으면 매핑 테이블에서 침대 정보 찾기
  // 3. 없으면 기존 환자 정보 사용
  // 4. 모두 없으면 기본값 사용
  let room = '301A';
  let bed = '1';

  if (dbPatient.roomId && dbPatient.bedNumber) {
    // DB에 침대 정보가 있으면 우선 사용
    room = dbPatient.roomId;
    bed = dbPatient.bedNumber;
    console.log(`🏥 Using DB bed info for ${dbPatient.name}: ${room}-${bed}`);
  } else if (patientBedMapping?.has(patientId)) {
    // DB에 없으면 매핑 테이블 사용
    const bedNumber = patientBedMapping.get(patientId)!;
    const [roomPart, bedPart] = bedNumber.split('-');
    room = roomPart;
    bed = bedPart;
    console.log(`🗺️ Using bed mapping for ${dbPatient.name}: ${patientId} → ${bedNumber}`);
  } else if (existingPatient) {
    // 매핑도 없으면 기존 환자 정보 사용
    room = existingPatient.room;
    bed = existingPatient.bed;
    console.log(`👤 Using existing patient data for ${dbPatient.name}: ${room}-${bed}`);
  } else {
    // 모든 정보가 없으면 기본값
    console.log(`🏥 Using default bed for ${dbPatient.name}: ${room}-${bed}`);
  }

  const nurseId = existingPatient?.nurseId || 'N001';
  const nurseName = existingPatient?.nurseName || '김수연';

  // 🔄 Enhanced data preservation logic for prescriptions
  // Priority: currentPrescription (DB) > existing local prescription > undefined
  // If DB doesn't have prescription but local state does, preserve local state
  let finalCurrentPrescription = currentPrescription;
  let finalPrescriptionHistory = prescriptionHistory || [];

  if (!currentPrescription && existingPatient?.currentPrescription) {
    console.log(`💾 [DATA-PRESERVE] Preserving local prescription for ${dbPatient.name}: ${existingPatient.currentPrescription.medicationName}`);
    finalCurrentPrescription = existingPatient.currentPrescription;
  }

  if (prescriptionHistory && prescriptionHistory.length === 0 && existingPatient?.prescriptionHistory && existingPatient.prescriptionHistory.length > 0) {
    console.log(`💾 [DATA-PRESERVE] Preserving local prescription history for ${dbPatient.name}: ${existingPatient.prescriptionHistory.length} items`);
    finalPrescriptionHistory = existingPatient.prescriptionHistory;
  }

  return {
    id: patientId,
    name: dbPatient.name,
    room: room,
    bed: bed,
    nurseId: nurseId,
    nurseName: nurseName,
    admissionDate: new Date(dbPatient.createdAt || Date.now()),
    age: dbPatient.birthDate ? new Date().getFullYear() - new Date(dbPatient.birthDate).getFullYear() : 0,
    gender: dbPatient.gender,
    weight: dbPatient.weightKg,
    height: dbPatient.heightCm,
    allergies: existingPatient?.allergies || undefined,
    medicalHistory: existingPatient?.medicalHistory || [],
    currentPrescription: finalCurrentPrescription,
    prescriptionHistory: finalPrescriptionHistory,
    phone: dbPatient.phone
  };
};

// Helper function to convert frontend Patient to DB PatientDB type
const convertFrontendPatientToDB = (patient: Omit<Patient, 'id'>, bedNumber: string, phone?: string, pinCode?: string): Omit<PatientDB, 'patientId' | 'createdAt'> => {
  // 생년월일 계산 (나이에서 추정)
  const currentYear = new Date().getFullYear();
  const birthYear = patient.age ? currentYear - patient.age : currentYear - 30; // 기본값 30세
  const birthDate = `${birthYear}-01-01`; // 간단하게 1월 1일로 설정

  // 침대 번호에서 방 번호와 침대 번호 분리 (예: "301A-2" → roomId: "301A", bedNumber: "2")
  const [roomId, bedNum] = bedNumber.split('-');

  return {
    name: patient.name,
    phone: phone || '010-0000-0000', // 필수 필드 - 기본값 제공
    pinCode: pinCode, // 모바일 앱 로그인용 PIN (6자리)
    birthDate: birthDate,
    gender: patient.gender,
    weightKg: patient.weight ? Math.round(patient.weight) : undefined, // 정수로 변환
    heightCm: patient.height ? Math.round(patient.height) : undefined, // 정수로 변환
    address: undefined, // 주소는 추후 추가 가능
    roomId: roomId, // DB에 침대 정보 저장
    bedNumber: bedNum // DB에 침대 번호 저장
  };
};

export const useWardStore = create<WardStore>((set, get) => ({
  // Initial State
  beds: [],
  alerts: [],
  patients: [],
  poleData: new Map(),
  wardStats: { total: 0, normal: 0, warning: 0, critical: 0, offline: 0 },
  selectedPatientId: null,
  isLoading: false,
  error: null,
  isServerConnected: false,
  patientBedMapping: new Map(),
  prescriptionCallbacks: new Map(), // 🔄 NEW: 콜백 시스템 초기화

  // Actions
  updatePoleData: (poleId: string, data: Partial<PoleData>) => {
    set((state) => {
      const newPoleData = new Map(state.poleData);
      const existing = newPoleData.get(poleId);

      if (existing) {
        newPoleData.set(poleId, { ...existing, ...data, lastUpdate: new Date() });
      } else {
        // 🔄 DYNAMIC CAPACITY: Get from patient's prescription instead of hardcoded 500
        const patient = state.patients.find(p => p.id === data.patientId);
        const prescriptionVolume = patient?.currentPrescription?.totalVolume || 500;

        console.log(`💊 [CAPACITY] Pole ${poleId} capacity from prescription: ${prescriptionVolume}mL (Patient: ${data.patientId})`);

        // Create new pole data with defaults
        newPoleData.set(poleId, {
          poleId,
          weight: 0,
          capacity: prescriptionVolume,  // ✅ Use prescription volume instead of hardcoded 500
          currentVolume: 0,
          percentage: 0,
          battery: 100,
          status: 'offline',
          flowRate: 0,
          prescribedRate: 100,
          estimatedTime: 0,
          lastUpdate: new Date(),
          isButtonPressed: false,
          ...data,
        } as PoleData);
      }

      // Update beds with new pole data
      // Find bed by poleId OR by patientId (from WebSocket data)
      const updatedBeds = state.beds.map(bed => {
        // Match by existing poleData.poleId
        if (bed.poleData?.poleId === poleId) {
          return {
            ...bed,
            poleData: newPoleData.get(poleId)
          };
        }

        // NEW: Match by patientId if poleData not set yet
        // This handles initial WebSocket connection
        const patientIdMatch = data.patientId && bed.patient?.id === data.patientId;
        if (patientIdMatch && !bed.poleData) {
          console.log(`🔗 Linking pole ${poleId} to bed ${bed.bedNumber} (Patient ID: ${data.patientId})`);
          return {
            ...bed,
            poleData: newPoleData.get(poleId)
          };
        }

        return bed;
      });

      return {
        poleData: newPoleData,
        beds: updatedBeds
      };
    });
    
    // Update ward stats after pole data change
    get().updateWardStats();
    
    // Save to localStorage
    get().saveToStorage();
  },

  addAlert: (alert: Alert) => {
    set((state) => {
      // 중복 체크: 같은 ID의 alert가 이미 있으면 추가하지 않음
      const exists = state.alerts.some(existingAlert => existingAlert.id === alert.id);
      if (exists) {
        console.warn(`⚠️ Alert ${alert.id} already exists, skipping duplicate`);
        return state;
      }

      return {
        alerts: [alert, ...state.alerts]
      };
    });
    get().saveToStorage();
  },

  acknowledgeAlert: (alertId: string, nurseId: string) => {
    set((state) => {
      // Find the alert being acknowledged to get its poleId
      const acknowledgedAlert = state.alerts.find(alert => alert.id === alertId);

      // ✅ FIX: Clear hasActiveAlert flag when nurse acknowledges alert
      if (acknowledgedAlert?.poleId) {
        const newPoleData = new Map(state.poleData);
        const poleData = newPoleData.get(acknowledgedAlert.poleId);

        if (poleData) {
          newPoleData.set(acknowledgedAlert.poleId, {
            ...poleData,
            hasActiveAlert: false,
            alertSeverity: undefined,
            status: 'online', // Restore to online status
          });

          console.log(`✅ [ALERT-CLEAR] Pole ${acknowledgedAlert.poleId} alert acknowledged, clearing hasActiveAlert flag`);
        }

        return {
          alerts: state.alerts.map(alert =>
            alert.id === alertId
              ? {
                  ...alert,
                  acknowledged: true,
                  acknowledgedBy: nurseId,
                  acknowledgedAt: new Date()
                }
              : alert
          ),
          poleData: newPoleData,
        };
      }

      // No poleId found, just update alert
      return {
        alerts: state.alerts.map(alert =>
          alert.id === alertId
            ? {
                ...alert,
                acknowledged: true,
                acknowledgedBy: nurseId,
                acknowledgedAt: new Date()
              }
            : alert
        )
      };
    });
    get().saveToStorage();
  },

  removeAlert: (alertId: string) => {
    set((state) => ({
      alerts: state.alerts.filter(alert => alert.id !== alertId)
    }));
    get().saveToStorage();
  },

  setSelectedPatient: (patientId: string | null) => {
    set({ selectedPatientId: patientId });
  },

  updateWardStats: () => {
    const { beds } = get();
    const stats = beds.reduce(
      (acc, bed) => {
        acc.total++;
        const status = getStatusColor(bed.poleData);
        acc[status]++;
        return acc;
      },
      { total: 0, normal: 0, warning: 0, critical: 0, offline: 0 }
    );
    
    set({ wardStats: stats });
  },

  getBedStatus: (bedNumber: string) => {
    const { beds } = get();
    const bed = beds.find(b => b.bedNumber === bedNumber);
    return getStatusColor(bed?.poleData);
  },

  getActiveAlerts: () => {
    const { alerts } = get();
    return alerts.filter(alert => !alert.acknowledged);
  },

  getCriticalAlerts: () => {
    const { alerts } = get();
    return alerts.filter(alert => !alert.acknowledged && alert.severity === 'critical');
  },

  getPatientById: (patientId: string) => {
    const { patients } = get();
    return patients.find(patient => patient.id === patientId);
  },

  getBedByNumber: (bedNumber: string) => {
    const { beds } = get();
    return beds.find(bed => bed.bedNumber === bedNumber);
  },

  // Server connection check
  checkConnection: async () => {
    const isConnected = await checkServerConnection();
    set({ isServerConnected: isConnected });

    if (isConnected) {
      // 💊 서버 연결 성공 시 기본 약품 목록 초기화 (DB가 비어있을 경우)
      await initializeDefaultDrugs();

      // 서버 연결 성공 시 백엔드 데이터 로드
      await get().fetchPatients();
    } else {
      // 서버 연결 실패 시 빈 상태로 초기화
      console.warn('⚠️ 서버 연결 실패 - 빈 상태로 초기화');
      set({
        patients: [],
        beds: [
          { bedNumber: '301A-1', room: '301A', status: 'empty' },
          { bedNumber: '301A-2', room: '301A', status: 'empty' },
          { bedNumber: '301A-3', room: '301A', status: 'empty' },
          { bedNumber: '301A-4', room: '301A', status: 'empty' },
          { bedNumber: '301A-5', room: '301A', status: 'empty' },
          { bedNumber: '301A-6', room: '301A', status: 'empty' }
        ],
        alerts: [],
        poleData: new Map(),
        patientBedMapping: new Map()
      });
    }
  },

  // Fetch patients from server
  fetchPatients: async () => {
    const startTime = Date.now();
    console.log('🚀 [TIMING] fetchPatients 시작 -', new Date().toISOString());

    set({ isLoading: true, error: null });

    try {
      console.log('🔄 [TIMING] 환자 API 호출 시작');
      const response = await patientAPI.getPatients();
      console.log('✅ [TIMING] 환자 API 응답 완료 -', Date.now() - startTime, 'ms');

      if (response.success && response.data) {
        // response.data가 배열인지 확인
        const patientsArray = Array.isArray(response.data) ? response.data : [response.data];
        console.log('📊 [TIMING] 환자 데이터 가공 시작 - 환자 수:', patientsArray.length);

        // Load drug types for prescription mapping (with localStorage caching)
        console.log('💊 [TIMING] 약품 타입 로딩 시작');
        let drugs: any[] = [];

        // Try to load from localStorage first
        const cachedDrugs = storageService.loadDrugTypes();
        if (cachedDrugs && cachedDrugs.length > 0) {
          console.log('💊 [CACHE] localStorage에서 약품 타입 로드:', cachedDrugs.length, '개');
          drugs = cachedDrugs;
        } else {
          // Fallback to API call
          console.log('💊 [API] 백엔드에서 약품 타입 로드');
          const drugsResponse = await dripAPI.getDrips();
          drugs = drugsResponse.success ? drugsResponse.data || [] : [];

          // Save to localStorage for next time
          if (drugs.length > 0) {
            storageService.saveDrugTypes(drugs);
          }
        }

        const drugMap = new Map(drugs.map(drug => [drug.dripId, drug.dripName]));
        console.log('✅ [TIMING] 약품 타입 로딩 완료 -', Date.now() - startTime, 'ms');

        // 💊 Load localStorage prescription data for overlay
        console.log('💊 [TIMING] localStorage 처방 데이터 로딩 시작');
        const storedPrescriptions = storageService.loadPrescriptions();
        console.log('💊 [CACHE] localStorage 처방 데이터:', storedPrescriptions?.size || 0, '개');

        // Load prescriptions and combine with patient data
        const existingPatients = get().patients;
        console.log('🔄 [TIMING] 처방 정보 로딩 시작');
        const patients: Patient[] = await Promise.all(patientsArray.map(async (dbPatient) => {
          const patientStartTime = Date.now();
          // 기존 환자 찾기 (ID로 매칭)
          const existingPatient = existingPatients.find(p => p.id === `P${dbPatient.patientId}`);

          // Load ALL prescriptions for this patient (현재 + 이력)
          let currentPrescription: IVPrescription | undefined;
          let prescriptionHistory: IVPrescription[] = [];

          try {
            const prescriptionsResponse = await prescriptionAPI.getPatientPrescriptions(dbPatient.patientId!);
            if (prescriptionsResponse.success && prescriptionsResponse.data && prescriptionsResponse.data.length > 0) {
              // 모든 처방을 상태별로 분류
              const allPrescriptions = prescriptionsResponse.data;

              // ACTIVE/PRESCRIBED 상태 = 현재 처방 (가장 최근 것)
              const activePrescriptions = allPrescriptions.filter(p =>
                p.status === 'ACTIVE' || p.status === 'PRESCRIBED'
              );

              // COMPLETED/CANCELLED 상태 = 이력
              const historyPrescriptions = allPrescriptions.filter(p =>
                p.status === 'COMPLETED' || p.status === 'CANCELLED'
              );

              // 현재 처방 설정 (가장 최근 ACTIVE/PRESCRIBED)
              if (activePrescriptions.length > 0) {
                const dbPrescription = activePrescriptions[0];
                const drugName = drugMap.get(dbPrescription.drugTypeId) || 'Unknown Drug';
                currentPrescription = convertDBPrescriptionToFrontend(dbPrescription, drugName);
                console.log(`💊 [TIMING] ${dbPatient.name} 현재 처방: ${drugName} (상태: ${dbPrescription.status})`);
              }

              // 처방 이력 변환
              prescriptionHistory = historyPrescriptions.map(dbPrescription => {
                const drugName = drugMap.get(dbPrescription.drugTypeId) || 'Unknown Drug';
                return convertDBPrescriptionToFrontend(dbPrescription, drugName);
              });

              console.log(`📋 [TIMING] ${dbPatient.name} - 현재: ${currentPrescription ? '1개' : '없음'}, 이력: ${prescriptionHistory.length}개`);
            } else {
              console.log(`ℹ️ [TIMING] ${dbPatient.name} 처방 없음 (${Date.now() - patientStartTime}ms)`);
            }
          } catch (error) {
            console.warn(`❌ [TIMING] ${dbPatient.name} 처방 로딩 실패 (${Date.now() - patientStartTime}ms):`, error);
          }

          // 💊 localStorage 처방 데이터 오버레이 (데이터베이스 처방보다 우선)
          // 🔥 CRITICAL: localStorage가 항상 우선 (DB가 비어있어도 localStorage 유지)
          const patientId = `P${dbPatient.patientId}`;
          if (storedPrescriptions?.has(patientId)) {
            const storedPrescription = storedPrescriptions.get(patientId);
            if (storedPrescription) {
              console.log(`💊 [OVERLAY] ${dbPatient.name}에게 localStorage 처방 적용 (DB 덮어쓰기): ${storedPrescription.medicationName}`);
              currentPrescription = storedPrescription; // localStorage가 무조건 우선

              // 처방 이력도 localStorage 우선 (DB보다 최신일 수 있음)
              if (prescriptionHistory.length === 0) {
                console.log(`💊 [OVERLAY] ${dbPatient.name} DB 이력 없음, localStorage 처방만 사용`);
              }
            }
          } else if (!currentPrescription) {
            // localStorage도 없고 DB도 없으면 로그만 남김
            console.log(`ℹ️ [NO-PRESCRIPTION] ${dbPatient.name} 처방 정보 없음 (DB, localStorage 모두 비어있음)`);
          }

          const finalPatient = convertDBPatientToFrontend(
            dbPatient,
            existingPatient,
            get().patientBedMapping,
            currentPrescription,
            prescriptionHistory
          );
          console.log(`👤 [TIMING] ${dbPatient.name} 변환 완료 - 현재처방: ${finalPatient.currentPrescription ? '있음' : '없음'}, 이력: ${finalPatient.prescriptionHistory.length}개`);
          return finalPatient;
        }));

        console.log('✅ [TIMING] 모든 환자 처방 로딩 완료 -', Date.now() - startTime, 'ms');

        // 🔄 Critical Fix: Assign patients to beds for ward display
        console.log('🔄 [TIMING] Zustand 상태 업데이트 시작');
        set((state) => {
          console.log('📋 [TIMING] Assigning patients to beds:', patients.map(p => ({name: p.name, prescription: !!p.currentPrescription})));

          // Create updated beds array with database patients assigned
          const updatedBeds = state.beds.map(bed => {
            // Find patient that matches this bed's room and bed number
            // 침대 번호 형식: "301A-1" -> room: "301A", bed: "1"
            const matchingPatient = patients.find(patient =>
              patient.room === bed.room && patient.bed === bed.bedNumber.split('-')[1]
            );

            if (matchingPatient) {
              console.log(`🛏️ [TIMING] Bed ${bed.bedNumber}: ${matchingPatient.name} (처방: ${matchingPatient.currentPrescription ? '있음' : '없음'})`);
              return {
                ...bed,
                patient: matchingPatient,
                status: 'occupied' as const
              };
            } else {
              // Clear bed if no patient matches (patient may have been discharged)
              console.log(`🛏️ [TIMING] Bed ${bed.bedNumber}: Empty`);
              return {
                ...bed,
                patient: undefined,
                status: 'empty' as const
              };
            }
          });

          console.log('✅ [TIMING] Zustand 상태 업데이트 완료 -', Date.now() - startTime, 'ms');
          return {
            patients,
            beds: updatedBeds,
            isLoading: false
          };
        });

        console.log('🎉 [TIMING] fetchPatients 완전 종료 -', Date.now() - startTime, 'ms');

        // 🔄 Removed automatic callback triggers to prevent infinite loops
        // Callbacks will be manually triggered only when needed

      } else {
        throw new Error(response.error || 'Failed to fetch patients');
      }
    } catch (error) {
      console.error('❌ [TIMING] fetchPatients 오류 발생:', error);
      set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
      // 오류 시 서버 연결 상태를 false로 설정
      set({ isServerConnected: false });
    }
  },

  // Patient Management Methods (with API)
  addPatient: async (patientData: Omit<Patient, 'id'>, bedNumber: string, prescription?: Omit<IVPrescription, 'id'>) => {
    set({ isLoading: true, error: null });

    try {
      // 먼저 서버 연결 상태 확인
      const isConnected = await checkServerConnection();
      set({ isServerConnected: isConnected });

      if (isConnected) {
        // 서버에 환자 추가 - 변환 함수 사용 (침대 정보 + PIN 포함)
        const dbPatient = convertFrontendPatientToDB(patientData, bedNumber, patientData.phone, patientData.pinCode);

        const response = await patientAPI.createPatient(dbPatient);

        console.log('🔍 Patient API Response:', response);
        console.log('🔍 Response data structure:', {
          responseData: response.data,
          patientId: response.data?.patientId,
          dataType: typeof response.data
        });

        if (response.success && response.data) {
          const newPatient: Patient = {
            ...patientData,
            id: `P${response.data.patientId}`,
          };

          // 🗺️ Store bed mapping for this patient and update patient object immediately
          set((state) => {
            const newMapping = new Map(state.patientBedMapping);
            newMapping.set(newPatient.id, bedNumber);
            console.log(`🗺️ Storing bed mapping: ${newPatient.id} → ${bedNumber}`);

            // ✨ CRITICAL: Update patient object with correct room/bed immediately
            const bedParts = bedNumber.split('-');
            newPatient.room = bedParts[0];
            newPatient.bed = bedParts[1];
            console.log(`🔄 Updated patient object: ${newPatient.name} → room: ${newPatient.room}, bed: ${newPatient.bed}`);

            return { patientBedMapping: newMapping };
          });

          // 🔄 처방전이 있으면 IV 세션도 생성
          if (prescription) {
            try {
              const ivSession: Omit<IVSessionDB, 'sessionId'> = {
                patientId: response.data.patientId!,
                dripId: 2, // Normal Saline (기본값)
                startTime: new Date().toISOString(),
                remainingVolume: prescription.totalVolume,
                flowRate: prescription.calculatedFlowRate,
                ivPoleId: `POLE-${patientData.room}-${patientData.bed}`,
                status: 'ACTIVE',
                totalVolumeMl: prescription.totalVolume,
                endExpTime: new Date(Date.now() + prescription.duration * 60000).toISOString()
              };

              console.log('🔄 IV 세션 생성 시도 중:', {
                patientId: response.data.patientId,
                medication: prescription.medicationName,
                volume: prescription.totalVolume,
                duration: prescription.duration
              });

              const sessionResponse = await ivSessionAPI.createSession(ivSession);
              if (sessionResponse.success) {
                // 처방전 정보를 환자 객체에 추가
                newPatient.currentPrescription = {
                  ...prescription,
                  id: `RX${Date.now()}`,
                };
                console.log('✅ IV 세션 생성 성공:', {
                  sessionId: sessionResponse.data?.sessionId,
                  medication: prescription.medicationName,
                  patientName: newPatient.name
                });
              } else {
                console.error('❌ IV 세션 생성 실패:', {
                  error: sessionResponse.error,
                  patientId: response.data.patientId,
                  medication: prescription.medicationName,
                  message: '환자는 등록되었지만 처방전 정보가 저장되지 않았습니다.'
                });
                // 사용자에게 알리기 위한 에러 상태 설정
                set({ error: `환자 ${newPatient.name}이(가) 등록되었지만 처방전 정보 저장에 실패했습니다: ${sessionResponse.error}` });
              }
            } catch (error) {
              console.error('❌ IV 세션 생성 중 예외 발생:', {
                error: error instanceof Error ? error.message : error,
                patientId: response.data.patientId,
                medication: prescription.medicationName,
                stack: error instanceof Error ? error.stack : undefined
              });
              // 환자는 생성되었으니 처방전 오류는 로그만 남기고 진행하되 사용자에게 알림
              set({ error: `환자 ${newPatient.name}이(가) 등록되었지만 처방전 정보 저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` });
            }
          }

          set((state) => ({
            patients: [...state.patients, newPatient],
            beds: state.beds.map(bed =>
              bed.bedNumber === bedNumber
                ? { ...bed, patient: newPatient, status: 'occupied' as const }
                : bed
            ),
            isLoading: false
          }));

          // 🔄 CRITICAL: Save mapping immediately after patient addition
          get().saveToStorage();
          console.log(`💾 Saved patient and bed mapping to localStorage immediately`);

          // ❌ REMOVED: setTimeout fetchPatients - causes race condition
          // Mapping is already applied to patient object, no need to re-fetch
        }
      } else {
        // 오프라인 모드 - 로컬에만 추가
        const newPatient: Patient = {
          ...patientData,
          id: `P${Date.now()}`,
          currentPrescription: prescription ? {
            ...prescription,
            id: `RX${Date.now()}`,
          } : undefined,
        };

        // 🗺️ Store bed mapping for offline patient and update object immediately
        set((state) => {
          const newMapping = new Map(state.patientBedMapping);
          newMapping.set(newPatient.id, bedNumber);
          console.log(`🗺️ Storing offline bed mapping: ${newPatient.id} → ${bedNumber}`);

          // ✨ CRITICAL: Update offline patient object with correct room/bed immediately
          const bedParts = bedNumber.split('-');
          newPatient.room = bedParts[0];
          newPatient.bed = bedParts[1];
          console.log(`🔄 Updated offline patient: ${newPatient.name} → room: ${newPatient.room}, bed: ${newPatient.bed}`);

          return { patientBedMapping: newMapping };
        });

        set((state) => ({
          patients: [...state.patients, newPatient],
          beds: state.beds.map(bed => 
            bed.bedNumber === bedNumber 
              ? { ...bed, patient: newPatient, status: 'occupied' as const }
              : bed
          ),
          isLoading: false
        }));
        
        get().saveToStorage();
      }
    } catch (error) {
      console.error('Failed to add patient:', error);
      set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
    }
  },

  updatePatient: async (patientId: string, updates: Partial<Patient>) => {
    set({ isLoading: true, error: null });
    
    try {
      if (get().isServerConnected) {
        // 서버에 업데이트
        const numericId = parseInt(patientId.replace('P', ''));
        const dbUpdates: Partial<PatientDB> = {
          name: updates.name,
          gender: updates.gender,
          weightKg: updates.weight ? Math.round(updates.weight) : undefined,
          heightCm: updates.height ? Math.round(updates.height) : undefined
        };
        
        const response = await patientAPI.updatePatient(numericId, dbUpdates);
        
        if (response.success) {
          set((state) => ({
            patients: state.patients.map(patient =>
              patient.id === patientId ? { ...patient, ...updates } : patient
            ),
            beds: state.beds.map(bed => {
              if (bed.patient?.id === patientId) {
                return {
                  ...bed,
                  patient: { ...bed.patient, ...updates }
                };
              }
              return bed;
            }),
            isLoading: false
          }));

          get().saveToStorage();

          // 🔥 REMOVED: fetchPatients() to prevent overwriting localStorage prescription data
          // Local state is now the source of truth for prescription data
        }
      } else {
        // 오프라인 모드 - 로컬에만 업데이트
        set((state) => ({
          patients: state.patients.map(patient =>
            patient.id === patientId ? { ...patient, ...updates } : patient
          ),
          beds: state.beds.map(bed => {
            if (bed.patient?.id === patientId) {
              return {
                ...bed,
                patient: { ...bed.patient, ...updates }
              };
            }
            return bed;
          }),
          isLoading: false
        }));
        
        get().saveToStorage();
      }
    } catch (error) {
      console.error('Failed to update patient:', error);
      set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
    }
  },

  removePatient: async (patientId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      if (get().isServerConnected) {
        // 서버에서 삭제
        const numericId = parseInt(patientId.replace('P', ''));
        const response = await patientAPI.deletePatient(numericId);
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to delete patient');
        }
      }
      
      // 로컬 상태 업데이트
      set((state) => {
        const updatedPatients = state.patients.filter(patient => patient.id !== patientId);
        const updatedBeds = state.beds.map(bed => {
          if (bed.patient?.id === patientId) {
            return {
              ...bed,
              patient: undefined,
              poleData: undefined,
              status: 'empty' as const
            };
          }
          return bed;
        });

        // Remove pole data for this patient
        const newPoleData = new Map(state.poleData);
        for (const [poleId, data] of newPoleData.entries()) {
          if (data.patientId === patientId) {
            newPoleData.delete(poleId);
          }
        }

        return {
          patients: updatedPatients,
          beds: updatedBeds,
          poleData: newPoleData,
          isLoading: false
        };
      });

      // Save to localStorage
      get().saveToStorage();

      // ✅ RESTORED: fetchPatients() after patient deletion to sync with DB
      // Note: This is safe for deletion (unlike prescription updates)
      // Deletion removes entire patient record, so no data overwrite issues
      console.log(`🔄 [DELETE] Syncing with backend after patient ${patientId} deletion`);
      if (get().isServerConnected) {
        await get().fetchPatients();
      }
    } catch (error) {
      console.error('Failed to remove patient:', error);
      set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
    }
  },

  addIVPrescription: async (patientId: string, prescriptionData: Omit<IVPrescription, 'id'>) => {
    console.log(`🏥 [PRESCRIPTION-START] ${patientId} 처방 생성 시작: ${prescriptionData.medicationName}`);
    const patient = get().getPatientById(patientId);
    if (patient) {
      console.log(`👤 [PRESCRIPTION-PATIENT] ${patientId} 현재 환자 상태 - 기존 처방: ${patient.currentPrescription ? '있음' : '없음'}`);
    }

    try {
      // 약품명에서 drugTypeId 찾기 (localStorage 캐시 사용)
      let drugTypeId = 1; // 기본값
      let matchedDrugName = prescriptionData.medicationName; // 매칭된 약품 이름 저장
      try {
        // Try localStorage first
        let drugs: any[] = [];
        const cachedDrugs = storageService.loadDrugTypes();
        if (cachedDrugs && cachedDrugs.length > 0) {
          console.log('💊 [PRESCRIPTION-CACHE] localStorage에서 약품 타입 로드:', cachedDrugs.length, '개');
          drugs = cachedDrugs;
        } else {
          // Fallback to API
          console.log('💊 [PRESCRIPTION-API] 백엔드에서 약품 타입 로드');
          const drugsResponse = await dripAPI.getDrips();
          drugs = drugsResponse.success ? drugsResponse.data || [] : [];

          // Save to localStorage
          if (drugs.length > 0) {
            storageService.saveDrugTypes(drugs);
            console.log('💊 [CACHE-SAVE] 약품 타입 localStorage 저장:', drugs.length, '개');
          }
        }

        // 약품 이름 매칭 로직 강화 (정확한 일치 + 대소문자 무시)
        const matchingDrug = drugs.find(drug => {
          const dbName = drug.dripName.trim().toLowerCase();
          const inputName = prescriptionData.medicationName.trim().toLowerCase();
          return dbName === inputName;
        });

        if (matchingDrug?.dripId) {
          drugTypeId = matchingDrug.dripId;
          matchedDrugName = matchingDrug.dripName; // DB의 정확한 이름 사용
          console.log(`✅ [DRUG-MATCH] 약품 매칭 성공: "${prescriptionData.medicationName}" → drugTypeId=${drugTypeId} (${matchedDrugName})`);
        } else {
          console.warn(`⚠️ [DRUG-MISMATCH] 약품 매칭 실패: "${prescriptionData.medicationName}" → 기본값 drugTypeId=1 사용`);
          console.warn('💊 [DRUG-LIST] 사용 가능한 약품:', drugs.map(d => d.dripName).join(', '));
        }
      } catch (error) {
        console.error('❌ [DRUG-ERROR] 약품 타입 조회 실패, 기본값 사용:', error);
      }

      // 백엔드 Prescription API 호출 (startedAt은 백엔드에서 처리)
      const numericPatientId = parseInt(patientId.replace('P', ''));
      const prescriptionRequest: Omit<PrescriptionDB, 'id' | 'prescribedAt' | 'completedAt' | 'startedAt'> = {
        patientId: numericPatientId,
        drugTypeId: drugTypeId,
        totalVolumeMl: Math.round(prescriptionData.totalVolume), // Integer로 변환
        infusionRateMlHr: prescriptionData.calculatedFlowRate, // mL/min (Double 유지 - 소수점 precision 보존)
        gttFactor: prescriptionData.gttFactor, // 이미 integer
        calculatedGtt: Math.round(prescriptionData.calculatedGTT), // Integer로 변환
        durationHours: prescriptionData.duration / 60, // 분을 시간으로 변환 (Double 유지)
        specialInstructions: prescriptionData.notes || '',
        status: 'PRESCRIBED',
        prescribedBy: prescriptionData.prescribedBy || '간호사' // 빈 문자열일 경우 기본값
      };

      console.log('📤 [PRESCRIPTION-API] 백엔드로 전송할 데이터:', JSON.stringify(prescriptionRequest, null, 2));
      const response = await prescriptionAPI.createPrescription(prescriptionRequest);
      console.log('📥 [PRESCRIPTION-API] 백엔드 응답:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        console.log('✅ [DB-SUCCESS] 처방이 데이터베이스에 성공적으로 저장되었습니다!');
        console.log('📋 [DB-DATA] 저장된 처방 정보:', {
          prescriptionId: response.data.id,
          patientId: response.data.patientId,
          drugTypeId: response.data.drugTypeId,
          medicationName: matchedDrugName,
          totalVolume: response.data.totalVolumeMl,
          duration: response.data.durationHours,
          status: response.data.status,
          prescribedAt: response.data.prescribedAt,
          startedAt: response.data.startedAt
        });

        // 즉시 로컬 상태 업데이트 (UI 즉시 반영)
        const newPrescription: IVPrescription = {
          id: `RX${response.data.id}`,
          ...prescriptionData
        };

        // 로컬 상태 즉시 업데이트
        console.log(`💾 [PRESCRIPTION-LOCAL] ${patientId} 로컬 상태 업데이트 시작 - 처방: ${newPrescription.medicationName}`);
        set((state) => {
          const updatedPatients = state.patients.map(patient => {
            if (patient.id === patientId) {
              console.log(`📝 [PRESCRIPTION-UPDATE] ${patientId} 환자 처방 업데이트: ${patient.currentPrescription ? '교체' : '신규'}`);
              return { ...patient, currentPrescription: newPrescription };
            }
            return patient;
          });
          return {
            patients: updatedPatients,
            beds: state.beds.map(bed => {
              if (bed.patient?.id === patientId) {
                return {
                  ...bed,
                  patient: { ...bed.patient, currentPrescription: newPrescription }
                };
              }
              return bed;
            })
          };
        });

        // 처방 정보 변경 콜백 트리거 (실시간 동기화)
        get().triggerPrescriptionCallbacks(patientId);

        // 💾 localStorage에 상태 저장 (환자 등록과 동일한 패턴)
        console.log(`💾 [PRESCRIPTION-STORAGE] ${patientId} localStorage 저장 시작`);
        get().saveToStorage();

        // 🔥 NEW: 처방 정보 별도 저장 (약품 정보 포함) - DB 저장 성공해도 localStorage는 항상 백업
        storageService.savePrescriptionForPatient(patientId, newPrescription);
        console.log(`✅ [PRESCRIPTION-STORAGE] ${patientId} localStorage 백업 완료 (DB 동기화됨)`);

        console.log(`✅ [PRESCRIPTION] ${patientId} 처방 추가 완료 - DB 저장 성공, localStorage 백업 완료`);

        // 🔥 REMOVED: Background fetchPatients to prevent data overwriting
        // The local state is now the source of truth until manual refresh

      } else {
        console.error('❌ [DB-FAIL] 처방 데이터베이스 저장 실패!');
        console.error('📋 [ERROR-DETAILS] 응답 상세:', {
          success: response.success,
          error: response.error,
          message: response.message,
          data: response.data
        });
        console.warn('⚠️ [FALLBACK] localStorage로만 처방 정보 저장 (오프라인 모드)');

        // 사용자에게 DB 저장 실패 알림 (에러 상태 설정)
        set({
          error: `⚠️ 처방 정보가 서버에 저장되지 않았습니다. 로컬에만 저장되었습니다.\n원인: ${response.error || '알 수 없는 오류'}`,
          isLoading: false
        });

        // 백엔드 실패 시 로컬만 업데이트
        const prescription = createIVPrescription(
          prescriptionData.medicationName,
          prescriptionData.totalVolume,
          prescriptionData.duration,
          prescriptionData.gttFactor,
          prescriptionData.prescribedBy,
          prescriptionData.notes
        );

        // 💾 로컬 상태와 localStorage 즉시 업데이트
        console.log(`💾 [PRESCRIPTION-OFFLINE] ${patientId} 백엔드 실패 시 로컬 처방 저장`);
        set((state) => ({
          patients: state.patients.map(patient => {
            if (patient.id === patientId) {
              return { ...patient, currentPrescription: prescription };
            }
            return patient;
          }),
          beds: state.beds.map(bed => {
            if (bed.patient?.id === patientId) {
              return {
                ...bed,
                patient: { ...bed.patient, currentPrescription: prescription }
              };
            }
            return bed;
          })
        }));

        // localStorage에 저장
        get().saveToStorage();

        // 🔥 NEW: 처방 정보 별도 저장 (약품 정보 포함)
        storageService.savePrescriptionForPatient(patientId, prescription);
        console.log(`✅ [PRESCRIPTION-OFFLINE] ${patientId} localStorage 저장 완료 (서버 저장 실패)`);

        get().triggerPrescriptionCallbacks(patientId);
      }
    } catch (error) {
      console.error('❌ [EXCEPTION] 처방 생성 중 예외 발생:', error);

      // 사용자에게 예외 알림 (에러 상태 설정)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      set({
        error: `처방 정보 저장 중 오류가 발생했습니다: ${errorMessage}. 로컬에만 저장되었습니다.`,
        isLoading: false
      });

      // 오류 발생 시 로컬만 업데이트
      const prescription = createIVPrescription(
        prescriptionData.medicationName,
        prescriptionData.totalVolume,
        prescriptionData.duration,
        prescriptionData.gttFactor,
        prescriptionData.prescribedBy,
        prescriptionData.notes
      );

      // 💾 로컬 상태와 localStorage 즉시 업데이트
      console.log(`💾 [PRESCRIPTION-ERROR] ${patientId} 오류 발생 시 로컬 처방 저장`);
      set((state) => ({
        patients: state.patients.map(patient => {
          if (patient.id === patientId) {
            return { ...patient, currentPrescription: prescription };
          }
          return patient;
        }),
        beds: state.beds.map(bed => {
          if (bed.patient?.id === patientId) {
            return {
              ...bed,
              patient: { ...bed.patient, currentPrescription: prescription }
            };
          }
          return bed;
        })
      }));

      // localStorage에 저장
      get().saveToStorage();

      // 🔥 NEW: 처방 정보 별도 저장 (약품 정보 포함)
      storageService.savePrescriptionForPatient(patientId, prescription);
      console.log(`✅ [PRESCRIPTION-ERROR] ${patientId} localStorage 저장 완료 (예외 발생)`);

      get().triggerPrescriptionCallbacks(patientId);
    }
  },

  updateIVPrescription: (patientId: string, prescriptionUpdates: Partial<IVPrescription>) => {
    const patient = get().getPatientById(patientId);
    if (patient?.currentPrescription) {
      const updatedPrescription = {
        ...patient.currentPrescription,
        ...prescriptionUpdates
      };
      get().updatePatient(patientId, { currentPrescription: updatedPrescription });
    }
  },

  // Delete patient (remove completely from system)
  deletePatient: async (patientId: string) => {
    await get().removePatient(patientId);
  },

  // End IV session (stop current infusion)
  endIVSession: async (patientId: string) => {
    set({ isLoading: true, error: null });

    try {
      // Update patient to remove current prescription
      await get().updatePatient(patientId, {
        currentPrescription: undefined
      });

      // Clear pole data for this patient
      set((state) => {
        const newPoleData = new Map(state.poleData);
        for (const [poleId, data] of newPoleData.entries()) {
          if (data.patientId === patientId) {
            newPoleData.set(poleId, {
              ...data,
              status: 'offline',
              flowRate: 0,
              currentVolume: 0,
              percentage: 0,
              estimatedTime: 0
            });
          }
        }

        return {
          poleData: newPoleData,
          isLoading: false
        };
      });

      // Add completion alert
      get().addAlert({
        id: `ALERT_${Date.now()}`,
        poleId: '',
        patientId,
        type: 'custom',
        severity: 'info',
        message: `${get().getPatientById(patientId)?.name}: 수액 투여가 종료되었습니다`,
        timestamp: new Date(),
        acknowledged: false
      });

      get().saveToStorage();
    } catch (error) {
      console.error('Failed to end IV session:', error);
      set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
    }
  },

  // Load stored data from localStorage
  loadStoredData: () => {
    console.log('📂 Loading stored data from localStorage...');
    const storedState = storageService.loadWardState();

    if (storedState.patients && storedState.beds) {
      const mappingSize = storedState.patientBedMapping?.size || 0;
      console.log(`✅ Found stored data: ${storedState.patients.length} patients, ${storedState.beds.length} beds, ${mappingSize} bed mappings`);

      set({
        patients: storedState.patients,
        beds: storedState.beds,
        alerts: storedState.alerts || [],
        poleData: storedState.poleData || new Map(),
        patientBedMapping: storedState.patientBedMapping || new Map()
      });

      if (storedState.patientBedMapping && storedState.patientBedMapping.size > 0) {
        console.log('🗺️ Loaded patient bed mappings:', Array.from(storedState.patientBedMapping.entries()));
      }

      get().updateWardStats();
      return true; // 저장된 데이터 로드 성공
    }

    console.log('❌ No stored data found');
    return false; // 저장된 데이터 없음
  },

  // Save current state to localStorage
  saveToStorage: () => {
    const { patients, beds, alerts, poleData, patientBedMapping } = get();
    storageService.saveWardState(patients, beds, alerts, poleData, patientBedMapping);
  },

  // 🔄 NEW: Real-time sync callback system for PatientDetail
  registerPrescriptionCallback: (patientId: string, callback: () => void) => {
    console.log(`📞 [CALLBACK] 처방 정보 콜백 등록: ${patientId}`);
    set((state) => {
      const newCallbacks = new Map(state.prescriptionCallbacks);
      newCallbacks.set(patientId, callback);
      return { prescriptionCallbacks: newCallbacks };
    });
  },

  unregisterPrescriptionCallback: (patientId: string) => {
    console.log(`📞 [CALLBACK] 처방 정보 콜백 해제: ${patientId}`);
    set((state) => {
      const newCallbacks = new Map(state.prescriptionCallbacks);
      newCallbacks.delete(patientId);
      return { prescriptionCallbacks: newCallbacks };
    });
  },

  triggerPrescriptionCallbacks: (patientId: string) => {
    const callback = get().prescriptionCallbacks.get(patientId);
    if (callback) {
      console.log(`📞 [CALLBACK] 처방 정보 콜백 실행: ${patientId}`);
      try {
        callback();
      } catch (error) {
        console.error(`❌ [CALLBACK] 콜백 실행 실패 (${patientId}):`, error);
      }
    }
  },

  forcePrescriptionSync: async (patientId: string) => {
    console.log(`🔄 [FORCE-SYNC] 개별 환자 처방 정보 강제 동기화: ${patientId}`);

    try {
      const numericId = parseInt(patientId.replace('P', ''));

      // 1. 약품 타입 맵 로딩
      const drugsResponse = await dripAPI.getDrips();
      const drugs = drugsResponse.success ? drugsResponse.data || [] : [];
      const drugMap = new Map(drugs.map(drug => [drug.dripId, drug.dripName]));

      // 2. 해당 환자의 처방 정보만 로딩
      const prescriptionsResponse = await prescriptionAPI.getPatientPrescriptions(numericId);

      if (prescriptionsResponse.success && prescriptionsResponse.data && prescriptionsResponse.data.length > 0) {
        const allPrescriptions = prescriptionsResponse.data;

        // ACTIVE/PRESCRIBED 상태 = 현재 처방
        const activePrescriptions = allPrescriptions.filter(p =>
          p.status === 'ACTIVE' || p.status === 'PRESCRIBED'
        );

        let currentPrescription: IVPrescription | undefined;

        if (activePrescriptions.length > 0) {
          const dbPrescription = activePrescriptions[0];
          const drugName = drugMap.get(dbPrescription.drugTypeId) || 'Unknown Drug';
          currentPrescription = convertDBPrescriptionToFrontend(dbPrescription, drugName);
          console.log(`💊 [FORCE-SYNC] ${patientId} 처방 정보 로딩 성공: ${drugName}`);
        }

        // 3. 환자 정보 업데이트
        set((state) => ({
          patients: state.patients.map(patient =>
            patient.id === patientId
              ? { ...patient, currentPrescription }
              : patient
          ),
          beds: state.beds.map(bed => {
            if (bed.patient?.id === patientId) {
              return {
                ...bed,
                patient: { ...bed.patient, currentPrescription }
              };
            }
            return bed;
          })
        }));

        // 4. 콜백 트리거
        get().triggerPrescriptionCallbacks(patientId);

        console.log(`✅ [FORCE-SYNC] ${patientId} 처방 정보 강제 동기화 완료`);
      } else {
        console.log(`ℹ️ [FORCE-SYNC] ${patientId} 처방 정보 없음`);
      }
    } catch (error) {
      console.error(`❌ [FORCE-SYNC] ${patientId} 처방 정보 강제 동기화 실패:`, error);
    }
  },

  // 🔄 NEW: Navigation-safe methods implementation
  validatePrescriptionData: (patientId: string): boolean => {
    const patient = get().patients.find(p => p.id === patientId);
    if (!patient) {
      console.warn(`⚠️ [VALIDATE] Patient not found: ${patientId}`);
      return false;
    }

    const hasPrescription = !!patient.currentPrescription;
    const prescriptionValid = !!(hasPrescription &&
                                patient.currentPrescription?.medicationName &&
                                patient.currentPrescription?.totalVolume > 0);

    console.log(`🔍 [VALIDATE] ${patientId} 처방 데이터 검증:`, {
      hasPrescription,
      prescriptionValid,
      medicationName: patient.currentPrescription?.medicationName
    });

    return prescriptionValid;
  },

  autoRecoverPrescription: async (patientId: string): Promise<boolean> => {
    console.log(`🔧 [AUTO-RECOVER] ${patientId} 처방 정보 자동 복구 시작`);

    try {
      // 검증 먼저 수행
      if (get().validatePrescriptionData(patientId)) {
        console.log(`✅ [AUTO-RECOVER] ${patientId} 처방 정보 이미 유효함`);
        return true;
      }

      // 강제 동기화 시도
      await get().forcePrescriptionSync(patientId);

      // 동기화 후 재검증
      const isValid = get().validatePrescriptionData(patientId);
      console.log(`${isValid ? '✅' : '❌'} [AUTO-RECOVER] ${patientId} 복구 ${isValid ? '성공' : '실패'}`);

      return isValid;
    } catch (error) {
      console.error(`❌ [AUTO-RECOVER] ${patientId} 자동 복구 실패:`, error);
      return false;
    }
  },

  ensurePrescriptionConsistency: async (patientId: string): Promise<void> => {
    console.log(`🔄 [CONSISTENCY] ${patientId} 처방 정보 일관성 보장 시작`);

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const isValid = get().validatePrescriptionData(patientId);

      if (isValid) {
        console.log(`✅ [CONSISTENCY] ${patientId} 처방 정보 일관성 확인 완료`);
        get().triggerPrescriptionCallbacks(patientId);
        return;
      }

      attempts++;
      console.log(`🔄 [CONSISTENCY] ${patientId} 복구 시도 ${attempts}/${maxAttempts}`);

      const recovered = await get().autoRecoverPrescription(patientId);

      if (recovered) {
        console.log(`✅ [CONSISTENCY] ${patientId} 일관성 복구 성공`);
        get().triggerPrescriptionCallbacks(patientId);
        return;
      }

      // 잠시 대기 후 재시도
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    console.warn(`⚠️ [CONSISTENCY] ${patientId} 처방 정보 일관성 보장 실패 (최대 시도 초과)`);
  },

  getPrescriptionStatus: (patientId: string): 'loading' | 'available' | 'missing' | 'error' => {
    const patient = get().patients.find(p => p.id === patientId);

    if (!patient) {
      return 'error';
    }

    if (!patient.currentPrescription) {
      return 'missing';
    }

    const isValid = get().validatePrescriptionData(patientId);
    return isValid ? 'available' : 'error';
  },

  // ===== Alert Management with Backend API =====

  /**
   * Fetch alerts from backend
   */
  fetchAlerts: async () => {
    const { isServerConnected } = get();

    if (!isServerConnected) {
      console.log('⚠️ [fetchAlerts] Server not connected, skipping alert fetch');
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v1';
      const response = await fetch(`${API_URL}/alerts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const backendAlerts = await response.json();

        // Convert backend AlertLog format to frontend Alert format
        const convertedAlerts: Alert[] = backendAlerts.map((backendAlert: any) => {
          // Find patient by session ID (need to map session -> patient)
          const session = get().patients.find(p =>
            p.currentPrescription && p.id === `P${backendAlert.sessionId}`
          );

          return {
            id: `ALT${backendAlert.alertId}`, // 고유 ID 생성 (ALERT- 대신 ALT)
            patientId: session?.id || '',
            poleId: session?.poleId || '',
            type: backendAlert.alertType === 'nurse_call' ? 'button_pressed' :
                  backendAlert.alertType === 'low_volume' ? 'low' :
                  backendAlert.alertType === 'flow_stopped' ? 'empty' :
                  backendAlert.alertType === 'battery_low' ? 'battery_low' :
                  backendAlert.alertType === 'pole_fall' ? 'abnormal' : 'offline',
            severity: backendAlert.severity as 'info' | 'warning' | 'critical',
            message: backendAlert.message,
            timestamp: new Date(backendAlert.createdAt),
            acknowledged: backendAlert.acknowledged,
          };
        });

        // 중복 제거: 기존 alerts와 병합하되 동일 ID는 최신 것으로 업데이트
        const existingAlerts = get().alerts;
        const alertMap = new Map<string, Alert>();

        // 기존 alerts를 Map에 추가
        existingAlerts.forEach(alert => alertMap.set(alert.id, alert));

        // 새로운 alerts로 업데이트 (덮어쓰기)
        convertedAlerts.forEach(alert => alertMap.set(alert.id, alert));

        // Map을 배열로 변환
        const mergedAlerts = Array.from(alertMap.values());

        // Update state with deduplicated alerts
        set({ alerts: mergedAlerts });
        console.log(`✅ [fetchAlerts] Loaded ${convertedAlerts.length} alerts from backend (${mergedAlerts.length} total after deduplication)`);
      } else {
        console.error('❌ [fetchAlerts] Failed to fetch alerts:', response.statusText);
      }
    } catch (error) {
      console.error('❌ [fetchAlerts] Error fetching alerts:', error);
    }
  },

  /**
   * Acknowledge alert on backend
   */
  acknowledgeAlertBackend: async (alertId: string, nurseId: string) => {
    const { isServerConnected } = get();

    // 로컬 생성 alert는 백엔드 호출 스킵 (ALERT_로 시작하는 경우)
    if (alertId.startsWith('ALERT_')) {
      console.log('ℹ️ [acknowledgeAlert] Local alert, skipping backend acknowledgement');
      get().acknowledgeAlert(alertId, nurseId);
      return;
    }

    if (!isServerConnected) {
      console.log('⚠️ [acknowledgeAlert] Server not connected, using local storage only');
      get().acknowledgeAlert(alertId, nurseId);
      return;
    }

    try {
      // Extract backend alert ID from frontend alert ID (ALT1089 -> 1089)
      const backendAlertId = alertId.replace(/^ALT/, '');

      // Use environment variable for API URL (supports both local and remote)
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v1';

      const response = await fetch(`${API_URL}/alerts/${backendAlertId}/acknowledge?nurseId=${nurseId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log(`✅ [acknowledgeAlert] Alert ${alertId} acknowledged on backend`);

        // Update local state
        get().acknowledgeAlert(alertId, nurseId);

        // Refresh alerts from backend
        await get().fetchAlerts();
      } else {
        const errorText = await response.text();
        console.error('❌ [acknowledgeAlert] Failed to acknowledge alert on backend:', response.status, errorText);
        // Fallback to local state update
        get().acknowledgeAlert(alertId, nurseId);
      }
    } catch (error) {
      console.error('❌ [acknowledgeAlert] Error acknowledging alert:', error);
      // Fallback to local state update
      get().acknowledgeAlert(alertId, nurseId);
    }
  },

  /**
   * Connect pole to patient
   */
  connectPoleToPatient: async (patientId: string, poleId: string) => {
    const { isServerConnected, patients } = get();

    if (!isServerConnected) {
      throw new Error('서버에 연결되어 있지 않습니다');
    }

    try {
      console.log(`🔌 [connectPole] Connecting pole ${poleId} to patient ${patientId}`);

      // Extract numeric patient ID from string (P123 -> 123)
      const numericPatientId = patientId.replace('P', '');

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v1';
      const response = await fetch(`${API_URL}/poles/${poleId}/connect?patientId=${numericPatientId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log(`✅ [connectPole] Successfully connected pole ${poleId} to patient ${patientId}`);

        // Update local state - find patient and update poleId
        const updatedPatients = patients.map(patient => {
          if (patient.id === patientId) {
            return { ...patient, poleId };
          }
          return patient;
        });

        set({ patients: updatedPatients });

        // 처방 정보가 있으면 ESP8266으로 전송 (백엔드가 자동 처리)
        const patient = patients.find(p => p.id === patientId);
        if (patient?.currentPrescription) {
          console.log(`📤 [connectPole] Prescription data will be sent to ESP8266 via backend`);
        }

        // Refresh patients data to sync with backend
        await get().fetchPatients();

        // Save to storage
        get().saveToStorage();
      } else {
        const error = await response.text();
        console.error('❌ [connectPole] Failed to connect pole:', error);
        throw new Error(`폴대 연결 실패: ${error}`);
      }
    } catch (error) {
      console.error('❌ [connectPole] Error connecting pole:', error);
      throw error;
    }
  },

  /**
   * Send prescription to ESP8266 manually
   */
  sendPrescriptionToESP: async (patientId: string) => {
    const { isServerConnected, patients } = get();

    if (!isServerConnected) {
      throw new Error('서버에 연결되어 있지 않습니다');
    }

    try {
      console.log(`📤 [sendPrescription] Sending prescription for patient ${patientId}`);

      // Find patient and verify pole connection
      const patient = patients.find(p => p.id === patientId);
      if (!patient) {
        throw new Error('환자를 찾을 수 없습니다');
      }

      if (!patient.poleId) {
        throw new Error('폴대가 연결되어 있지 않습니다');
      }

      const response = await fetch(
        `http://localhost:8081/api/v1/poles/${patient.poleId}/send-prescription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '처방 정보 전송 실패');
      }

      const result = await response.json();
      console.log(`✅ [sendPrescription] Successfully sent prescription to ESP8266:`, result);
      return result;
    } catch (error) {
      console.error('❌ [sendPrescription] Error sending prescription:', error);
      throw error;
    }
  },

  /**
   * Disconnect pole from patient
   */
  disconnectPoleFromPatient: async (patientId: string) => {
    const { isServerConnected, patients } = get();

    if (!isServerConnected) {
      throw new Error('서버에 연결되어 있지 않습니다');
    }

    try {
      console.log(`🔌 [disconnectPole] Disconnecting pole from patient ${patientId}`);

      // Find patient's current pole
      const patient = patients.find(p => p.id === patientId);
      if (!patient?.poleId) {
        console.warn(`⚠️ [disconnectPole] Patient ${patientId} has no connected pole`);
        return;
      }

      const poleId = patient.poleId;

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v1';
      const response = await fetch(`${API_URL}/poles/${poleId}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log(`✅ [disconnectPole] Successfully disconnected pole ${poleId} from patient ${patientId}`);

        // Update local state - remove poleId from patient
        const updatedPatients = patients.map(p => {
          if (p.id === patientId) {
            const { poleId, ...rest } = p;
            return rest;
          }
          return p;
        });

        set({ patients: updatedPatients });

        // Refresh patients data to sync with backend
        await get().fetchPatients();

        // Save to storage
        get().saveToStorage();
      } else {
        const error = await response.text();
        console.error('❌ [disconnectPole] Failed to disconnect pole:', error);
        throw new Error(`폴대 연결 해제 실패: ${error}`);
      }
    } catch (error) {
      console.error('❌ [disconnectPole] Error disconnecting pole:', error);
      throw error;
    }
  },
}));