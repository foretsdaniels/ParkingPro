import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";

interface AppSettings {
  ocrThreshold: number;
  autoFlash: boolean;
  saveFullImages: boolean;
  defaultParkingZone: string;
}

interface SyncStatus {
  lastSyncTime?: string;
  pendingCount: number;
  isOnline: boolean;
}

interface WhitelistPlate {
  id: string;
  plateNumber: string;
  description?: string;
}

export default function SettingsView() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newPlateNumber, setNewPlateNumber] = useState("");
  const [newPlateDescription, setNewPlateDescription] = useState("");
  const [showAddPlate, setShowAddPlate] = useState(false);

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ['/api/settings'],
  });

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ['/api/sync/status'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: whitelist } = useQuery<WhitelistPlate[]>({
    queryKey: ['/api/whitelist'],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/sync/google-sheets', {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync completed",
        description: `Synced ${data.synced} entries to Google Sheets.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/status'] });
    },
    onError: (error) => {
      console.error('Sync failed:', error);
      toast({
        title: "Sync failed",
        description: "Could not sync to Google Sheets. Check your connection and API settings.",
        variant: "destructive"
      });
    }
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const response = await apiRequest('POST', '/api/settings', { key, value });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error) => {
      console.error('Failed to update setting:', error);
      toast({
        title: "Update failed",
        description: "Could not update setting.",
        variant: "destructive"
      });
    }
  });

  const addWhitelistMutation = useMutation({
    mutationFn: async (plateData: { plateNumber: string; description?: string }) => {
      const response = await apiRequest('POST', '/api/whitelist', plateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whitelist'] });
      setNewPlateNumber("");
      setNewPlateDescription("");
      setShowAddPlate(false);
      toast({
        title: "Plate added",
        description: "License plate has been added to authorized vehicles.",
      });
    },
    onError: (error) => {
      console.error('Failed to add whitelist entry:', error);
      toast({
        title: "Add failed",
        description: "Could not add license plate to whitelist.",
        variant: "destructive"
      });
    }
  });

  const deleteWhitelistMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/whitelist/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whitelist'] });
      toast({
        title: "Plate removed",
        description: "License plate has been removed from authorized vehicles.",
      });
    },
    onError: (error) => {
      console.error('Failed to delete whitelist entry:', error);
      toast({
        title: "Remove failed",
        description: "Could not remove license plate from whitelist.",
        variant: "destructive"
      });
    }
  });

  const handleBackToCamera = () => {
    setLocation('/');
  };

  const handleSettingChange = (key: string, value: any) => {
    updateSettingMutation.mutate({ key, value });
  };

  const handleAddPlate = () => {
    if (!newPlateNumber.trim()) {
      toast({
        title: "Invalid plate number",
        description: "Please enter a valid license plate number.",
        variant: "destructive"
      });
      return;
    }

    addWhitelistMutation.mutate({
      plateNumber: newPlateNumber.toUpperCase().trim(),
      description: newPlateDescription.trim() || undefined,
    });
  };

  const handleDeletePlate = (id: string) => {
    if (confirm('Remove this license plate from authorized vehicles?')) {
      deleteWhitelistMutation.mutate(id);
    }
  };

  const handleClearLocalData = () => {
    if (confirm('Clear all local data? This cannot be undone and will remove all offline entries.')) {
      localStorage.removeItem('pendingAuditEntries');
      localStorage.removeItem('currentCapture');
      toast({
        title: "Local data cleared",
        description: "All local data has been removed.",
      });
    }
  };

  const formatLastSyncTime = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background" data-testid="settings-view">
      <div className="flex flex-col h-screen">
        
        {/* Header */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <button 
              className="p-2 -ml-2 text-muted-foreground"
              onClick={handleBackToCamera}
              data-testid="button-back-to-camera"
            >
              <i className="fas fa-arrow-left text-xl"></i>
            </button>
            <h1 className="text-xl font-medium text-foreground">Settings</h1>
            <div className="w-10"></div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Sync Status */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-lg font-medium text-foreground mb-4">Sync Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Google Sheets</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 ${syncStatus?.isOnline ? 'bg-success' : 'bg-destructive'} rounded-full`}></div>
                  <span className={`text-sm font-medium ${syncStatus?.isOnline ? 'text-success' : 'text-destructive'}`}>
                    {syncStatus?.isOnline ? 'Connected' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Sync</span>
                <span className="text-sm text-foreground" data-testid="text-last-sync">
                  {formatLastSyncTime(syncStatus?.lastSyncTime)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pending Uploads</span>
                <span className="text-sm text-foreground" data-testid="text-pending-count">
                  {syncStatus?.pendingCount || 0}
                </span>
              </div>
            </div>
            <Button 
              className="w-full mt-4"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-force-sync"
            >
              {syncMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Syncing...</span>
                </div>
              ) : (
                'Force Sync Now'
              )}
            </Button>
          </div>

          {/* Whitelist Management */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-lg font-medium text-foreground mb-4">Authorized Vehicles</h3>
            <div className="space-y-3">
              {whitelist?.map((plate) => (
                <div 
                  key={plate.id} 
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  data-testid={`whitelist-entry-${plate.id}`}
                >
                  <div>
                    <span className="font-mono text-foreground">{plate.plateNumber}</span>
                    {plate.description && (
                      <div className="text-xs text-muted-foreground">{plate.description}</div>
                    )}
                  </div>
                  <button 
                    className="text-destructive hover:text-destructive/80"
                    onClick={() => handleDeletePlate(plate.id)}
                    data-testid={`button-remove-${plate.id}`}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              ))}
              {(!whitelist || whitelist.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No authorized vehicles added yet
                </p>
              )}
            </div>
            
            {!showAddPlate ? (
              <Button 
                variant="outline"
                className="w-full mt-4"
                onClick={() => setShowAddPlate(true)}
                data-testid="button-show-add-plate"
              >
                Add New Plate
              </Button>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="new-plate">License Plate Number</Label>
                  <Input
                    id="new-plate"
                    value={newPlateNumber}
                    onChange={(e) => setNewPlateNumber(e.target.value.toUpperCase())}
                    placeholder="ABC-1234"
                    className="font-mono"
                    data-testid="input-new-plate"
                  />
                </div>
                <div>
                  <Label htmlFor="plate-description">Description (Optional)</Label>
                  <Input
                    id="plate-description"
                    value={newPlateDescription}
                    onChange={(e) => setNewPlateDescription(e.target.value)}
                    placeholder="Employee, Guest, VIP, etc."
                    data-testid="input-plate-description"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddPlate(false);
                      setNewPlateNumber("");
                      setNewPlateDescription("");
                    }}
                    className="flex-1"
                    data-testid="button-cancel-add"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddPlate}
                    disabled={addWhitelistMutation.isPending}
                    className="flex-1"
                    data-testid="button-add-plate"
                  >
                    {addWhitelistMutation.isPending ? 'Adding...' : 'Add Plate'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Camera Settings */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-lg font-medium text-foreground mb-4">Camera Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Auto Flash</span>
                <Switch
                  checked={settings?.autoFlash ?? true}
                  onCheckedChange={(checked) => handleSettingChange('autoFlash', checked)}
                  data-testid="switch-auto-flash"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Save Full Images</span>
                <Switch
                  checked={settings?.saveFullImages ?? true}
                  onCheckedChange={(checked) => handleSettingChange('saveFullImages', checked)}
                  data-testid="switch-save-images"
                />
              </div>
              <div>
                <Label className="text-sm text-foreground">OCR Confidence Threshold</Label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={settings?.ocrThreshold ?? 85}
                  onChange={(e) => handleSettingChange('ocrThreshold', parseInt(e.target.value))}
                  className="w-full mt-2"
                  data-testid="slider-ocr-threshold"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>50%</span>
                  <span data-testid="text-current-threshold">{settings?.ocrThreshold ?? 85}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* App Info */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-lg font-medium text-foreground mb-4">App Information</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Version</span>
                <span className="text-sm text-foreground">1.0.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Storage Used</span>
                <span className="text-sm text-foreground">
                  {(() => {
                    const pending = localStorage.getItem('pendingAuditEntries');
                    const current = localStorage.getItem('currentCapture');
                    const sizeKb = Math.round(((pending?.length || 0) + (current?.length || 0)) / 1024);
                    return `${sizeKb} KB`;
                  })()}
                </span>
              </div>
              <Button 
                variant="destructive"
                onClick={handleClearLocalData}
                className="w-full"
                data-testid="button-clear-data"
              >
                Clear Local Data
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
