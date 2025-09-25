import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

import CameraView from "./pages/camera-view.tsx";
import ConfirmationView from "./pages/confirmation-view.tsx";
import HistoryView from "./pages/history-view.tsx";
import SettingsView from "./pages/settings-view.tsx";
import BottomNavigation from "./components/bottom-navigation.tsx";

function Router() {
  return (
    <Switch>
      <Route path="/" component={CameraView} />
      <Route path="/confirmation" component={ConfirmationView} />
      <Route path="/history" component={HistoryView} />
      <Route path="/settings" component={SettingsView} />
      {/* Fallback to camera view */}
      <Route component={CameraView} />
    </Switch>
  );
}

// Offline indicator component
function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check pending sync count from localStorage
  useEffect(() => {
    const checkPendingSync = () => {
      const pending = localStorage.getItem('pendingAuditEntries');
      if (pending) {
        const entries = JSON.parse(pending);
        setPendingSync(Array.isArray(entries) ? entries.length : 0);
      }
    };

    checkPendingSync();
    const interval = setInterval(checkPendingSync, 5000);

    return () => clearInterval(interval);
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-4 left-4 right-4 bg-warning text-warning-foreground p-3 rounded-lg shadow-lg z-50 slide-in-bottom" data-testid="offline-indicator">
      <div className="flex items-center space-x-2">
        <i className="fas fa-wifi-slash"></i>
        <span className="font-medium">Working Offline</span>
        {pendingSync > 0 && (
          <div className="ml-auto text-sm" data-testid="pending-sync-count">
            {pendingSync} pending
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="relative min-h-screen bg-background">
          <Router />
          <BottomNavigation />
          <OfflineIndicator />
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
