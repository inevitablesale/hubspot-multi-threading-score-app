/**
 * Report Service - Generate exportable deal health reports
 * 
 * This service provides:
 * 1. PDF-ready report data generation
 * 2. Manager coaching packets
 * 3. Pipeline-wide multi-threading dashboards
 * 4. Timeline event summaries
 */

const { calculateMultiThreadingScore, generateRecommendations } = require('./scoringService');
const { calculateCoverageAnalysis, generateMissingChecklist, calculateChampionStrength } = require('./coverageAnalysisService');
const { predictDealRisk, analyzeStageVelocity } = require('./riskPredictionService');

/**
 * Generate comprehensive deal health report
 * @param {Object} dealData - Deal with contacts
 * @param {Object} options - Report options
 * @returns {Object} Complete report data
 */
function generateDealHealthReport(dealData, options = {}) {
  const { includeContacts = true, includeHistory = true } = options;
  
  const scoreData = calculateMultiThreadingScore(dealData);
  const recommendations = generateRecommendations(scoreData);
  const coverageAnalysis = calculateCoverageAnalysis(
    dealData.contacts || [], 
    { dealStage: dealData.deal?.dealstage }
  );
  const missingChecklist = generateMissingChecklist(coverageAnalysis);
  const riskPrediction = predictDealRisk(dealData, scoreData, options);
  const stageVelocity = analyzeStageVelocity(dealData);
  
  // Find champion for strength analysis
  const champion = scoreData.contacts?.find(c => 
    (c.role || '').toUpperCase() === 'CHAMPION'
  );
  const championStrength = champion ? calculateChampionStrength(champion, options.championData || {}) : null;
  
  const report = {
    generatedAt: new Date().toISOString(),
    reportType: 'DEAL_HEALTH',
    
    // Deal information
    deal: {
      id: dealData.dealId,
      name: dealData.deal?.dealname || 'Unknown',
      stage: dealData.deal?.dealstage || 'Unknown',
      amount: dealData.deal?.amount || 0,
      closeDate: dealData.deal?.closedate || null
    },
    
    // Score summary
    scores: {
      overall: scoreData.overallScore,
      engagement: scoreData.engagementScore,
      participation: scoreData.participationScore,
      roleCoverage: scoreData.roleCoverageScore,
      breadth: coverageAnalysis.breadth.breadthScore,
      depth: coverageAnalysis.depth.overallDepthScore,
      coverage: coverageAnalysis.coverageScore
    },
    
    // Risk assessment
    risk: {
      level: scoreData.riskLevel,
      color: scoreData.riskColor,
      prediction: riskPrediction.overallRiskLevel,
      compositeScore: riskPrediction.compositeRiskScore,
      priorityActions: riskPrediction.priorityActions
    },
    
    // Stakeholder summary
    stakeholders: {
      total: scoreData.contactCount,
      engaged: scoreData.threadDepth,
      coveredRoles: scoreData.coveredRoles,
      missingKeyRoles: scoreData.missingKeyRoles,
      roleDistribution: coverageAnalysis.breadth.roleContacts ? 
        Object.entries(coverageAnalysis.breadth.roleContacts).map(([role, contacts]) => ({
          role,
          count: contacts.length
        })) : []
    },
    
    // Champion analysis
    champion: championStrength ? {
      identified: true,
      name: champion?.name,
      strengthScore: championStrength.strengthScore,
      reliability: championStrength.reliability,
      factors: championStrength.factors,
      recommendations: championStrength.recommendations
    } : {
      identified: false,
      strengthScore: 0,
      reliability: 'NONE',
      recommendations: ['Identify and develop a champion within the organization']
    },
    
    // Stage velocity
    velocity: {
      status: stageVelocity.status,
      daysInStage: stageVelocity.daysInStage,
      isStuck: stageVelocity.isStuck,
      benchmark: stageVelocity.benchmark,
      recommendation: stageVelocity.recommendation
    },
    
    // What's missing checklist
    checklist: missingChecklist,
    
    // Recommendations
    recommendations: recommendations,
    
    // Detailed contacts (optional)
    contacts: includeContacts ? scoreData.contacts : undefined
  };
  
  return report;
}

