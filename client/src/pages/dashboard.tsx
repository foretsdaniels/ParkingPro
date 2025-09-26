import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Calendar, Users, Car, AlertTriangle, TrendingUp, Clock, MapPin, FileText, Trash2, Edit, RefreshCw, Download, FileSpreadsheet } from "lucide-react";
import { exportToCSV, exportToPDF, exportStatsToCSV, prepareAuditEntriesForExport, type ExportStats } from "@/lib/exportUtils";
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
  
  // Bulk operations state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  
  // Export functionality
  const handleExportCSV = () => {
    if (!recentEntries) return;
    const exportData = prepareAuditEntriesForExport(recentEntries);
    exportToCSV(exportData, 'parking_audit_entries');
    toast({
      title: "Export Complete",
      description: `${recentEntries.length} audit entries exported to CSV`,
    });
  };

  const handleExportPDF = () => {
    if (!recentEntries || !stats) return;
    const exportData = prepareAuditEntriesForExport(recentEntries);
    const exportStats: ExportStats = {
      totalScans: stats.totalScans,
      authorizedCount: stats.authorizedVehicles,
      unauthorizedCount: stats.unauthorizedVehicles,
      unknownCount: stats.totalScans - stats.authorizedVehicles - stats.unauthorizedVehicles,
      date: format(new Date(), 'MMMM d, yyyy')
    };
    exportToPDF(exportData, exportStats, 'parking_audit_report');
    toast({
      title: "Report Generated",
      description: `PDF report with ${recentEntries.length} entries created successfully`,
    });
  };

  const handleExportStats = () => {
    if (!stats) return;
    const exportStats: ExportStats = {
      totalScans: stats.totalScans,
      authorizedCount: stats.authorizedVehicles,
      unauthorizedCount: stats.unauthorizedVehicles,
      unknownCount: stats.totalScans - stats.authorizedVehicles - stats.unauthorizedVehicles,
      date: format(new Date(), 'MMMM d, yyyy')
    };
    exportStatsToCSV(exportStats, 'parking_statistics');
    toast({
      title: "Statistics Exported",
      description: "Statistics summary exported to CSV",
    });
  };

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

  // Bulk operations helpers
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedEntries(new Set());
      setIsSelectAll(false);
    } else {
      const allIds = new Set(recentEntries?.map(entry => entry.id) || []);
      setSelectedEntries(allIds);
      setIsSelectAll(true);
    }
  };

  const handleSelectEntry = (entryId: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
    setIsSelectAll(newSelected.size === recentEntries?.length);
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      return apiRequest('POST', '/api/audit-entries/bulk/delete', { entryIds });
    },
    onSuccess: (_, variables) => {
      const deletedCount = variables.length;
      queryClient.invalidateQueries({ queryKey: ['/api/audit-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      setSelectedEntries(new Set());
      setIsSelectAll(false);
      toast({
        title: "Success",
        description: `${deletedCount} entries deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete entries. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Bulk status update mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async (data: { entryIds: string[]; status: string }) => {
      return apiRequest('POST', '/api/audit-entries/bulk/status', data);
    },
    onSuccess: (_, variables) => {
      const updatedCount = variables.entryIds.length;
      queryClient.invalidateQueries({ queryKey: ['/api/audit-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      setSelectedEntries(new Set());
      setIsSelectAll(false);
      toast({
        title: "Success",
        description: `${updatedCount} entries updated to ${variables.status}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update entry status. Please try again.",
        variant: "destructive",
      });
    },
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
          {/* Audit Entries Management */}
          <Card className="col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Audit Entries Management</CardTitle>
                  <CardDescription>Manage and analyze parking audit records</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Search plates, zones..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-[200px]"
                    data-testid="input-search"
                  />
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
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      disabled={!recentEntries?.length}
                      data-testid="button-export-csv"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPDF}
                      disabled={!recentEntries?.length}
                      data-testid="button-export-pdf"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportStats}
                      disabled={!stats}
                      data-testid="button-export-stats"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Stats
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Bulk Actions Bar */}
              {selectedEntries.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">
                    {selectedEntries.size} entries selected
                  </span>
                  <div className="flex items-center space-x-2">
                    <Select onValueChange={(status) => bulkStatusMutation.mutate({ 
                      entryIds: Array.from(selectedEntries), 
                      status 
                    })}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Update Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="authorized">Mark Authorized</SelectItem>
                        <SelectItem value="unauthorized">Mark Unauthorized</SelectItem>
                        <SelectItem value="unknown">Mark Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" data-testid="button-bulk-delete">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete Selected
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Entries</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedEntries.size} audit entries? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => bulkDeleteMutation.mutate(Array.from(selectedEntries))}
                            className="bg-destructive hover:bg-destructive/90"
                            data-testid="button-confirm-delete"
                          >
                            Delete {selectedEntries.size} Entries
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </CardHeader>
            
            <CardContent>
              {entriesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                  <p className="text-muted-foreground mt-2">Loading entries...</p>
                </div>
              ) : recentEntries && recentEntries.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isSelectAll}
                            onCheckedChange={handleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>Plate Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentEntries.map((entry) => (
                        <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEntries.has(entry.id)}
                              onCheckedChange={() => handleSelectEntry(entry.id)}
                              data-testid={`checkbox-entry-${entry.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {entry.plateNumber}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={entry.authorizationStatus === 'authorized' ? 'default' : 
                                       entry.authorizationStatus === 'unauthorized' ? 'destructive' : 'secondary'}
                              data-testid={`badge-status-${entry.id}`}
                            >
                              {entry.authorizationStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.parkingZone}</TableCell>
                          <TableCell>{(entry.confidence * 100).toFixed(0)}%</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(entry.timestamp), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Button variant="ghost" size="sm" data-testid={`button-edit-${entry.id}`}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`button-delete-${entry.id}`}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the entry for plate "{entry.plateNumber}"?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => bulkDeleteMutation.mutate([entry.id])}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Car className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No audit entries found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
                </div>
              )}
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