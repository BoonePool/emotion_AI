import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SessionState } from '../types';
import { Activity, LayoutDashboard, FileText, BarChart3 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  session: SessionState;
  setSession: React.Dispatch<React.SetStateAction<SessionState>>;
}

export function Layout({ children, session }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Report', path: '/report', icon: BarChart3 },
    { name: 'Summary', path: '/summary', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
                <Activity className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-zinc-900 tracking-tight">Emotion AI</span>
            </div>
            
            <div className="hidden sm:flex space-x-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-1 pt-1 text-sm font-medium border-b-2 transition-colors",
                      isActive 
                        ? "border-rose-500 text-rose-500" 
                        : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Current Session</p>
                <p className="text-xs font-mono text-zinc-600">{session.sessionId}</p>
              </div>
              <button className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors">
                New Session
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      
      <footer className="bg-white border-t border-zinc-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-zinc-400 text-xs">© 2024 Emotion AI • Audience Analytics Dashboard</p>
        </div>
      </footer>
    </div>
  );
}
