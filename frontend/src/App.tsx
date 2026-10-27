import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import WardOverview from './components/ward/WardOverview'
import PatientDetail from './pages/PatientDetail'
import PatientList from './pages/PatientList'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'
import DeviceManagement from './pages/DeviceManagement'
import { Toaster } from 'react-hot-toast'
import { useWardStore } from './stores/wardStore'
import { useWebSocket } from './hooks/useWebSocket'
import BlePatientSelectModal from './components/ble/BlePatientSelectModal'

function App() {
  const { checkConnection, loadStoredData } = useWardStore()
  const [isInitialized, setIsInitialized] = useState(false)

  // Real-time WebSocket connection for ESP8266 hardware integration
  // serverUrl will be automatically derived from VITE_API_URL environment variable
  const { isConnected, connectionStatus, error } = useWebSocket({
    reconnectDelay: 5000,
    debug: true // Enable debug logging
  })

  // Log WebSocket status
  useEffect(() => {
    console.log('📡 WebSocket Status:', { isConnected, connectionStatus, error })
  }, [isConnected, connectionStatus, error])

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 앱 초기화 시작...')

        // 1. 먼저 저장된 데이터가 있는지 확인하고 로드
        const hasStoredData = loadStoredData()
        console.log('📂 저장된 데이터 로드:', hasStoredData)

        // 침대 구성이 잘못되어 있으면 초기화 (환자-침대 매핑은 보존)
        const { beds, patientBedMapping } = useWardStore.getState()
        const hasMixedRooms = beds.some(bed => !bed.bedNumber.startsWith('301A'))
        if (hasMixedRooms || beds.length !== 6) {
          console.log('🔄 침대 구성 초기화 중... (매핑 데이터 보존)')

          // 🔄 CRITICAL FIX: 매핑 데이터 백업
          const savedMapping = new Map(patientBedMapping)
          console.log('💾 환자-침대 매핑 백업:', Array.from(savedMapping.entries()))

          // ❌ FIXED: localStorage.clear() 대신 선택적 삭제
          localStorage.removeItem('smart_iv_pole_patients')
          localStorage.removeItem('smart_iv_pole_beds')
          localStorage.removeItem('smart_iv_pole_alerts')
          localStorage.removeItem('smart_iv_pole_pole_data')
          // 매핑 데이터는 삭제하지 않음: smart_iv_pole_patient_bed_mapping 보존

          // Mock 데이터 초기화 제거됨 - 백엔드 데이터만 사용
          console.log('✅ 침대 구성 초기화 완료 (백엔드 데이터 사용)')

          // 🔄 매핑 데이터 복원 및 즉시 저장
          useWardStore.setState({ patientBedMapping: savedMapping })
          console.log('🔄 환자-침대 매핑 복원 완료')

          // 🔄 복원된 매핑을 localStorage에 즉시 저장
          if (savedMapping.size > 0) {
            useWardStore.getState().saveToStorage()
            console.log('💾 복원된 매핑 localStorage에 저장 완료')
          }
        }

        // 2. 백엔드 서버 연결 확인 및 데이터 동기화
        console.log('🔗 백엔드 서버 연결 시도 중...')
        await checkConnection()

        // 3. 초기화 완료
        setIsInitialized(true)

        console.log('✅ 앱 초기화 완료!', {
          hasStoredData,
          serverConnected: '연결 상태는 wardStore에서 확인'
        })
      } catch (error) {
        console.error('❌ 앱 초기화 실패:', error)
        // 에러가 발생해도 저장된 데이터나 목업 데이터로 앱 실행
        setIsInitialized(true)
      }
    }

    initializeApp()
  }, [checkConnection, loadStoredData]) // isServerConnected 제거로 무한 루프 방지

  // 초기화 중일 때는 로딩 화면 표시 (선택사항)
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">IV</span>
          </div>
          <div className="text-xl font-semibold text-gray-900 mb-2">Smart IV Pole</div>
          <div className="text-gray-600">데이터 로딩 중...</div>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<WardOverview />} />
        <Route path="/patients" element={<PatientList />} />
        <Route path="/patient/:id" element={<PatientDetail />} />
        <Route path="/devices" element={<DeviceManagement />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      {/* BLE 직결 알림 토스트 (모바일 앱의 상단 배너에 대응) */}
      <Toaster position="top-right" />
      {/* BLE 폴 → 환자 매핑 선택 모달 (연결 직후 매핑이 없을 때 자동 표시) */}
      <BlePatientSelectModal />
    </Router>
  )
}

export default App
