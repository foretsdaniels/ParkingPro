import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AuditEntry {
  id: string;
  plateNumber: string;
  authorizationStatus: "authorized" | "unauthorized" | "unknown";
  timestamp: string;
  location?: string;
  parkingZone?: string;
  plateImagePath?: string;
  vehicleImagePath?: string;
  notes?: string;
  ocrConfidence?: number;
}

interface AuditStats {
  totalScans: number;
  authorizedCount: number;
  unauthorizedCount: number;
  unknownCount: number;
}

export default function HistoryView() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery<AuditStats>({
    queryKey: ['/api/stats'],
  });

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['/api/audit-entries', page, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm })
      });
      
      const response = await fetch(`/api/audit-entries?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch audit entries');
      }
      
      return response.json();
    },
  });

  // Reset page when search term changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const handleBackToCamera = () => {
    setLocation('/');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'authorized':
        return 'bg-success';
      case 'unauthorized':
        return 'bg-destructive';
      default:
        return 'bg-warning';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleLoadMore = () => {
    if (historyData?.hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const entries = historyData?.entries || [];

  return (
    <div className="min-h-screen bg-background" data-testid="history-view">
      <div className="flex flex-col h-screen">
        
        {/* Header with Search */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <button 
              className="p-2 -ml-2 text-muted-foreground"
              onClick={handleBackToCamera}
              data-testid="button-back-to-camera"
            >
              <i className="fas fa-arrow-left text-xl"></i>
            </button>
            <h1 className="text-xl font-medium text-foreground">Audit History</h1>
            <button className="p-2 text-muted-foreground" data-testid="button-filter">
              <i className="fas fa-filter text-lg"></i>
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search by license plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3"
              data-testid="input-search"
            />
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></i>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="p-4 bg-muted">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground" data-testid="stat-total-scans">
                {stats?.totalScans || 0}
              </div>
              <div className="text-sm text-muted-foreground">Total Scans</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success" data-testid="stat-authorized">
                {stats?.authorizedCount || 0}
              </div>
              <div className="text-sm text-muted-foreground">Authorized</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning" data-testid="stat-unknown">
                {stats?.unknownCount || 0}
              </div>
              <div className="text-sm text-muted-foreground">Unknown</div>
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading audit history...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center">
              <i className="fas fa-search text-4xl text-muted-foreground mb-4"></i>
              <h3 className="text-lg font-medium text-foreground mb-2">No Results Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try a different search term' : 'No audit entries recorded yet'}
              </p>
            </div>
          ) : (
            <>
              {entries.map((entry: AuditEntry) => (
                <div 
                  key={entry.id} 
                  className="p-4 border-b border-border bg-card"
                  data-testid={`entry-${entry.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {/* Vehicle thumbnail */}
                      {entry.vehicleImagePath ? (
                        <img 
                          src={entry.vehicleImagePath} 
                          alt="Vehicle thumbnail" 
                          className="w-16 h-12 object-cover rounded"
                          data-testid={`img-vehicle-${entry.id}`}
                        />
                      ) : (
                        <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                          <i className="fas fa-car text-muted-foreground"></i>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span 
                            className="text-lg font-mono font-medium text-foreground"
                            data-testid={`plate-number-${entry.id}`}
                          >
                            {entry.plateNumber}
                          </span>
                          <div 
                            className={`w-3 h-3 ${getStatusColor(entry.authorizationStatus)} rounded-full`}
                            data-testid={`status-indicator-${entry.id}`}
                          />
                        </div>
                        <div 
                          className="text-sm text-muted-foreground mb-1"
                          data-testid={`timestamp-${entry.id}`}
                        >
                          {formatTimestamp(entry.timestamp)}
                        </div>
                        <div 
                          className="text-sm text-muted-foreground"
                          data-testid={`location-${entry.id}`}
                        >
                          {entry.parkingZone || entry.location || 'Unknown Location'}
                        </div>
                        {entry.ocrConfidence && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Confidence: {Math.round(entry.ocrConfidence)}%
                          </div>
                        )}
                      </div>
                    </div>
                    <button className="p-2 text-muted-foreground" data-testid={`button-details-${entry.id}`}>
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              ))}

              {/* Load More Button */}
              {historyData?.hasMore && (
                <div className="p-4 text-center">
                  <Button 
                    variant="outline"
                    onClick={handleLoadMore}
                    data-testid="button-load-more"
                  >
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
