/**
 * Risk Prediction Service - ML-based engagement risk prediction
 * 
 * This service provides pattern-based risk prediction using:
 * 1. Historical won/lost deal patterns
 * 2. Champion churn indicators
 * 3. Stage progression analysis
 * 4. Meeting frequency patterns
 */

// Risk factors and their weights based on typical B2B sales patterns
const RISK_FACTORS = {
  // Champion-related risks
  CHAMPION_CHURN_INDICATORS: {
    lowResponseRate: { weight: 25, threshold: 0.3 },
    decreasingEngagement: { weight: 30, threshold: -20 },
    missedMeetings: { weight: 20, threshold: 2 },
    noRecentContact: { weight: 25, threshold: 14 } // days
  },
  
  // Economic buyer involvement
  ECONOMIC_BUYER_TIMING: {
    notInvolvedByStageX: {
      'presentationscheduled': { weight: 15, description: 'Economic buyer should be identified' },
      'decisionmakerboughtin': { weight: 40, description: 'Economic buyer must be actively engaged' },
      'contractsent': { weight: 60, description: 'Economic buyer approval required' }
    }
  },
  
  // Meeting progression
  MEETING_PATTERNS: {
    tooManyWithoutProgression: { weight: 35, threshold: 5 }, // meetings without stage change
    noMeetingsRecently: { weight: 25, threshold: 14 }, // days
    decreasingAttendance: { weight: 20, threshold: -2 } // attendee count change
  }
};

// Deal stage progression expectations (days per stage)
const STAGE_VELOCITY_BENCHMARKS = {
  'appointmentscheduled': { expectedDays: 14, maxDays: 30 },
  'qualifiedtobuy': { expectedDays: 21, maxDays: 45 },
  'presentationscheduled': { expectedDays: 14, maxDays: 30 },
  'decisionmakerboughtin': { expectedDays: 21, maxDays: 45 },
  'contractsent': { expectedDays: 14, maxDays: 30 }
};

/**
 * Predict champion churn risk
 * @param {Object} champion - Champion contact data
 * @param {Object} engagementHistory - Historical engagement data
 * @returns {Object} Churn risk analysis
 */
function predictChampionChurn(champion, engagementHistory = {}) {
  if (!champion) {
    return {
      churnRisk: 'UNKNOWN',
      riskScore: 0,
      confidence: 0,
      factors: [],
      recommendation: 'No champion identified'
    };
  }
  
  const factors = [];
  let totalRiskScore = 0;
  
  const engagements = champion.engagements || { total: 0 };
  const { 
    responseRate = null, 
    previousEngagementScore = null,
    missedMeetings = 0,
    daysSinceLastContact = null 
  } = engagementHistory;
  
  // Factor 1: Low response rate
  if (responseRate !== null && responseRate < RISK_FACTORS.CHAMPION_CHURN_INDICATORS.lowResponseRate.threshold) {
    const riskContribution = RISK_FACTORS.CHAMPION_CHURN_INDICATORS.lowResponseRate.weight;
    factors.push({
      factor: 'Low Response Rate',
      value: `${Math.round(responseRate * 100)}%`,
      threshold: `${RISK_FACTORS.CHAMPION_CHURN_INDICATORS.lowResponseRate.threshold * 100}%`,
      riskContribution,
      description: 'Champion is not responding to communications'
    });
    totalRiskScore += riskContribution;
  }
  
  // Factor 2: Decreasing engagement
  if (previousEngagementScore !== null) {
    const currentScore = champion.engagementScore || 0;
    const engagementChange = currentScore - previousEngagementScore;
    
    if (engagementChange < RISK_FACTORS.CHAMPION_CHURN_INDICATORS.decreasingEngagement.threshold) {
      const riskContribution = RISK_FACTORS.CHAMPION_CHURN_INDICATORS.decreasingEngagement.weight;
      factors.push({
        factor: 'Decreasing Engagement',
        value: `${engagementChange} points`,
        threshold: `${RISK_FACTORS.CHAMPION_CHURN_INDICATORS.decreasingEngagement.threshold} points`,
        riskContribution,
        description: 'Champion engagement is declining significantly'
      });
      totalRiskScore += riskContribution;
    }
  }
  
  // Factor 3: Missed meetings
  if (missedMeetings >= RISK_FACTORS.CHAMPION_CHURN_INDICATORS.missedMeetings.threshold) {
    const riskContribution = RISK_FACTORS.CHAMPION_CHURN_INDICATORS.missedMeetings.weight;
    factors.push({
      factor: 'Missed Meetings',
      value: missedMeetings,
      threshold: RISK_FACTORS.CHAMPION_CHURN_INDICATORS.missedMeetings.threshold,
      riskContribution,
      description: 'Champion has missed multiple scheduled meetings'
    });
    totalRiskScore += riskContribution;
  }
  
  // Factor 4: No recent contact
  if (daysSinceLastContact !== null && daysSinceLastContact >= RISK_FACTORS.CHAMPION_CHURN_INDICATORS.noRecentContact.threshold) {
    const riskContribution = RISK_FACTORS.CHAMPION_CHURN_INDICATORS.noRecentContact.weight;
    factors.push({
      factor: 'No Recent Contact',
      value: `${daysSinceLastContact} days`,
      threshold: `${RISK_FACTORS.CHAMPION_CHURN_INDICATORS.noRecentContact.threshold} days`,
      riskContribution,
      description: 'No communication with champion recently'
    });
    totalRiskScore += riskContribution;
  }
  
  // Determine churn risk level
  let churnRisk;
  if (totalRiskScore >= 60) {
    churnRisk = 'HIGH';
  } else if (totalRiskScore >= 30) {
    churnRisk = 'MEDIUM';
  } else if (totalRiskScore > 0) {
    churnRisk = 'LOW';
  } else {
    churnRisk = 'NONE';
  }
  
  // Generate recommendation
  let recommendation;
  if (churnRisk === 'HIGH') {
    recommendation = 'Immediate action required: Schedule urgent check-in with champion and consider identifying backup champion';
  } else if (churnRisk === 'MEDIUM') {
    recommendation = 'Schedule a champion check-in and review engagement strategy';
  } else if (churnRisk === 'LOW') {
    recommendation = 'Monitor champion engagement and maintain regular communication';
  } else {
    recommendation = 'Champion relationship appears healthy';
  }
  
  return {
    churnRisk,
    riskScore: totalRiskScore,
    confidence: factors.length > 0 ? Math.min(factors.length * 25, 90) : 50,
    factors,
    recommendation
  };
}

