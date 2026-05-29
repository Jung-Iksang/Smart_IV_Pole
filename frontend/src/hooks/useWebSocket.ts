import { useEffect, useRef, useState } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useWardStore } from '../stores/wardStore';

interface WebSocketConfig {
  serverUrl: string;
  reconnectDelay?: number;
  debug?: boolean;
}

interface WebSocketHookReturn {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastMessage: any;
  error: string | null;
  reconnect: () => void;
}

/**
 * Real-time WebSocket hook for ESP8266 hardware integration
 * 백엔드 WebSocket 서버와 연결하여 실시간 센서 데이터 수신
 */
export const useWebSocket = (config?: WebSocketConfig): WebSocketHookReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);

  const { updatePoleData, addAlert } = useWardStore();

  // Use environment variable for API URL (supports both local and remote)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v1';
  const serverUrl = config?.serverUrl || API_BASE.replace('/api/v1', '');
  const reconnectDelay = config?.reconnectDelay || 5000;
  const debug = config?.debug || false;

  const connect = () => {
    if (clientRef.current?.active) {
      console.log('⚠️ WebSocket already connected');
      return;
    }

    setConnectionStatus('connecting');
    setError(null);

    const client = new Client({
      // SockJS를 통한 WebSocket 연결
      webSocketFactory: () => new SockJS(`${serverUrl}/ws`) as any,

      connectHeaders: {},

      debug: debug ? (str) => console.log('🔌 STOMP:', str) : () => {},

      reconnectDelay: reconnectDelay,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        console.log('✅ WebSocket Connected to:', serverUrl);
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);

        // Subscribe to topics
        subscribeToTopics(client);
      },

      onStompError: (frame) => {
        console.error('❌ STOMP Error:', frame.headers['message']);
        console.error('Details:', frame.body);
        setError(`STOMP Error: ${frame.headers['message']}`);
        setConnectionStatus('error');
      },

      onWebSocketError: (event) => {
        console.error('❌ WebSocket Error:', event);
        setError('WebSocket connection failed');
        setConnectionStatus('error');
      },

      onDisconnect: () => {
        console.log('🔌 WebSocket Disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');

        // Auto-reconnect after delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connect();
        }, reconnectDelay);
      },
    });

    clientRef.current = client;
    client.activate();
  };

  const subscribeToTopics = (client: Client) => {
    // 개별 Pole 데이터는 wardStore의 poles 배열을 기반으로 동적 구독
    // 대신 백엔드가 브로드캐스트하는 통합 토픽을 구독

    // 모든 환자 데이터 구독 (백엔드가 /topic/patient/{id}로 브로드캐스트)
    client.subscribe('/topic/patients', (message: IMessage) => {
      handlePoleDataMessage(message);
    });

    // 전체 알림 구독
    client.subscribe('/topic/alerts', (message: IMessage) => {
      handleAlertMessage(message);
    });

    console.log('📡 Subscribed to WebSocket topics: /topic/patients, /topic/alerts');
  };

  const handlePoleDataMessage = (message: IMessage) => {
    try {
      const data = JSON.parse(message.body);

      if (debug) {
        console.log('📊 Pole Data Received:', data);
      }

      // ✅ 배터리 업데이트 메시지 처리
      if (data.type === 'battery_update') {
        updatePoleData(data.device_id, {
          battery: data.battery_level,
          status: data.is_online ? 'online' : 'offline',
          lastUpdate: new Date(data.timestamp),
        });
        return;
      }

      // 일반 pole 데이터 처리
      const {
        device_id,
        patient_id,
        session_id,
        current_weight,
        flow_rate_measured,
        flow_rate_prescribed,
        remaining_volume,
        percentage,
        state,
        remaining_time_sec,
        timestamp
      } = data;

      // 🔄 RECALCULATE PERCENTAGE: Use prescription total volume as denominator
      const { patients, poleData: existingPoleData } = useWardStore.getState();
      const patient = patients.find((p) => p.id === `P${patient_id}`);
      const totalVolume = patient?.currentPrescription?.totalVolume || 500;
      const recalculatedPercentage = (remaining_volume / totalVolume) * 100;

      console.log(`📊 [PERCENTAGE] Patient P${patient_id}: ${remaining_volume}/${totalVolume}mL = ${recalculatedPercentage.toFixed(1)}% (ESP: ${percentage}%)`);

      // ✅ FIX: Clear alert state when ESP8266 sends normal data
      // Any non-error state should clear the alert flag
      const existingPole = existingPoleData.get(device_id);

      let alertState = {};

      // 🔥 비정상 상태만 명시적으로 체크 - 나머지는 모두 정상으로 처리
      const isAbnormalState = state === 'ERROR' || state === 'CRITICAL' || state === 'ALERT';

      if (!isAbnormalState) {
        // 🟢 정상 상태: alert 상태 클리어 (STABLE, Normal, MONITORING 등 모두 정상)
        alertState = {
          hasActiveAlert: false,
          alertSeverity: undefined,
        };
        if (existingPole?.hasActiveAlert) {
          console.log(`✅ [NORMAL-DATA] Pole ${device_id} received normal data (state: ${state}), clearing alert state`);
        }
      } else {
        // ⚠️ 비정상 상태: 기존 alert 상태 보존
        alertState = existingPole?.hasActiveAlert
          ? {
              hasActiveAlert: existingPole.hasActiveAlert,
              alertSeverity: existingPole.alertSeverity,
            }
          : {};
      }

      // Update pole data in store
      updatePoleData(device_id, {
        poleId: device_id,
        patientId: `P${patient_id}`, // Include patientId for bed matching
        weight: current_weight,
        currentVolume: remaining_volume,
        capacity: totalVolume,                       // ✅ Set capacity from prescription
        percentage: recalculatedPercentage,          // ✅ Recalculated based on prescription
        flowRate: flow_rate_measured,                // ✅ ESP already sends mL/min
        prescribedRate: flow_rate_prescribed,        // ✅ ESP already sends mL/min
        status: isAbnormalState ? 'error' : 'online', // 🔥 비정상 상태만 error, 나머지는 online
        estimatedTime: remaining_time_sec ? remaining_time_sec / 60 : 0, // Convert seconds to minutes
        lastUpdate: new Date(timestamp),
        ...alertState, // ✅ Clear or preserve alert state based on ESP state
      });

      setLastMessage({
        type: 'pole_data',
        data,
        timestamp: new Date()
      });

    } catch (err) {
      console.error('❌ Error parsing pole data:', err);
    }
  };

  const handleAlertMessage = (message: IMessage) => {
    try {
      const data = JSON.parse(message.body);

      console.log('🚨 Alert Received:', data);

      const {
        alert_id,
        device_id,
        patient_id,
        session_id,
        alert_type,
        severity,
        message: alertMessage,
        deviation_percent,
        timestamp
      } = data;

      // ✅ HANDLE ANOMALY_RESOLVED: ESP8266 sends this when alert condition clears
      if (alert_type === 'ANOMALY_RESOLVED') {
        updatePoleData(device_id, {
          hasActiveAlert: false,
          alertSeverity: undefined,
          status: 'online', // Restore to online status
        });

        console.log(`✅ [ALERT-RESOLVED] Pole ${device_id} anomaly resolved, clearing hasActiveAlert flag`);

        // Don't add "ANOMALY_RESOLVED" to alerts list (it's just a status update)
        return;
      }

      // ✅ FIX: Set hasActiveAlert flag on pole data
      // This will trigger red/yellow color in BedCard
      const alertSeverity = severity === 'critical' ? 'critical' : 'warning';

      updatePoleData(device_id, {
        hasActiveAlert: true,
        alertSeverity: alertSeverity,
        status: 'error', // Mark as error state during alert
      });

      console.log(`🚨 [ALERT-FLAG] Pole ${device_id} alert active: severity=${alertSeverity}`);

      // Add alert to store
      addAlert({
        id: `ALT${alert_id}`,
        poleId: device_id,
        patientId: `P${patient_id}`,
        type: alert_type === 'FLOW_RATE_ABNORMAL' ? 'abnormal' : 'low',
        severity: alertSeverity,
        message: alertMessage || `유속 이상 감지 (${deviation_percent.toFixed(1)}% 편차)`,
        timestamp: new Date(timestamp),
        acknowledged: false,
      });

      setLastMessage({
        type: 'alert',
        data,
        timestamp: new Date()
      });

    } catch (err) {
      console.error('❌ Error parsing alert:', err);
    }
  };

  const disconnect = () => {
    if (clientRef.current) {
      clientRef.current.deactivate();
      clientRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const reconnect = () => {
    disconnect();
    setTimeout(() => connect(), 500);
  };

  // Initialize connection on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [serverUrl]);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    error,
    reconnect,
  };
};

/**
 * Hook for subscribing to specific pole data
 */
export const usePoleWebSocket = (poleId: string, config?: WebSocketConfig) => {
  const [poleData, setPoleData] = useState<any>(null);
  const clientRef = useRef<Client | null>(null);

  // Use environment variable for API URL (supports both local and remote)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v1';
  const serverUrl = config?.serverUrl || API_BASE.replace('/api/v1', '');

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(`${serverUrl}/ws`) as any,

      debug: () => {},

      onConnect: () => {
        console.log(`✅ Connected to pole ${poleId}`);

        // Subscribe to specific pole
        client.subscribe(`/topic/pole/${poleId}`, (message: IMessage) => {
          const data = JSON.parse(message.body);
          setPoleData(data);
        });

        // Subscribe to pole alerts
        client.subscribe(`/topic/pole/${poleId}/alert`, (message: IMessage) => {
          const data = JSON.parse(message.body);
          console.log(`🚨 Alert for pole ${poleId}:`, data);
        });
      },
    });

    clientRef.current = client;
    client.activate();

    return () => {
      client.deactivate();
    };
  }, [poleId, serverUrl]);

  return poleData;
};
