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
import LoginPage from "./pages/login.tsx";
import RegisterPage from "./pages/register.tsx";
import BottomNavigation from "./components/bottom-navigation.tsx";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

// Authentication checker component
function AuthRouter() {
  const [location, setLocation] = useLocation();
  
  // Check authentication status
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
    refetchOnWindowFocus: false
  });

  const isAuthenticated = Boolean(user?.user);
  const isAuthPage = location === '/login' || location === '/register';
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not on auth page, redirect to login
  if (!isAuthenticated && !isAuthPage) {
    return <LoginPage />;
  }

  // If authenticated and on auth page, redirect to camera
  if (isAuthenticated && isAuthPage) {
    setLocation('/camera');
    return null;
  }

  // Render appropriate content based on auth status
  if (!isAuthenticated && isAuthPage) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  // Authenticated user routes
  return (
    <>
      <Switch>
        <Route path="/" component={CameraView} />
        <Route path="/camera" component={CameraView} />
        <Route path="/confirmation" component={ConfirmationView} />
        <Route path="/history" component={HistoryView} />
        <Route path="/settings" component={SettingsView} />
        {/* Fallback to camera view */}
        <Route component={CameraView} />
      </Switch>
      <BottomNavigation />
    </>
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
          <AuthRouter />
          <OfflineIndicator />
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
