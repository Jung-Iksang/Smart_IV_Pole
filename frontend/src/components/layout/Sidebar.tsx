import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Settings,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Users,
  Activity,
  BarChart3,
  Bell,
  FileText
} from 'lucide-react';
import { useWardStore } from '../../stores/wardStore';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getActiveAlerts } = useWardStore();
  const [collapsed, setCollapsed] = useState(true);

  const activeAlerts = getActiveAlerts();

  const navigationItems = [
    {
      id: 'overview',
      path: '/',
      label: '병동 전체',
      icon: LayoutDashboard,
      iconSize: 20
    },
    {
      id: 'patients',
      path: '/patients',
      label: '환자 목록',
      icon: Users,
      iconSize: 20
    },
    {
      id: 'devices',
      path: '/devices',
      label: 'IV 폴대',
      icon: Activity,
      iconSize: 20
    },
    {
      id: 'statistics',
      path: '/statistics',
      label: '통계/리포트',
      icon: BarChart3,
      iconSize: 20
    },
    {
      id: 'alerts',
      path: '/alerts',
      label: '알림',
      icon: Bell,
      iconSize: 20,
      badge: activeAlerts.length > 0 ? activeAlerts.length : undefined,
      disabled: true // 추후 구현 예정
    },
    {
      id: 'reports',
      path: '/reports',
      label: '보고서',
      icon: FileText,
      iconSize: 20,
      disabled: true // 추후 구현 예정
    }
  ];

  const isCurrentPage = (path: string) => {
    return location.pathname === path;
  };

  const handleNavigation = (path: string, disabled?: boolean) => {
    if (disabled) return;
    navigate(path);
  };

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} bg-slate-800 text-white flex flex-col transition-all duration-300`}>
      {/* Header with Toggle */}
      <div className="p-6 border-b border-slate-700">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img
                src="/logo/logo.png"
                alt="MEDIPOLE Logo"
                className="w-8 h-8 object-contain"
              />
              <span className="font-semibold text-lg">MEDIPOLE</span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-slate-700 transition-all duration-200 hover:shadow-md"
            title={collapsed ? '사이드바 확장' : '사이드바 축소'}
          >
            {collapsed ? (
              <ChevronRight className="w-6 h-6" />
            ) : (
              <ChevronLeft className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 flex-1">
        <div className="px-2 space-y-1">
          {navigationItems.map((item) => {
            const isCurrent = isCurrentPage(item.path);
            const isDisabled = item.disabled;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path, isDisabled)}
                disabled={isDisabled}
                className={`w-full flex items-center ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-lg transition-all duration-200 ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-lg'
                    : isDisabled
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title={collapsed ? item.label : ''}
              >
                <div className={`flex items-center justify-center ${collapsed ? '' : 'w-6 h-6'}`}>
                  <IconComponent
                    className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} ${
                      isCurrent ? 'text-white' : isDisabled ? 'text-slate-500' : ''
                    }`}
                  />
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="p-2 border-t border-slate-700">
        {/* Settings */}
        <button
          onClick={() => handleNavigation('/settings')}
          className={`w-full flex items-center ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} rounded-lg transition-all duration-200 mb-4 ${
            isCurrentPage('/settings')
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title={collapsed ? '설정' : ''}
        >
          <div className={`flex items-center justify-center ${collapsed ? '' : 'w-6 h-6'}`}>
            <Settings
              className={`${collapsed ? 'w-6 h-6' : 'w-5 h-5'} ${
                isCurrentPage('/settings') ? 'text-white' : ''
              }`}
            />
          </div>
          {!collapsed && <span className="font-medium">설정</span>}
        </button>

        {/* User Profile */}
        {!collapsed && (
          <div className="bg-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">김</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">김수연 간호사</div>
                <div className="text-xs text-slate-300">A병동 책임간호사</div>
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <button
              className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              title="김수연 간호사"
            >
              <span className="text-white font-bold">김</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;