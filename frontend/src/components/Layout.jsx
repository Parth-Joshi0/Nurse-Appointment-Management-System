/**
 * Main layout component with navigation.
 *
 * Provides consistent header/sidebar for all protected pages.
 * Shows flag count badge in navigation.
 */

import { Outlet, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Flag, LogOut, Heart, Bell, User } from 'lucide-react'
import { getOpenFlags } from '../api/client'
import FlagBanner from './FlagBanner'
import { format } from 'date-fns'

export default function Layout() {
  const location = useLocation()

  // Fetch open flags count for badge
  const { data: flags = [] } = useQuery({
    queryKey: ['flags', 'open'],
    queryFn: getOpenFlags,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const urgentFlags = flags.filter(
    (f) => f.priority === 'urgent' || f.priority === 'high',
  )

  const navItems = [
    { path: '/', icon: Calendar, label: 'Dashboard' },
    {
      path: '/flags',
      icon: Flag,
      label: 'Flags',
      badge: flags.length || null,
    },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Urgent flags banner */}
      {urgentFlags.length > 0 && <FlagBanner flags={urgentFlags} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-xl text-gray-900">
                  NurseCare
                </span>
                <p className="text-xs text-gray-500">
                  {format(new Date(), 'EEEE, MMMM d')}
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map(({ path, icon: Icon, label, badge }) => (
                <Link
                  key={path}
                  to={path}
                  className={`
                    relative flex items-center gap-2 px-4 py-2 rounded-xl
                    transition-all duration-200
                    ${
                      location.pathname === path
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="hidden sm:inline">{label}</span>
                  {badge && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
                      {badge}
                    </span>
                  )}
                </Link>
              ))}

              {/* Notifications */}
              <button className="relative p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors ml-2">
                <Bell className="w-5 h-5" />
                {urgentFlags.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {/* User menu */}
              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
                  onClick={() => {
                    localStorage.removeItem('auth_token')
                    window.location.href = '/login'
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">
                    Logout
                  </span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            © 2026 NurseCare. All rights reserved.
          </p>
          <p className="text-sm text-gray-400">v1.0.0</p>
        </div>
      </footer>
    </div>
  )
}