/**
 * Generate manager coaching packet
 * @param {Array} deals - Array of deals with contacts
 * @param {Object} options - Packet options
 * @returns {Object} Coaching packet data
 */
function generateCoachingPacket(deals, options = {}) {
  const { repName = 'Sales Rep', period = '30 days' } = options;
  
  const dealReports = deals.map(deal => generateDealHealthReport(deal, { includeContacts: false }));
  
  // Calculate aggregate statistics
  const avgScore = dealReports.length > 0 
    ? Math.round(dealReports.reduce((sum, r) => sum + r.scores.overall, 0) / dealReports.length)
    : 0;
  
  const riskDistribution = {
    HIGH: dealReports.filter(r => r.risk.level === 'HIGH').length,
    MEDIUM: dealReports.filter(r => r.risk.level === 'MEDIUM').length,
    LOW: dealReports.filter(r => r.risk.level === 'LOW').length
  };
  
  const avgStakeholders = dealReports.length > 0
    ? (dealReports.reduce((sum, r) => sum + r.stakeholders.total, 0) / dealReports.length).toFixed(1)
    : 0;
  
  const singleThreadedDeals = dealReports.filter(r => r.stakeholders.total <= 1);
  const stuckDeals = dealReports.filter(r => r.velocity.isStuck);
  const noChampionDeals = dealReports.filter(r => !r.champion.identified);
  
  // Common missing roles across all deals
  const missingRoleCounts = {};
  dealReports.forEach(r => {
    r.stakeholders.missingKeyRoles.forEach(role => {
      missingRoleCounts[role] = (missingRoleCounts[role] || 0) + 1;
    });
  });
  
  const commonMissingRoles = Object.entries(missingRoleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([role, count]) => ({ role, count, percentage: Math.round(count / dealReports.length * 100) }));
  
  return {
    generatedAt: new Date().toISOString(),
    reportType: 'COACHING_PACKET',
    repName,
    period,
    
    summary: {
      totalDeals: dealReports.length,
      averageScore: avgScore,
      averageStakeholders: avgStakeholders,
      riskDistribution
    },
    
    alerts: {
      singleThreaded: {
        count: singleThreadedDeals.length,
        deals: singleThreadedDeals.map(r => ({ name: r.deal.name, id: r.deal.id }))
      },
      stuckDeals: {
        count: stuckDeals.length,
        deals: stuckDeals.map(r => ({ 
          name: r.deal.name, 
          id: r.deal.id, 
          daysInStage: r.velocity.daysInStage 
        }))
      },
      noChampion: {
        count: noChampionDeals.length,
        deals: noChampionDeals.map(r => ({ name: r.deal.name, id: r.deal.id }))
      }
    },
    
    patterns: {
      commonMissingRoles,
      avgEngagementScore: dealReports.length > 0 
        ? Math.round(dealReports.reduce((sum, r) => sum + r.scores.engagement, 0) / dealReports.length)
        : 0,
      avgRoleCoverage: dealReports.length > 0
        ? Math.round(dealReports.reduce((sum, r) => sum + r.scores.roleCoverage, 0) / dealReports.length)
        : 0
    },
    
    coachingPoints: generateCoachingPoints(dealReports, singleThreadedDeals, stuckDeals, noChampionDeals, commonMissingRoles),
    
    dealDetails: dealReports.map(r => ({
      id: r.deal.id,
      name: r.deal.name,
      stage: r.deal.stage,
      score: r.scores.overall,
      riskLevel: r.risk.level,
      stakeholders: r.stakeholders.total,
      topRecommendation: r.recommendations[0]?.message || 'No recommendations'
    }))
  };
}

/**
 * Generate coaching points based on patterns
 */
