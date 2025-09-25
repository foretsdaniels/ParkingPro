import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";

interface CaptureData {
  plateNumber: string;
  confidence: number;
  fullImage: string;
  plateImage: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: string;
  parkingZone: string;
}

export default function ConfirmationView() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [captureData, setCaptureData] = useState<CaptureData | null>(null);
  const [plateNumber, setPlateNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [authStatus, setAuthStatus] = useState<"authorized" | "unauthorized" | "unknown">("unknown");
  const [plateImageUploaded, setPlateImageUploaded] = useState<string | null>(null);
  const [vehicleImageUploaded, setVehicleImageUploaded] = useState<string | null>(null);

  // Load capture data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('currentCapture');
    if (stored) {
      const data = JSON.parse(stored) as CaptureData;
      setCaptureData(data);
      setPlateNumber(data.plateNumber);
    } else {
      // No capture data, redirect to camera
      setLocation('/');
    }
  }, [setLocation]);

  const createAuditEntryMutation = useMutation({
    mutationFn: async (entryData: any) => {
      const response = await apiRequest('POST', '/api/audit-entries', entryData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/audit-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      
      // Update images if uploaded
      if (plateImageUploaded || vehicleImageUploaded) {
        updateImagesMutation.mutate({
          id: data.id,
          plateImageURL: plateImageUploaded || undefined,
          vehicleImageURL: vehicleImageUploaded || undefined,
        });
      } else {
        toast({
          title: "Audit entry saved",
          description: "The parking scan has been recorded successfully.",
        });
        
        // Clear stored capture data
        localStorage.removeItem('currentCapture');
        setLocation('/');
      }
    },
    onError: (error) => {
      console.error('Failed to create audit entry:', error);
      toast({
        title: "Save failed",
        description: "Could not save the audit entry. Data saved locally for later sync.",
        variant: "destructive"
      });
      
      // Save to local storage for offline sync
      saveToLocalStorage();
    }
  });

  const updateImagesMutation = useMutation({
    mutationFn: async ({ id, plateImageURL, vehicleImageURL }: { 
      id: string; 
      plateImageURL?: string; 
      vehicleImageURL?: string; 
    }) => {
      const response = await apiRequest('PUT', `/api/audit-entries/${id}/images`, {
        plateImageURL,
        vehicleImageURL,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Audit entry saved",
        description: "The parking scan and images have been recorded successfully.",
      });
      
      // Clear stored capture data
      localStorage.removeItem('currentCapture');
      setLocation('/');
    },
    onError: (error) => {
      console.error('Failed to update images:', error);
      // Entry was saved but images failed - still show success
      toast({
        title: "Entry saved",
        description: "Audit entry saved but image upload failed. Images saved locally.",
        variant: "destructive"
      });
      setLocation('/');
    }
  });

  const saveToLocalStorage = () => {
    if (!captureData) return;
    
    const pending = localStorage.getItem('pendingAuditEntries');
    const entries = pending ? JSON.parse(pending) : [];
    
    const entryData = {
      plateNumber,
      latitude: captureData.location?.latitude,
      longitude: captureData.location?.longitude,
      location: captureData.location?.address,
      parkingZone: captureData.parkingZone,
      ocrConfidence: captureData.confidence,
      authorizationStatus: authStatus,
      notes,
      timestamp: captureData.timestamp,
      plateImage: captureData.plateImage,
      vehicleImage: captureData.fullImage,
      offlineEntry: true,
    };
    
    entries.push(entryData);
    localStorage.setItem('pendingAuditEntries', JSON.stringify(entries));
  };

  const handleSave = () => {
    if (!captureData) return;

    const entryData = {
      plateNumber,
      latitude: captureData.location?.latitude?.toString(),
      longitude: captureData.location?.longitude?.toString(),
      location: captureData.location?.address || `${captureData.location?.latitude}, ${captureData.location?.longitude}`,
      parkingZone: captureData.parkingZone,
      ocrConfidence: captureData.confidence.toString(),
      authorizationStatus: authStatus,
      notes,
    };

    createAuditEntryMutation.mutate(entryData);
  };

  const handleDiscard = () => {
    localStorage.removeItem('currentCapture');
    setLocation('/');
  };

  const handleBackToCamera = () => {
    setLocation('/');
  };

  const getUploadParameters = async () => {
    const response = await apiRequest('POST', '/api/objects/upload', {});
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handlePlateImageUpload = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      setPlateImageUploaded(result.successful[0].uploadURL as string);
    }
  };

  const handleVehicleImageUpload = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      setVehicleImageUploaded(result.successful[0].uploadURL as string);
    }
  };

  if (!captureData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading capture data...</p>
        </div>
      </div>
    );
  }

  // Determine auth status color and text
  const getAuthStatusDisplay = () => {
    switch (authStatus) {
      case 'authorized':
        return { color: 'bg-success', text: 'Authorized' };
      case 'unauthorized':
        return { color: 'bg-destructive', text: 'Unauthorized' };
      default:
        return { color: 'bg-warning', text: 'Unknown' };
    }
  };

  const authStatusDisplay = getAuthStatusDisplay();

  return (
    <div className="min-h-screen bg-background" data-testid="confirmation-view">
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
            <h1 className="text-xl font-medium text-foreground">Confirm Scan</h1>
            <div className="w-10"></div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Captured Images */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-lg font-medium text-foreground mb-4">Captured Images</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">License Plate</p>
                <img 
                  src={captureData.plateImage} 
                  alt="Captured license plate" 
                  className="w-full h-24 object-cover rounded border"
                  data-testid="img-plate-capture"
                />
                <div className="mt-2">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={5242880} // 5MB
                    onGetUploadParameters={getUploadParameters}
                    onComplete={handlePlateImageUpload}
                    buttonClassName="w-full text-xs"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <i className="fas fa-upload text-xs"></i>
                      <span>Upload Plate</span>
                    </div>
                  </ObjectUploader>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Full Vehicle</p>
                <img 
                  src={captureData.fullImage} 
                  alt="Full vehicle photo" 
                  className="w-full h-24 object-cover rounded border"
                  data-testid="img-vehicle-capture"
                />
                <div className="mt-2">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={5242880} // 5MB
                    onGetUploadParameters={getUploadParameters}
                    onComplete={handleVehicleImageUpload}
                    buttonClassName="w-full text-xs"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <i className="fas fa-upload text-xs"></i>
                      <span>Upload Vehicle</span>
                    </div>
                  </ObjectUploader>
                </div>
              </div>
            </div>
          </div>

          {/* License Plate Data */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-lg font-medium text-foreground mb-4">License Plate Information</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="plate-number">Detected Plate Number</Label>
                <Input
                  id="plate-number"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  className="text-lg font-mono mt-1"
                  data-testid="input-plate-number"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>OCR Confidence</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div 
                        className="bg-success h-2 rounded-full" 
                        style={{ width: `${captureData.confidence}%` }}
                        data-testid="confidence-bar"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground" data-testid="confidence-percentage">
                      {Math.round(captureData.confidence)}%
                    </span>
                  </div>
                </div>
                <div>
                  <Label>Authorization Status</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`w-3 h-3 ${authStatusDisplay.color} rounded-full`}></div>
                    <span className={`text-sm font-medium ${authStatus === 'authorized' ? 'text-success' : authStatus === 'unauthorized' ? 'text-destructive' : 'text-warning'}`}>
                      {authStatusDisplay.text}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Location & Time Data */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-lg font-medium text-foreground mb-4">Location & Time</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Timestamp</span>
                <span className="text-sm text-foreground font-medium" data-testid="text-timestamp">
                  {new Date(captureData.timestamp).toLocaleString()}
                </span>
              </div>
              {captureData.location && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">GPS Location</span>
                  <span className="text-sm text-foreground font-mono" data-testid="text-gps-coords">
                    {captureData.location.latitude.toFixed(4)}, {captureData.location.longitude.toFixed(4)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Parking Zone</span>
                <span className="text-sm text-foreground" data-testid="text-parking-zone">
                  {captureData.parkingZone}
                </span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-card rounded-lg border border-border p-4">
            <Label htmlFor="notes" className="text-lg font-medium text-foreground">Additional Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 h-20 resize-none"
              placeholder="Add any additional observations or notes..."
              data-testid="textarea-notes"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-card border-t border-border">
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={handleDiscard} 
              className="flex-1"
              disabled={createAuditEntryMutation.isPending || updateImagesMutation.isPending}
              data-testid="button-discard"
            >
              Discard
            </Button>
            <Button 
              onClick={handleSave} 
              className="flex-1"
              disabled={createAuditEntryMutation.isPending || updateImagesMutation.isPending || !plateNumber.trim()}
              data-testid="button-save"
            >
              {createAuditEntryMutation.isPending || updateImagesMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                'Save Entry'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
