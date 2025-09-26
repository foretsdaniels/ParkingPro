import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Filter, X, Search, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";

export interface AdvancedFilterOptions {
  searchQuery: string;
  status: string;
  dateRange: {
    from?: Date;
    to?: Date;
  } | null;
  zone: string;
  confidenceRange: {
    min: number;
    max: number;
  };
  location: string;
}

interface AdvancedFiltersProps {
  filters: AdvancedFilterOptions;
  onFiltersChange: (filters: AdvancedFilterOptions) => void;
  onReset: () => void;
}

export function AdvancedFilters({ filters, onFiltersChange, onReset }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<{ from?: Date; to?: Date } | undefined>(filters.dateRange || undefined);

  // Sync date state when filters are reset
  useEffect(() => {
    setDate(filters.dateRange || undefined);
  }, [filters.dateRange]);

  const handleFilterChange = (key: keyof AdvancedFilterOptions, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleDateRangeChange = (newDate: { from?: Date; to?: Date } | undefined) => {
    setDate(newDate);
    handleFilterChange('dateRange', newDate);
  };

  const activeFilterCount = [
    filters.searchQuery && filters.searchQuery.length > 0,
    filters.status && filters.status !== 'all',
    filters.dateRange?.from || filters.dateRange?.to,
    filters.zone && filters.zone !== 'all',
    filters.confidenceRange.min > 0 || filters.confidenceRange.max < 100,
    filters.location && filters.location.length > 0
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="flex items-center space-x-2">
      {/* Quick Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search plates, zones, locations..."
          value={filters.searchQuery}
          onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
          className="pl-10 w-[250px]"
          data-testid="input-search-advanced"
        />
      </div>

      {/* Status Filter */}
      <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
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

      {/* Advanced Filters Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" data-testid="button-advanced-filters">
            <Filter className="h-4 w-4 mr-2" />
            Advanced
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
            <DialogDescription>
              Refine your search with detailed filtering options
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        `${format(date.from, "MMM d, yyyy")} - ${format(date.to, "MMM d, yyyy")}`
                      ) : (
                        format(date.from, "MMM d, yyyy")
                      )
                    ) : (
                      "Select date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={date as any}
                    onSelect={handleDateRangeChange}
                    numberOfMonths={2}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Zone Filter */}
            <div className="space-y-2">
              <Label>Parking Zone</Label>
              <Select value={filters.zone} onValueChange={(value) => handleFilterChange('zone', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="Zone A">Zone A</SelectItem>
                  <SelectItem value="Zone B">Zone B</SelectItem>
                  <SelectItem value="Zone C">Zone C</SelectItem>
                  <SelectItem value="Test Zone">Test Zone</SelectItem>
                  <SelectItem value="VIP Zone">VIP Zone</SelectItem>
                  <SelectItem value="Staff Zone">Staff Zone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Confidence Range */}
            <div className="space-y-2">
              <Label>Confidence Range (%)</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  placeholder="Min"
                  min="0"
                  max="100"
                  value={filters.confidenceRange.min}
                  onChange={(e) => handleFilterChange('confidenceRange', { 
                    ...filters.confidenceRange, 
                    min: parseInt(e.target.value) || 0 
                  })}
                  className="w-20"
                />
                <span>-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  min="0"
                  max="100"
                  value={filters.confidenceRange.max}
                  onChange={(e) => handleFilterChange('confidenceRange', { 
                    ...filters.confidenceRange, 
                    max: parseInt(e.target.value) || 100 
                  })}
                  className="w-20"
                />
              </div>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <Label>Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Enter location or address..."
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Time Range Quick Filters */}
            <div className="space-y-2 col-span-2">
              <Label>Quick Time Filters</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    handleDateRangeChange({ from: today, to: today });
                  }}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    handleDateRangeChange({ from: yesterday, to: yesterday });
                  }}
                >
                  Yesterday
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    handleDateRangeChange({ from: weekAgo, to: today });
                  }}
                >
                  Last 7 days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    handleDateRangeChange({ from: monthAgo, to: today });
                  }}
                >
                  Last 30 days
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onReset}>
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            <Button onClick={() => setIsOpen(false)}>
              Apply Filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-4 w-4 mr-1" />
          Clear ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}

export const defaultFilters: AdvancedFilterOptions = {
  searchQuery: '',
  status: 'all',
  dateRange: null,
  zone: 'all',
  confidenceRange: { min: 0, max: 100 },
  location: ''
};