function generateCoachingPoints(reports, singleThreaded, stuck, noChampion, commonMissing) {
  const points = [];
  
  if (singleThreaded.length > reports.length * 0.3) {
    points.push({
      priority: 'HIGH',
      area: 'Multi-Threading',
      observation: `${Math.round(singleThreaded.length / reports.length * 100)}% of deals are single-threaded`,
      coaching: 'Focus on expanding stakeholder engagement earlier in the sales cycle. Practice multi-threading techniques in role plays.',
      resources: ['Multi-threading playbook', 'Stakeholder mapping template']
    });
  }
  
  if (stuck.length > 0) {
    points.push({
      priority: 'HIGH',
      area: 'Deal Velocity',
      observation: `${stuck.length} deal(s) appear stuck in their current stage`,
      coaching: 'Review stuck deals together. Identify blockers and develop action plans to advance each deal.',
      resources: ['Deal review checklist', 'Objection handling guide']
    });
  }
  
  if (noChampion.length > reports.length * 0.4) {
    points.push({
      priority: 'MEDIUM',
      area: 'Champion Development',
      observation: `${Math.round(noChampion.length / reports.length * 100)}% of deals lack an identified champion`,
      coaching: 'Work on champion identification and development skills. Champions are key deal accelerators.',
      resources: ['Champion development guide', 'Internal advocacy templates']
    });
  }
  
  if (commonMissing.length > 0 && commonMissing[0].percentage > 40) {
    points.push({
      priority: 'MEDIUM',
      area: 'Role Coverage',
      observation: `${commonMissing[0].role} is missing in ${commonMissing[0].percentage}% of deals`,
      coaching: `Focus on identifying and engaging ${commonMissing[0].role.toLowerCase()} earlier in deals.`,
      resources: ['Stakeholder mapping guide', 'Executive engagement playbook']
    });
  }
  
  const avgScore = reports.length > 0 
    ? Math.round(reports.reduce((sum, r) => sum + r.scores.overall, 0) / reports.length)
    : 0;
  
  if (avgScore < 50) {
    points.push({
      priority: 'HIGH',
      area: 'Overall Multi-Threading Health',
      observation: `Average multi-threading score is ${avgScore}/100 - below healthy threshold`,
      coaching: 'Comprehensive review of stakeholder engagement strategy needed across all deals.',
      resources: ['Multi-threading assessment', 'Stakeholder engagement framework']
    });
  }
  
  if (points.length === 0) {
    points.push({
      priority: 'LOW',
      area: 'Recognition',
      observation: 'Multi-threading practices appear healthy across the pipeline',
      coaching: 'Continue current practices. Consider sharing successful strategies with the team.',
      resources: []
    });
  }
  
  return points.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Generate pipeline dashboard data
 * @param {Array} deals - Array of deals with contacts
 * @param {Object} options - Dashboard options
 * @returns {Object} Dashboard data
 */
function generatePipelineDashboard(deals, options = {}) {
  const { groupByStage = true, groupByRep = false } = options;
  
  const dealReports = deals.map(deal => generateDealHealthReport(deal, { includeContacts: false }));
  
  // Overall pipeline health
  const pipelineHealth = {
    totalDeals: dealReports.length,
    averageScore: dealReports.length > 0 
      ? Math.round(dealReports.reduce((sum, r) => sum + r.scores.overall, 0) / dealReports.length)
      : 0,
    healthyDeals: dealReports.filter(r => r.risk.level === 'LOW').length,
    atRiskDeals: dealReports.filter(r => r.risk.level === 'HIGH').length,
    singleThreadedDeals: dealReports.filter(r => r.stakeholders.total <= 1).length
  };
  
  // Score distribution
  const scoreDistribution = {
    excellent: dealReports.filter(r => r.scores.overall >= 80).length,
    good: dealReports.filter(r => r.scores.overall >= 60 && r.scores.overall < 80).length,
    fair: dealReports.filter(r => r.scores.overall >= 40 && r.scores.overall < 60).length,
    poor: dealReports.filter(r => r.scores.overall < 40).length
  };
  
  // Group by stage if requested
  let stageBreakdown = null;
  if (groupByStage) {
    const stageGroups = {};
    dealReports.forEach(r => {
      const stage = r.deal.stage || 'unknown';
      if (!stageGroups[stage]) {
        stageGroups[stage] = { deals: [], totalScore: 0, count: 0 };
      }
      stageGroups[stage].deals.push(r);
      stageGroups[stage].totalScore += r.scores.overall;
      stageGroups[stage].count++;
    });
    
    stageBreakdown = Object.entries(stageGroups).map(([stage, data]) => ({
      stage,
      dealCount: data.count,
      averageScore: Math.round(data.totalScore / data.count),
      atRiskCount: data.deals.filter(d => d.risk.level === 'HIGH').length
    }));
  }
  
  // Top at-risk deals
  const topAtRiskDeals = dealReports
    .filter(r => r.risk.level === 'HIGH')
    .sort((a, b) => b.risk.compositeScore - a.risk.compositeScore)
    .slice(0, 5)
    .map(r => ({
      id: r.deal.id,
      name: r.deal.name,
      stage: r.deal.stage,
      score: r.scores.overall,
      riskScore: r.risk.compositeScore,
      topAction: r.risk.priorityActions[0]?.action || 'Review required'
    }));
  
  return {
    generatedAt: new Date().toISOString(),
    reportType: 'PIPELINE_DASHBOARD',
    
    health: pipelineHealth,
    scoreDistribution,
    stageBreakdown,
    topAtRiskDeals,
    
    trends: {
      // Would be populated with historical data in production
      scoreChange: null,
      healthTrend: null
    }
  };
}

/**
 * Generate timeline event for score changes
 * @param {Object} previousSnapshot - Previous score snapshot
 * @param {Object} currentSnapshot - Current score snapshot
 * @param {Object} dealData - Deal information
 * @returns {Array} Timeline events
 */
function generateTimelineEvents(previousSnapshot, currentSnapshot, dealData) {
  const events = [];
  const timestamp = new Date().toISOString();
  
  // Score change event
  if (previousSnapshot && currentSnapshot) {
    const scoreDelta = currentSnapshot.overallScore - previousSnapshot.overallScore;
    if (Math.abs(scoreDelta) >= 5) {
      events.push({
        type: 'SCORE_CHANGE',
        timestamp,
        title: `Score ${scoreDelta > 0 ? 'increased' : 'dropped'} from ${previousSnapshot.overallScore} → ${currentSnapshot.overallScore}`,
        details: {
          previousScore: previousSnapshot.overallScore,
          currentScore: currentSnapshot.overallScore,
          change: scoreDelta,
          riskLevel: currentSnapshot.riskLevel
        },
        icon: scoreDelta > 0 ? '📈' : '📉',
        color: scoreDelta > 0 ? '#00a4bd' : '#f2545b'
      });
    }
  }
  
  // New stakeholder events
  if (currentSnapshot?.contacts && previousSnapshot?.contacts) {
    const previousIds = new Set(previousSnapshot.contacts.map(c => c.contactId));
    const newContacts = currentSnapshot.contacts.filter(c => !previousIds.has(c.contactId));
    
    newContacts.forEach(contact => {
      events.push({
        type: 'NEW_STAKEHOLDER',
        timestamp,
        title: `New stakeholder added: ${contact.name} (${contact.role || contact.jobTitle || 'Role unspecified'})`,
        details: {
          contactId: contact.contactId,
          name: contact.name,
          role: contact.role,
          jobTitle: contact.jobTitle
        },
        icon: '👤',
        color: '#00a4bd'
      });
    });
  }
  
  // Thread depth change
  if (previousSnapshot && currentSnapshot) {
    const depthDelta = currentSnapshot.threadDepth - previousSnapshot.threadDepth;
    if (depthDelta !== 0) {
      events.push({
        type: 'DEPTH_CHANGE',
        timestamp,
        title: `Thread depth ${depthDelta > 0 ? 'increased' : 'decreased'} from ${previousSnapshot.threadDepth} → ${currentSnapshot.threadDepth} contacts`,
        details: {
          previousDepth: previousSnapshot.threadDepth,
          currentDepth: currentSnapshot.threadDepth,
          change: depthDelta
        },
        icon: depthDelta > 0 ? '🔗' : '⛓️',
        color: depthDelta > 0 ? '#00a4bd' : '#f5c26b'
      });
    }
  }
  
  // Role coverage change
  if (previousSnapshot && currentSnapshot) {
    const previousRoles = new Set(previousSnapshot.coveredRoles || []);
    const currentRoles = new Set(currentSnapshot.coveredRoles || []);
    
    currentRoles.forEach(role => {
      if (!previousRoles.has(role)) {
        events.push({
          type: 'NEW_ROLE_COVERED',
          timestamp,
          title: `New role covered: ${role.toLowerCase().replace('_', ' ')}`,
          details: { role },
          icon: '✅',
          color: '#00a4bd'
        });
      }
    });
  }
  
  return events;
}

/**
 * Format report as HTML for PDF generation
 * @param {Object} report - Report data
 * @returns {string} HTML string
 */
function formatReportAsHtml(report) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Deal Health Report - ${report.deal.name}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #33475b; }
    .header { background: #2e475d; color: white; padding: 30px; margin: -40px -40px 30px -40px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; opacity: 0.8; }
    .score-badge { 
      display: inline-block; 
      padding: 10px 20px; 
      border-radius: 20px; 
      font-size: 24px; 
      font-weight: bold;
      background: ${report.risk.color};
      color: white;
    }
    .section { margin-bottom: 30px; }
    .section h2 { color: #2e475d; border-bottom: 2px solid #eaf0f6; padding-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .metric { background: #f5f8fa; padding: 20px; border-radius: 8px; text-align: center; }
    .metric .value { font-size: 32px; font-weight: bold; color: #00a4bd; }
    .metric .label { font-size: 12px; color: #516f90; margin-top: 5px; }
    .risk-${report.risk.level.toLowerCase()} { border-left: 4px solid ${report.risk.color}; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eaf0f6; }
    th { background: #f5f8fa; font-weight: 500; }
    .recommendation { padding: 15px; margin-bottom: 10px; border-radius: 8px; background: #f5f8fa; }
    .recommendation.HIGH { border-left: 4px solid #f2545b; }
    .recommendation.MEDIUM { border-left: 4px solid #f5c26b; }
    .recommendation.LOW { border-left: 4px solid #00a4bd; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaf0f6; font-size: 12px; color: #516f90; }
  </style>
</head>
<body>
  <div class="header">
    <span class="score-badge">${report.scores.overall}</span>
    <h1>${report.deal.name}</h1>
    <p>Deal Health Report • Generated ${new Date(report.generatedAt).toLocaleDateString()}</p>
  </div>

  <div class="section">
    <h2>Score Summary</h2>
    <div class="grid">
      <div class="metric">
        <div class="value">${report.scores.overall}</div>
        <div class="label">Overall Score</div>
      </div>
      <div class="metric">
        <div class="value">${report.scores.engagement}</div>
        <div class="label">Engagement</div>
      </div>
      <div class="metric">
        <div class="value">${report.scores.roleCoverage}</div>
        <div class="label">Role Coverage</div>
      </div>
      <div class="metric">
        <div class="value">${report.stakeholders.total}</div>
        <div class="label">Stakeholders</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Risk Assessment</h2>
    <p><strong>Risk Level:</strong> ${report.risk.level}</p>
    <p><strong>Prediction:</strong> ${report.risk.prediction}</p>
    ${report.risk.priorityActions.length > 0 ? `
      <h3>Priority Actions</h3>
      <ul>
        ${report.risk.priorityActions.map(a => `<li><strong>${a.action}:</strong> ${a.details}</li>`).join('')}
      </ul>
    ` : ''}
  </div>

  <div class="section">
    <h2>Stakeholder Coverage</h2>
    <p><strong>Covered Roles:</strong> ${report.stakeholders.coveredRoles.join(', ') || 'None'}</p>
    <p><strong>Missing Key Roles:</strong> ${report.stakeholders.missingKeyRoles.join(', ') || 'None'}</p>
  </div>

  <div class="section">
    <h2>Recommendations</h2>
    ${report.recommendations.map(r => `
      <div class="recommendation ${r.priority}">
        <strong>${r.title}</strong>
        <p>${r.message}</p>
        <p><em>Action: ${r.action}</em></p>
      </div>
    `).join('')}
  </div>

  <div class="footer">
    <p>Report ID: ${report.deal.id} • Generated by Multi-Threading Score App</p>
  </div>
</body>
</html>
  `;
}

module.exports = {
  generateDealHealthReport,
  generateCoachingPacket,
  generatePipelineDashboard,
  generateTimelineEvents,
  formatReportAsHtml
};
