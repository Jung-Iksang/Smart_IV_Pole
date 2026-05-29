import React from 'react';
import { Bell, ChevronRight, Download } from 'lucide-react';
import { LogoFull } from '../config/branding';

const NurseDashboard = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 text-white">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <LogoFull size="md" />
        </div>

        {/* Navigation */}
        <nav className="mt-6">
          <div className="px-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
              <div className="w-5 h-5 bg-blue-400 rounded-sm flex items-center justify-center">
                <span className="text-xs">📊</span>
              </div>
              <span>Dashboard</span>
            </div>
            <div className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg cursor-pointer">
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-xs">📋</span>
              </div>
              <span>Patient List</span>
            </div>
            <div className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg cursor-pointer">
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-xs">🏥</span>
              </div>
              <span>IV Poles</span>
            </div>
            <div className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg cursor-pointer">
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-xs">📈</span>
              </div>
              <span>Monitoring</span>
            </div>
            <div className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg cursor-pointer">
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-xs">🔔</span>
              </div>
              <span>Alerts</span>
            </div>
            <div className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg cursor-pointer">
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="text-xs">📝</span>
              </div>
              <span>Reports</span>
            </div>
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg cursor-pointer">
            <div className="w-5 h-5 flex items-center justify-center">
              <span className="text-xs">⚙️</span>
            </div>
            <span>Settings</span>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-10 h-10 bg-gray-400 rounded-full overflow-hidden">
              <img src="/api/placeholder/40/40" alt="Nurse" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">간호사 김수연</div>
              <div className="text-xs text-slate-400">kim@hospital.com</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">안녕하세요, 김수연 간호사님</h1>
            <p className="text-gray-600 mt-1">오늘의 IV 모니터링 현황을 확인하세요</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Bell className="w-6 h-6 text-gray-600" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Content */}
          <div className="col-span-8">
            {/* Status Cards */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              {/* IV Fluid Level */}
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-xl">💧</span>
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">IV Fluid Level</h3>
                <div className="text-2xl font-bold text-gray-900 mb-1">750/1000</div>
                <div className="text-xs text-red-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span>하루 평균보다 높음</span>
                </div>
              </div>

              {/* Flow Rate */}
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-xl">💓</span>
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Flow Rate</h3>
                <div className="text-2xl font-bold text-gray-900 mb-1">45 mL/h</div>
                <div className="text-xs text-red-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span>처방량보다 낮음</span>
                </div>
              </div>

              {/* Battery Level */}
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-xl">🔋</span>
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Battery Level</h3>
                <div className="text-2xl font-bold text-gray-900 mb-1">85%</div>
                <div className="text-xs text-green-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>정상 범위</span>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-2 gap-6">
              {/* IV Flow Trend */}
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">IV 유량 변화</h3>
                  <span className="text-sm text-gray-500">마지막 업데이트: 2025년 8월 17일</span>
                </div>
                
                {/* Mock Chart Area */}
                <div className="h-48 relative">
                  <div className="absolute inset-0 flex items-end justify-between px-4">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400">
                      <span>60</span>
                      <span>40</span>
                      <span>20</span>
                      <span>0</span>
                    </div>
                    
                    {/* Chart bars and line */}
                    <div className="ml-8 flex-1 h-full relative">
                      {/* Background grid */}
                      <div className="absolute inset-0 flex flex-col justify-between">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="border-t border-gray-100"></div>
                        ))}
                      </div>
                      
                      {/* Bars */}
                      <div className="absolute bottom-0 left-0 w-full h-full flex items-end justify-between">
                        <div className="w-8 bg-blue-200 h-3/4 rounded-t"></div>
                        <div className="w-8 bg-blue-300 h-4/5 rounded-t"></div>
                        <div className="w-8 bg-blue-400 h-2/3 rounded-t"></div>
                        <div className="w-8 bg-blue-500 h-5/6 rounded-t"></div>
                        <div className="w-8 bg-red-400 h-3/5 rounded-t"></div>
                        <div className="w-8 bg-red-500 h-4/6 rounded-t"></div>
                        <div className="w-8 bg-red-600 h-1/2 rounded-t"></div>
                      </div>
                      
                      {/* Trend line overlay */}
                      <svg className="absolute inset-0 w-full h-full">
                        <path
                          d="M 20 120 Q 60 100 100 80 T 180 60 T 260 100"
                          stroke="#3B82F6"
                          strokeWidth="3"
                          fill="none"
                          className="drop-shadow-sm"
                        />
                        <circle cx="100" cy="80" r="4" fill="#3B82F6" />
                        <text x="85" y="75" className="text-xs fill-gray-600">45ml 낮음</text>
                      </svg>
                    </div>
                    
                    {/* X-axis labels */}
                    <div className="absolute bottom-0 left-8 right-0 flex justify-between text-xs text-gray-400">
                      <span>월</span>
                      <span>화</span>
                      <span>수</span>
                      <span>목</span>
                      <span>금</span>
                      <span>토</span>
                      <span>일</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pressure Monitor */}
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">압력 모니터</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">시스템 압력</span>
                    <span className="text-2xl font-bold">120 mmHg</span>
                  </div>
                  <div className="text-xs text-red-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    <span>평균보다 높음</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-2 gap-6 mt-6">
              {/* Active Alerts */}
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">활성 알림</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xs">D40.8</span>
                      <span className="text-sm">IV 수액 부족</span>
                    </div>
                    <span className="text-sm text-gray-500">04-10-2021</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xs">처방</span>
                      <span className="text-sm">유량 조절 필요</span>
                    </div>
                    <span className="text-sm text-gray-500">현재</span>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">문서</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        <span className="text-blue-600 text-xs">📄</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium">투여 기록.pdf</div>
                        <div className="text-xs text-gray-500">1 MB</div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-gray-400 cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        <span className="text-blue-600 text-xs">📄</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium">모니터링 로그.pdf</div>
                        <div className="text-xs text-gray-500">1 MB</div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-gray-400 cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-4">
            {/* Patient Profile */}
            <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-cyan-100 rounded-full mx-auto mb-4 overflow-hidden border-4 border-cyan-400">
                  <img src="/api/placeholder/96/96" alt="Patient" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">김민지 환자</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-cyan-500">♀</span>
                    <span className="text-sm text-gray-600">성별</span>
                  </div>
                  <div className="font-semibold">여성</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-cyan-500">👤</span>
                    <span className="text-sm text-gray-600">나이</span>
                  </div>
                  <div className="font-semibold">28세</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-cyan-500">📏</span>
                    <span className="text-sm text-gray-600">키</span>
                  </div>
                  <div className="font-semibold">165 cm</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-cyan-500">⚖️</span>
                    <span className="text-sm text-gray-600">몸무게</span>
                  </div>
                  <div className="font-semibold">55 kg</div>
                </div>
              </div>
              
              <button className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                모든 정보 보기
              </button>
            </div>

            {/* Alert History */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">알림 이력</h3>
                <button className="text-sm text-gray-500 flex items-center gap-1">
                  모두 보기 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 text-xs">🏥</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">정기 점검</div>
                    <div className="text-xs text-gray-500">8월 15일 - 오전 9:30</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                
                <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                    <span className="text-green-600 text-xs">✅</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">수액 교체 완료</div>
                    <div className="text-xs text-gray-500">8월 12일 - 오후 3:00</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                
                <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                    <span className="text-orange-600 text-xs">💬</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">환자 호출</div>
                    <div className="text-xs text-gray-500">8월 10일 - 오전 8:50</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                
                <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 text-xs">📹</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">화상 상담</div>
                    <div className="text-xs text-gray-500">진행 중</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NurseDashboard;