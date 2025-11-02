import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Video, BarChart3, Settings, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function DashboardLayout() {
  const { user, signOut, isDemoMode } = useAuth();

  const navigation = [
    { name: 'Live Feed', to: '/dashboard', icon: Video, end: true },
    { name: 'Analytics', to: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Alerts', to: '/dashboard/alerts', icon: Bell },
    { name: 'Settings', to: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="flex h-screen overflow-hidden">
        <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">People Counter</h1>
                <p className="text-slate-400 text-xs">AI System</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-700">
            <div className="mb-3 px-4">
              <p className="text-xs text-slate-500">Signed in as</p>
              <p className="text-sm text-slate-300 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition w-full"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-slate-900">
          {isDemoMode && (
            <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-6 py-3">
              <p className="text-yellow-400 text-sm">
                <strong>Demo Mode:</strong> Supabase is not configured. Data is not persisted. To enable full functionality, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env file.
              </p>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
