import { Bell, Menu } from 'lucide-react';
import BleConnectButton from '../ble/BleConnectButton';

interface HeaderProps {
  onToggleSidebar?: () => void;
  userName?: string;
  wardName?: string;
}

export default function Header({ 
  onToggleSidebar, 
  userName = "이간호사",
  wardName = "3A 병동"
}: HeaderProps) {
  return (
    <header className="bg-white px-8 py-6">
      <div className="flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {userName}
            </h1>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-6">
          {/* ESP32 IV 폴 BLE 직결 (노트북 Chrome/Edge) */}
          <BleConnectButton />

          {/* Notifications */}
          <div className="relative">
            <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl relative">
              <Bell className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                1
              </span>
            </button>
          </div>

          {/* User Profile - matching the reference image */}
          <div className="w-12 h-12 rounded-full overflow-hidden ring-4 ring-cyan-100">
            <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">이</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}