/**
 * Predict economic buyer involvement risk
 * @param {Object} scoreData - Current score data
 * @param {string} dealStage - Current deal stage
 * @returns {Object} Economic buyer risk analysis
 */
function predictEconomicBuyerRisk(scoreData, dealStage) {
  const factors = [];
  let totalRiskScore = 0;
  
  const coveredRoles = scoreData.coveredRoles || [];
  const hasDecisionMaker = coveredRoles.includes('DECISION_MAKER');
  const hasBudgetHolder = coveredRoles.includes('BUDGET_HOLDER');
  const hasEconomicBuyer = hasDecisionMaker || hasBudgetHolder;
  
  // Check stage-specific requirements
  const stageRequirements = RISK_FACTORS.ECONOMIC_BUYER_TIMING.notInvolvedByStageX[dealStage];
  
  if (stageRequirements && !hasEconomicBuyer) {
    factors.push({
      factor: 'Economic Buyer Not Involved',
      value: 'Not identified',
      stage: dealStage,
      riskContribution: stageRequirements.weight,
      description: stageRequirements.description
    });
    totalRiskScore += stageRequirements.weight;
  }
  
  // Check engagement level of economic buyers
  if (hasEconomicBuyer) {
    const economicBuyers = scoreData.contacts?.filter(c => 
      ['DECISION_MAKER', 'BUDGET_HOLDER'].includes((c.role || c.effectiveRole || '').toUpperCase())
    ) || [];
    
    const avgEngagement = economicBuyers.reduce((sum, c) => sum + (c.engagementScore || 0), 0) / (economicBuyers.length || 1);
    
    if (avgEngagement < 30) {
      const riskContribution = 25;
      factors.push({
        factor: 'Low Economic Buyer Engagement',
        value: `${Math.round(avgEngagement)}/100`,
        threshold: '30/100',
        riskContribution,
        description: 'Economic buyers are not actively engaged'
      });
      totalRiskScore += riskContribution;
    }
  }
  
  // Determine risk level
  let riskLevel;
  if (totalRiskScore >= 50) {
    riskLevel = 'HIGH';
  } else if (totalRiskScore >= 25) {
    riskLevel = 'MEDIUM';
  } else if (totalRiskScore > 0) {
    riskLevel = 'LOW';
  } else {
    riskLevel = 'NONE';
  }
  
  return {
    riskLevel,
    riskScore: totalRiskScore,
    hasEconomicBuyer,
    factors,
    recommendation: riskLevel === 'HIGH' 
      ? 'Critical: Engage economic buyer before advancing deal' 
      : riskLevel === 'MEDIUM'
      ? 'Prioritize economic buyer engagement'
      : 'Economic buyer involvement on track'
  };
}

