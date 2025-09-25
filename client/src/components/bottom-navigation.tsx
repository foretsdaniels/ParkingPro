import { useLocation } from "wouter";

export default function BottomNavigation() {
  const [location, setLocation] = useLocation();

  const isActive = (path: string) => {
    return location === path;
  };

  const navigationItems = [
    {
      path: '/',
      icon: 'fas fa-camera',
      label: 'Scan',
      testId: 'nav-scan'
    },
    {
      path: '/history',
      icon: 'fas fa-history', 
      label: 'History',
      testId: 'nav-history'
    },
    {
      path: '/settings',
      icon: 'fas fa-cog',
      label: 'Settings',
      testId: 'nav-settings'
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40" data-testid="bottom-navigation">
      <div className="flex items-center justify-around py-2">
        {navigationItems.map((item) => (
          <button
            key={item.path}
            className={`flex flex-col items-center py-2 px-4 transition-colors ${
              isActive(item.path) 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setLocation(item.path)}
            data-testid={item.testId}
          >
            <i className={`${item.icon} text-xl mb-1`}></i>
            <span className={`text-xs ${isActive(item.path) ? 'font-medium' : ''}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
