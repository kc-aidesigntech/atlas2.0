/**
 * Export Utilities for ATLAS
 * Handles PDF and Excel export functionality
 */

import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ============================================================================
// PDF EXPORT FUNCTIONS
// ============================================================================

/**
 * Export enrollee list to PDF
 * @param {Array} enrollees - Array of enrollee objects
 * @param {string} title - Report title
 */
export function exportEnrolleesToPDF(enrollees, title = 'ATLAS Enrollee Report') {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(18)
  doc.text(title, 14, 22)
  
  doc.setFontSize(11)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)
  doc.text(`Total Enrollees: ${enrollees.length}`, 14, 36)
  
  // Table data
  const tableData = enrollees.map(enrollee => [
    `${enrollee.demographics?.firstName || ''} ${enrollee.demographics?.lastName || ''}`,
    enrollee.demographics?.dob || 'N/A',
    `Tier ${enrollee.riskProfile?.tier || 'N/A'}`,
    enrollee.riskProfile?.zCodes?.length || 0,
    enrollee.careTeam?.length || 0
  ])
  
  // Generate table
  doc.autoTable({
    head: [['Name', 'DOB', 'Risk Tier', 'Z-Codes', 'Care Team Size']],
    body: tableData,
    startY: 42,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [14, 165, 233] }, // Sky blue
    alternateRowStyles: { fillColor: [241, 245, 249] } // Light gray
  })
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(10)
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }
  
  // Save
  doc.save(`atlas-enrollees-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Export dashboard analytics to PDF
 * @param {object} analytics - Analytics data object
 */
export function exportDashboardAnalyticsToPDF(analytics) {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(20)
  doc.text('ATLAS Dashboard Analytics', 14, 22)
  
  doc.setFontSize(11)
  doc.text(`Report Generated: ${new Date().toLocaleString()}`, 14, 30)
  
  // Summary Statistics
  doc.setFontSize(14)
  doc.text('Summary Statistics', 14, 45)
  
  const summaryData = [
    ['Total Enrollees', analytics.totalEnrollees || 0],
    ['Active Referrals', analytics.activeReferrals || 0],
    ['Tier 1 (Low Risk)', analytics.tier1Count || 0],
    ['Tier 2 (Moderate Risk)', analytics.tier2Count || 0],
    ['Tier 3 (High Risk)', analytics.tier3Count || 0],
    ['Average Wellness Score', `${analytics.avgWellnessScore || 0}/100`]
  ]
  
  doc.autoTable({
    body: summaryData,
    startY: 50,
    theme: 'grid',
    styles: { fontSize: 11 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249] },
      1: { halign: 'right' }
    }
  })
  
  // Wellness Dimensions
  if (analytics.wellnessDimensions) {
    doc.addPage()
    doc.setFontSize(14)
    doc.text('Wellness Dimensions (Average Scores)', 14, 22)
    
    const dimensionData = Object.entries(analytics.wellnessDimensions).map(([dim, score]) => [
      dim.charAt(0).toUpperCase() + dim.slice(1),
      `${Math.round(score)}/100`,
      getWellnessLevel(score)
    ])
    
    doc.autoTable({
      head: [['Dimension', 'Score', 'Level']],
      body: dimensionData,
      startY: 28,
      headStyles: { fillColor: [14, 165, 233] }
    })
  }
  
  // Risk Distribution Chart (text-based)
  if (analytics.riskDistribution) {
    const currentY = doc.lastAutoTable.finalY + 15
    doc.setFontSize(14)
    doc.text('Risk Distribution', 14, currentY)
    
    const riskData = [
      ['Tier 1 (Low)', analytics.riskDistribution.tier1 || 0, `${analytics.riskDistribution.tier1Percent || 0}%`],
      ['Tier 2 (Moderate)', analytics.riskDistribution.tier2 || 0, `${analytics.riskDistribution.tier2Percent || 0}%`],
      ['Tier 3 (High)', analytics.riskDistribution.tier3 || 0, `${analytics.riskDistribution.tier3Percent || 0}%`]
    ]
    
    doc.autoTable({
      head: [['Risk Tier', 'Count', 'Percentage']],
      body: riskData,
      startY: currentY + 5,
      headStyles: { fillColor: [14, 165, 233] }
    })
  }
  
  // Save
  doc.save(`atlas-analytics-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Export assessment timeline to PDF
 * @param {object} enrollee - Enrollee object
 * @param {Array} assessments - Array of assessment objects
 */
export function exportTimelineToPDF(enrollee, assessments) {
  const doc = new jsPDF()
  
  const name = `${enrollee.demographics?.firstName || ''} ${enrollee.demographics?.lastName || ''}`
  
  // Header
  doc.setFontSize(18)
  doc.text('Risk Assessment Timeline', 14, 22)
  
  doc.setFontSize(12)
  doc.text(`Enrollee: ${name}`, 14, 32)
  doc.text(`DOB: ${enrollee.demographics?.dob || 'N/A'}`, 14, 39)
  doc.text(`Current Risk Tier: ${enrollee.riskProfile?.tier || 'N/A'}`, 14, 46)
  doc.text(`Report Generated: ${new Date().toLocaleString()}`, 14, 53)
  
  // Assessment history table
  const assessmentData = assessments.map(assessment => [
    new Date(assessment.date).toLocaleDateString(),
    assessment.formName || 'Assessment',
    `Tier ${assessment.tier}`,
    assessment.totalScore || 'N/A',
    assessment.assessor || 'N/A'
  ])
  
  doc.autoTable({
    head: [['Date', 'Assessment Type', 'Risk Tier', 'Total Score', 'Assessor']],
    body: assessmentData,
    startY: 60,
    headStyles: { fillColor: [14, 165, 233] },
    styles: { fontSize: 10 }
  })
  
  // Trend analysis
  if (assessments.length >= 2) {
    const first = assessments[0]
    const last = assessments[assessments.length - 1]
    const scoreChange = first.totalScore - last.totalScore
    
    const currentY = doc.lastAutoTable.finalY + 15
    doc.setFontSize(14)
    doc.text('Trend Analysis', 14, currentY)
    
    doc.setFontSize(11)
    let trendText = ''
    if (scoreChange > 5) trendText = '📈 Significant Improvement'
    else if (scoreChange > 0) trendText = '↗️ Improving'
    else if (scoreChange < -5) trendText = '📉 Declining'
    else if (scoreChange < 0) trendText = '↘️ Slight Decline'
    else trendText = '→ Stable'
    
    doc.text(`Status: ${trendText}`, 14, currentY + 8)
    doc.text(`Score Change: ${Math.abs(scoreChange)} points ${scoreChange >= 0 ? 'improvement' : 'increase'}`, 14, currentY + 15)
    doc.text(`Assessment Count: ${assessments.length}`, 14, currentY + 22)
  }
  
  // Detailed scores for latest assessment
  if (assessments.length > 0) {
    doc.addPage()
    const latest = assessments[assessments.length - 1]
    
    doc.setFontSize(14)
    doc.text('Latest Assessment Details', 14, 22)
    
    doc.setFontSize(11)
    doc.text(`Date: ${new Date(latest.date).toLocaleDateString()}`, 14, 32)
    doc.text(`Form: ${latest.formName || 'Assessment'}`, 14, 39)
    
    if (latest.scores) {
      const scoresData = Object.entries(latest.scores).map(([domain, score]) => [
        domain.charAt(0).toUpperCase() + domain.slice(1),
        score
      ])
      
      doc.autoTable({
        head: [['Domain', 'Score']],
        body: scoresData,
        startY: 45,
        headStyles: { fillColor: [14, 165, 233] }
      })
    }
  }
  
  // Save
  const filename = `atlas-timeline-${name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

/**
 * Export referrals to PDF
 * @param {Array} referrals - Array of referral objects
 * @param {string} filterType - Filter type for title
 */
export function exportReferralsToPDF(referrals, filterType = 'All') {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(18)
  doc.text(`ATLAS Referrals Report - ${filterType}`, 14, 22)
  
  doc.setFontSize(11)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)
  doc.text(`Total Referrals: ${referrals.length}`, 14, 36)
  
  // Table data
  const tableData = referrals.map(referral => [
    referral.enrolleeName || 'N/A',
    referral.resourceName || 'N/A',
    referral.status || 'Pending',
    new Date(referral.createdTimestamp).toLocaleDateString(),
    referral.notes ? referral.notes.substring(0, 40) + '...' : 'No notes'
  ])
  
  doc.autoTable({
    head: [['Enrollee', 'Resource', 'Status', 'Date', 'Notes']],
    body: tableData,
    startY: 42,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [14, 165, 233] },
    columnStyles: {
      4: { cellWidth: 50 }
    }
  })
  
  // Save
  doc.save(`atlas-referrals-${filterType.toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`)
}

// ============================================================================
// EXCEL EXPORT FUNCTIONS
// ============================================================================

/**
 * Export enrollees to Excel
 * @param {Array} enrollees - Array of enrollee objects
 */
export function exportEnrolleesToExcel(enrollees) {
  const data = enrollees.map(enrollee => ({
    'First Name': enrollee.demographics?.firstName || '',
    'Last Name': enrollee.demographics?.lastName || '',
    'Date of Birth': enrollee.demographics?.dob || '',
    'Risk Tier': enrollee.riskProfile?.tier || '',
    'Z-Codes Count': enrollee.riskProfile?.zCodes?.length || 0,
    'Care Team Size': enrollee.careTeam?.length || 0,
    'Physical Wellness': enrollee.riskProfile?.wellnessScores?.physical || '',
    'Emotional Wellness': enrollee.riskProfile?.wellnessScores?.emotional || '',
    'Social Wellness': enrollee.riskProfile?.wellnessScores?.social || '',
    'Intellectual Wellness': enrollee.riskProfile?.wellnessScores?.intellectual || '',
    'Occupational Wellness': enrollee.riskProfile?.wellnessScores?.occupational || '',
    'Environmental Wellness': enrollee.riskProfile?.wellnessScores?.environmental || '',
    'Financial Wellness': enrollee.riskProfile?.wellnessScores?.financial || '',
    'Spiritual Wellness': enrollee.riskProfile?.wellnessScores?.spiritual || ''
  }))
  
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Enrollees')
  
  // Add column widths
  ws['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 16 }
  ]
  
  XLSX.writeFile(wb, `atlas-enrollees-${new Date().toISOString().split('T')[0]}.xlsx`)
}

/**
 * Export dashboard analytics to Excel
 * @param {object} analytics - Analytics data
 */
export function exportDashboardAnalyticsToExcel(analytics) {
  const wb = XLSX.utils.book_new()
  
  // Summary sheet
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Enrollees', analytics.totalEnrollees || 0],
    ['Active Referrals', analytics.activeReferrals || 0],
    ['Tier 1 (Low Risk)', analytics.tier1Count || 0],
    ['Tier 2 (Moderate Risk)', analytics.tier2Count || 0],
    ['Tier 3 (High Risk)', analytics.tier3Count || 0],
    ['Average Wellness Score', analytics.avgWellnessScore || 0]
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
  
  // Wellness dimensions sheet
  if (analytics.wellnessDimensions) {
    const dimensionData = [
      ['Dimension', 'Average Score', 'Level'],
      ...Object.entries(analytics.wellnessDimensions).map(([dim, score]) => [
        dim.charAt(0).toUpperCase() + dim.slice(1),
        Math.round(score),
        getWellnessLevel(score)
      ])
    ]
    const wsDimensions = XLSX.utils.aoa_to_sheet(dimensionData)
    XLSX.utils.book_append_sheet(wb, wsDimensions, 'Wellness Dimensions')
  }
  
  // Risk distribution sheet
  if (analytics.riskDistribution) {
    const riskData = [
      ['Risk Tier', 'Count', 'Percentage'],
      ['Tier 1 (Low)', analytics.riskDistribution.tier1 || 0, `${analytics.riskDistribution.tier1Percent || 0}%`],
      ['Tier 2 (Moderate)', analytics.riskDistribution.tier2 || 0, `${analytics.riskDistribution.tier2Percent || 0}%`],
      ['Tier 3 (High)', analytics.riskDistribution.tier3 || 0, `${analytics.riskDistribution.tier3Percent || 0}%`]
    ]
    const wsRisk = XLSX.utils.aoa_to_sheet(riskData)
    XLSX.utils.book_append_sheet(wb, wsRisk, 'Risk Distribution')
  }
  
  XLSX.writeFile(wb, `atlas-analytics-${new Date().toISOString().split('T')[0]}.xlsx`)
}

/**
 * Export assessment timeline to Excel
 * @param {object} enrollee - Enrollee object
 * @param {Array} assessments - Assessment array
 */
export function exportTimelineToExcel(enrollee, assessments) {
  const name = `${enrollee.demographics?.firstName || ''} ${enrollee.demographics?.lastName || ''}`
  
  const data = assessments.map(assessment => ({
    'Date': new Date(assessment.date).toLocaleDateString(),
    'Assessment Type': assessment.formName || 'Assessment',
    'Risk Tier': assessment.tier,
    'Total Score': assessment.totalScore || '',
    'Assessor': assessment.assessor || '',
    'Criminal': assessment.scores?.criminal || '',
    'Education': assessment.scores?.education || '',
    'Financial': assessment.scores?.financial || '',
    'Family': assessment.scores?.family || '',
    'Accommodation': assessment.scores?.accommodation || '',
    'Leisure': assessment.scores?.leisure || '',
    'Companions': assessment.scores?.companions || '',
    'Alcohol': assessment.scores?.alcohol || '',
    'Attitudes': assessment.scores?.attitudes || '',
    'Antisocial': assessment.scores?.antisocial || ''
  }))
  
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Timeline')
  
  const filename = `atlas-timeline-${name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * Export referrals to Excel
 * @param {Array} referrals - Referrals array
 */
export function exportReferralsToExcel(referrals) {
  const data = referrals.map(referral => ({
    'Enrollee Name': referral.enrolleeName || 'N/A',
    'Resource Name': referral.resourceName || 'N/A',
    'Status': referral.status || 'Pending',
    'Date Created': new Date(referral.createdTimestamp).toLocaleDateString(),
    'Notes': referral.notes || 'No notes'
  }))
  
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Referrals')
  
  ws['!cols'] = [
    { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 50 }
  ]
  
  XLSX.writeFile(wb, `atlas-referrals-${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getWellnessLevel(score) {
  if (score >= 70) return 'Good'
  if (score >= 40) return 'At Risk'
  return 'High Risk'
}

export default {
  // PDF exports
  exportEnrolleesToPDF,
  exportDashboardAnalyticsToPDF,
  exportTimelineToPDF,
  exportReferralsToPDF,
  
  // Excel exports
  exportEnrolleesToExcel,
  exportDashboardAnalyticsToExcel,
  exportTimelineToExcel,
  exportReferralsToExcel
}

