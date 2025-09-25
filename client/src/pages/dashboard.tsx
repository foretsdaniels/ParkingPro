import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Calendar, Users, Car, AlertTriangle, TrendingUp, Clock, MapPin, FileText } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, subWeeks, subMonths } from "date-fns";

interface AuditEntry {
  id: string;
  plateNumber: string;
  authorizationStatus: "authorized" | "unauthorized" | "unknown";
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  parkingZone: string;
  timestamp: string;
  confidence: number;
  plateImagePath?: string;
  vehicleImagePath?: string;
  notes?: string;
  syncedToGoogleSheets: boolean;
}

interface DashboardStats {
  totalScans: number;
  authorizedVehicles: number;
  unauthorizedVehicles: number;
  recentActivity: number;
  avgConfidence: number;
  topZones: Array<{ zone: string; count: number }>;
  dailyTrends: Array<{ date: string; scans: number; authorized: number; unauthorized: number }>;
  hourlyDistribution: Array<{ hour: number; scans: number }>;
}

export default function DesktopDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/stats', selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/stats?period=${selectedPeriod}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch recent audit entries
  const { data: recentEntries, isLoading: entriesLoading } = useQuery<AuditEntry[]>({
    queryKey: ['/api/audit-entries', { search: searchQuery, status: statusFilter, limit: 10 }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '10',
        page: '1'
      });
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/audit-entries?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch entries');
      const data = await response.json();
      return data.entries || [];
    },
    refetchInterval: 30000
  });

  // Sync mutation
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
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-entries'] });
    },
    onError: (error) => {
      toast({
        title: "Sync failed",
        description: "Could not sync to Google Sheets. Check your connection.",
        variant: "destructive"
      });
    }
  });

  // Chart colors
  const chartColors = {
    authorized: '#22c55e',
    unauthorized: '#ef4444',
    unknown: '#6b7280',
    primary: '#3b82f6'
  };

  // Format time period data
  const getPeriodData = () => {
    if (!stats?.dailyTrends) return [];
    
    return stats.dailyTrends.map(item => ({
      ...item,
      date: format(new Date(item.date), 'MMM dd')
    }));
  };

  // Get authorization status distribution
  const getStatusDistribution = () => [
    { name: 'Authorized', value: stats?.authorizedVehicles || 0, color: chartColors.authorized },
    { name: 'Unauthorized', value: stats?.unauthorizedVehicles || 0, color: chartColors.unauthorized },
    { name: 'Unknown', value: (stats?.totalScans || 0) - (stats?.authorizedVehicles || 0) - (stats?.unauthorizedVehicles || 0), color: chartColors.unknown }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="desktop-dashboard">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">ParkAudit Pro Dashboard</h1>
              <p className="text-muted-foreground">Comprehensive parking lot audit management</p>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1day">Last 24 hours</SelectItem>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 3 months</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="button-sync"
              >
                {syncMutation.isPending ? 'Syncing...' : 'Sync to Sheets'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6 space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-scans">
                {statsLoading ? '...' : (stats?.totalScans || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                +{stats?.recentActivity || 0} in last 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Authorized</CardTitle>
              <Users className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success" data-testid="stat-authorized">
                {statsLoading ? '...' : (stats?.authorizedVehicles || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.totalScans ? Math.round((stats.authorizedVehicles / stats.totalScans) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unauthorized</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="stat-unauthorized">
                {statsLoading ? '...' : (stats?.unauthorizedVehicles || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.totalScans ? Math.round((stats.unauthorizedVehicles / stats.totalScans) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-confidence">
                {statsLoading ? '...' : Math.round(stats?.avgConfidence || 0)}%
              </div>
              <p className="text-xs text-muted-foreground">
                OCR accuracy rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Scan Activity Trends</CardTitle>
              <CardDescription>
                Daily breakdown of authorized vs unauthorized scans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getPeriodData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="authorized" stackId="a" fill={chartColors.authorized} name="Authorized" />
                    <Bar dataKey="unauthorized" stackId="a" fill={chartColors.unauthorized} name="Unauthorized" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Authorization Status Distribution</CardTitle>
              <CardDescription>
                Breakdown of vehicle authorization status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getStatusDistribution()}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {getStatusDistribution().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity and Top Zones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Entries */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Scan Activity</CardTitle>
                  <CardDescription>Latest parking lot scans</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="authorized">Authorized</SelectItem>
                      <SelectItem value="unauthorized">Unauthorized</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {entriesLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  </div>
                ) : recentEntries && recentEntries.length > 0 ? (
                  recentEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="font-mono text-sm font-medium">
                          {entry.plateNumber}
                        </div>
                        <Badge 
                          variant={entry.authorizationStatus === 'authorized' ? 'default' : 
                                   entry.authorizationStatus === 'unauthorized' ? 'destructive' : 'secondary'}
                        >
                          {entry.authorizationStatus}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{entry.parkingZone}</span>
                        <Clock className="h-3 w-3 ml-2" />
                        <span>{format(new Date(entry.timestamp), 'MMM dd, HH:mm')}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    No recent scan activity
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Parking Zones */}
          <Card>
            <CardHeader>
              <CardTitle>Top Parking Zones</CardTitle>
              <CardDescription>Most frequently scanned areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.topZones && stats.topZones.length > 0 ? (
                  stats.topZones.map((zone, index) => (
                    <div key={zone.zone} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium">{zone.zone}</span>
                      </div>
                      <Badge variant="outline">{zone.count} scans</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-muted-foreground">
                    No zone data available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}