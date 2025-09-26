import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';

export interface ExportableAuditEntry {
  id: string;
  plateNumber: string;
  status: string;
  zone: string;
  confidence: string;
  timestamp: string;
  location?: string;
  notes?: string;
}

export interface ExportStats {
  totalScans: number;
  authorizedCount: number;
  unauthorizedCount: number;
  unknownCount: number;
  date: string;
}

// Export audit entries to CSV
export function exportToCSV(data: ExportableAuditEntry[], filename: string = 'audit_entries') {
  const csvData = data.map(entry => ({
    'Entry ID': entry.id,
    'Plate Number': entry.plateNumber,
    'Status': entry.status,
    'Zone': entry.zone,
    'Confidence': entry.confidence,
    'Timestamp': entry.timestamp,
    'Location': entry.location || 'N/A',
    'Notes': entry.notes || ''
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export audit entries to PDF
export function exportToPDF(data: ExportableAuditEntry[], stats: ExportStats, filename: string = 'audit_report') {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('ParkAudit Pro - Audit Report', 20, 20);
  
  // Date and stats
  doc.setFontSize(12);
  doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 20, 35);
  doc.text(`Report Period: ${stats.date}`, 20, 45);
  
  // Summary statistics
  doc.setFontSize(14);
  doc.text('Summary Statistics:', 20, 60);
  doc.setFontSize(11);
  doc.text(`Total Scans: ${stats.totalScans}`, 20, 70);
  doc.text(`Authorized: ${stats.authorizedCount}`, 20, 80);
  doc.text(`Unauthorized: ${stats.unauthorizedCount}`, 20, 90);
  doc.text(`Unknown: ${stats.unknownCount}`, 20, 100);
  
  // Table data
  const tableData = data.map(entry => [
    entry.id,
    entry.plateNumber,
    entry.status.charAt(0).toUpperCase() + entry.status.slice(1),
    entry.zone,
    entry.confidence,
    new Date(entry.timestamp).toLocaleDateString()
  ]);

  // Create table
  autoTable(doc, {
    head: [['Entry ID', 'Plate Number', 'Status', 'Zone', 'Confidence', 'Date']],
    body: tableData,
    startY: 115,
    theme: 'striped',
    headStyles: { fillColor: [51, 122, 183] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 115 },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  // Save the PDF
  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Export statistics summary to CSV
export function exportStatsToCSV(stats: ExportStats, filename: string = 'audit_statistics') {
  const statsData = [{
    'Report Date': stats.date,
    'Total Scans': stats.totalScans,
    'Authorized': stats.authorizedCount,
    'Unauthorized': stats.unauthorizedCount,
    'Unknown': stats.unknownCount,
    'Authorization Rate': `${((stats.authorizedCount / stats.totalScans) * 100).toFixed(1)}%`,
    'Generated': new Date().toISOString()
  }];

  const csv = Papa.unparse(statsData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Prepare audit entries for export (format data)
export function prepareAuditEntriesForExport(entries: any[]): ExportableAuditEntry[] {
  return entries.map(entry => ({
    id: entry.id,
    plateNumber: entry.plateNumber,
    status: entry.status,
    zone: entry.zone || 'Unknown',
    confidence: entry.confidence ? `${entry.confidence}%` : 'N/A',
    timestamp: new Date(entry.timestamp).toLocaleString(),
    location: entry.location,
    notes: entry.notes
  }));
}