/**
 * Predict meeting progression risk
 * @param {Object} meetingData - Meeting history and patterns
 * @param {Object} dealData - Deal information including stage
 * @returns {Object} Meeting progression risk analysis
 */
function predictMeetingProgressionRisk(meetingData, dealData = {}) {
  const factors = [];
  let totalRiskScore = 0;
  
  const {
    totalMeetings = 0,
    meetingsSinceStageChange = 0,
    daysSinceLastMeeting = null,
    averageAttendees = 0,
    previousAverageAttendees = null
  } = meetingData;
  
  // Factor 1: Too many meetings without progression
  if (meetingsSinceStageChange >= RISK_FACTORS.MEETING_PATTERNS.tooManyWithoutProgression.threshold) {
    const riskContribution = RISK_FACTORS.MEETING_PATTERNS.tooManyWithoutProgression.weight;
    factors.push({
      factor: 'Stalled Progression',
      value: `${meetingsSinceStageChange} meetings`,
      threshold: `${RISK_FACTORS.MEETING_PATTERNS.tooManyWithoutProgression.threshold} meetings`,
      riskContribution,
      description: 'Multiple meetings without deal stage advancement'
    });
    totalRiskScore += riskContribution;
  }
  
  // Factor 2: No recent meetings
  if (daysSinceLastMeeting !== null && daysSinceLastMeeting >= RISK_FACTORS.MEETING_PATTERNS.noMeetingsRecently.threshold) {
    const riskContribution = RISK_FACTORS.MEETING_PATTERNS.noMeetingsRecently.weight;
    factors.push({
      factor: 'Meeting Gap',
      value: `${daysSinceLastMeeting} days`,
      threshold: `${RISK_FACTORS.MEETING_PATTERNS.noMeetingsRecently.threshold} days`,
      riskContribution,
      description: 'No meetings scheduled or held recently'
    });
    totalRiskScore += riskContribution;
  }
  
  // Factor 3: Decreasing attendance
  if (previousAverageAttendees !== null) {
    const attendeeChange = averageAttendees - previousAverageAttendees;
    if (attendeeChange <= RISK_FACTORS.MEETING_PATTERNS.decreasingAttendance.threshold) {
      const riskContribution = RISK_FACTORS.MEETING_PATTERNS.decreasingAttendance.weight;
      factors.push({
        factor: 'Decreasing Attendance',
        value: `${attendeeChange} attendees`,
        threshold: `${RISK_FACTORS.MEETING_PATTERNS.decreasingAttendance.threshold} attendees`,
        riskContribution,
        description: 'Fewer stakeholders attending recent meetings'
      });
      totalRiskScore += riskContribution;
    }
  }
  
  // Determine risk level
  let riskLevel;
  if (totalRiskScore >= 50) {
    riskLevel = 'HIGH';
  } else if (totalRiskScore >= 25) {
    riskLevel = 'MEDIUM';
  } else if (totalRiskScore > 0) {
    riskLevel = 'LOW';
  } else {
    riskLevel = 'NONE';
  }
  
  return {
    riskLevel,
    riskScore: totalRiskScore,
    factors,
    meetingSummary: {
      totalMeetings,
      meetingsSinceStageChange,
      daysSinceLastMeeting,
      averageAttendees
    },
    recommendation: riskLevel === 'HIGH'
      ? 'Deal appears stalled - reassess strategy and schedule executive review'
      : riskLevel === 'MEDIUM'
      ? 'Schedule next meeting and review progression blockers'
      : 'Meeting cadence appears healthy'
  };
}

/**
 * Calculate overall deal risk prediction
 * @param {Object} dealData - Complete deal data
 * @param {Object} scoreData - Multi-threading score data
 * @param {Object} additionalData - Additional context (meeting data, engagement history)
 * @returns {Object} Comprehensive risk prediction
 */
