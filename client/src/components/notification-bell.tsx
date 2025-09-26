import { useState, useEffect } from "react";
import { Bell, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Notification } from "@shared/schema";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { notifications: liveNotifications, isConnected } = useWebSocket();

  // Fetch notifications from server
  const { data: serverNotifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000 // Refresh every 30 seconds as backup
  });

  // Combine server and live notifications, removing duplicates
  const allNotifications = [
    ...liveNotifications,
    ...serverNotifications.filter(
      serverNotif => !liveNotifications.some(
        liveNotif => liveNotif.id === serverNotif.id
      )
    )
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = allNotifications.filter(n => !n.isRead).length;

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest('PUT', `/api/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest('DELETE', `/api/notifications/${notificationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleDelete = (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'success': return 'text-green-600 dark:text-green-400';
      default: return 'text-blue-600 dark:text-blue-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'violation': return '🚗';
      case 'quota_warning': return '⚠️';
      case 'system_alert': return '🔔';
      default: return '📢';
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          {/* Connection indicator */}
          <div 
            className={`absolute -bottom-1 -right-1 h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80" data-testid="dropdown-notifications">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {/* TODO: Open notification settings */}}
            data-testid="button-notification-settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {allNotifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground" data-testid="text-no-notifications">
            No notifications
          </div>
        ) : (
          <ScrollArea className="h-80">
            {allNotifications.slice(0, 20).map((notification) => (
              <div
                key={notification.id}
                className={`p-3 border-b border-border ${
                  !notification.isRead ? 'bg-muted/50' : ''
                }`}
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{getTypeIcon(notification.type)}</span>
                      <h4 className={`text-sm font-medium truncate ${getSeverityColor(notification.severity)}`}>
                        {notification.title}
                      </h4>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="h-6 w-6 p-0"
                        data-testid={`button-mark-read-${notification.id}`}
                      >
                        <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(notification.id)}
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      data-testid={`button-delete-${notification.id}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}