function predictDealRisk(dealData, scoreData, additionalData = {}) {
  const {
    engagementHistory = {},
    meetingData = {},
    championData = null
  } = additionalData;
  
  const dealStage = dealData.deal?.dealstage || 'default';
  
  // Get individual risk predictions
  const champion = championData || scoreData.contacts?.find(c => 
    (c.role || c.effectiveRole || '').toUpperCase() === 'CHAMPION'
  );
  
  const championRisk = predictChampionChurn(champion, engagementHistory);
  const economicBuyerRisk = predictEconomicBuyerRisk(scoreData, dealStage);
  const meetingRisk = predictMeetingProgressionRisk(meetingData, dealData);
  
  // Calculate composite risk score
  const riskScores = [
    { name: 'Champion', score: championRisk.riskScore, weight: 0.35 },
    { name: 'Economic Buyer', score: economicBuyerRisk.riskScore, weight: 0.35 },
    { name: 'Meeting Progression', score: meetingRisk.riskScore, weight: 0.30 }
  ];
  
  const compositeRiskScore = Math.round(
    riskScores.reduce((total, risk) => total + (risk.score * risk.weight), 0)
  );
  
  // Determine overall risk level
  let overallRiskLevel;
  if (compositeRiskScore >= 50 || [championRisk.churnRisk, economicBuyerRisk.riskLevel, meetingRisk.riskLevel].includes('HIGH')) {
    overallRiskLevel = 'HIGH';
  } else if (compositeRiskScore >= 25) {
    overallRiskLevel = 'MEDIUM';
  } else if (compositeRiskScore > 0) {
    overallRiskLevel = 'LOW';
  } else {
    overallRiskLevel = 'HEALTHY';
  }
  
  // Generate priority actions
  const priorityActions = [];
  
  if (championRisk.churnRisk === 'HIGH') {
    priorityActions.push({
      priority: 1,
      action: 'Champion at risk',
      details: championRisk.recommendation
    });
  }
  
  if (economicBuyerRisk.riskLevel === 'HIGH') {
    priorityActions.push({
      priority: 2,
      action: 'Economic buyer gap',
      details: economicBuyerRisk.recommendation
    });
  }
  
  if (meetingRisk.riskLevel === 'HIGH') {
    priorityActions.push({
      priority: 3,
      action: 'Deal stalled',
      details: meetingRisk.recommendation
    });
  }
  
  return {
    overallRiskLevel,
    compositeRiskScore,
    riskBreakdown: {
      champion: championRisk,
      economicBuyer: economicBuyerRisk,
      meetingProgression: meetingRisk
    },
    priorityActions: priorityActions.sort((a, b) => a.priority - b.priority),
    prediction: overallRiskLevel === 'HIGH'
      ? 'Deal at significant risk - immediate intervention recommended'
      : overallRiskLevel === 'MEDIUM'
      ? 'Deal showing warning signs - proactive action advised'
      : overallRiskLevel === 'LOW'
      ? 'Deal progressing with minor concerns'
      : 'Deal appears healthy',
    confidence: Math.round(
      (championRisk.confidence + (economicBuyerRisk.factors.length > 0 ? 70 : 50) + (meetingRisk.factors.length > 0 ? 70 : 50)) / 3
    )
  };
}

/**
 * Analyze stage velocity to detect stuck deals
 * @param {Object} dealData - Deal with stage history
 * @returns {Object} Stage velocity analysis
 */
function analyzeStageVelocity(dealData) {
  const currentStage = dealData.deal?.dealstage || 'unknown';
  
  // Parse and validate the date
  let stageEnteredAt = null;
  if (dealData.deal?.hs_date_entered_currentstage) {
    const parsedDate = new Date(dealData.deal.hs_date_entered_currentstage);
    // Check if date is valid
    if (!isNaN(parsedDate.getTime())) {
      stageEnteredAt = parsedDate;
    }
  }
  
  if (!stageEnteredAt) {
    return {
      isStuck: false,
      daysInStage: null,
      benchmark: null,
      recommendation: 'Unable to determine stage duration'
    };
  }
  
  const daysInStage = Math.floor((new Date() - stageEnteredAt) / (1000 * 60 * 60 * 24));
  const benchmark = STAGE_VELOCITY_BENCHMARKS[currentStage] || { expectedDays: 21, maxDays: 45 };
  
  const isStuck = daysInStage > benchmark.maxDays;
  const isSlowing = daysInStage > benchmark.expectedDays;
  
  return {
    isStuck,
    isSlowing,
    daysInStage,
    benchmark,
    currentStage,
    status: isStuck ? 'STUCK' : isSlowing ? 'SLOWING' : 'ON_TRACK',
    recommendation: isStuck
      ? `Deal stuck in ${currentStage} for ${daysInStage} days (max: ${benchmark.maxDays}). Escalate or reassess.`
      : isSlowing
      ? `Deal in ${currentStage} for ${daysInStage} days (expected: ${benchmark.expectedDays}). Monitor closely.`
      : `Deal progressing normally in ${currentStage}`
  };
}

module.exports = {
  predictChampionChurn,
  predictEconomicBuyerRisk,
  predictMeetingProgressionRisk,
  predictDealRisk,
  analyzeStageVelocity,
  RISK_FACTORS,
  STAGE_VELOCITY_BENCHMARKS
};
