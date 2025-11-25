/**
 * Coverage Analysis Service - Breadth vs. Depth Analysis and Stakeholder Lifecycle Tracking
 * 
 * This service provides:
 * 1. Breadth Analysis - Number of roles represented
 * 2. Depth Analysis - How strongly each role is engaged (frequency + recency)
 * 3. Stakeholder Lifecycle Tracking - Engagement changes over time
 * 4. Champion Reliability Scoring
 */

const { BUYING_ROLE_WEIGHTS, KEY_ROLES } = require('./scoringService');

// Engagement recency weights (more recent = higher weight)
const RECENCY_WEIGHTS = {
  LAST_7_DAYS: 1.0,
  LAST_14_DAYS: 0.8,
  LAST_30_DAYS: 0.6,
  LAST_60_DAYS: 0.4,
  OLDER: 0.2
};

// Deal stage expectations for role coverage
const STAGE_ROLE_EXPECTATIONS = {
  // Early stages: Need Champion + Influencer
  'appointmentscheduled': {
    required: ['CHAMPION', 'INFLUENCER'],
    recommended: [],
    thresholdMultiplier: 0.6
  },
  'qualifiedtobuy': {
    required: ['CHAMPION', 'INFLUENCER'],
    recommended: ['DECISION_MAKER'],
    thresholdMultiplier: 0.7
  },
  // Mid stages: Need Decision Maker + Finance
  'presentationscheduled': {
    required: ['CHAMPION', 'DECISION_MAKER'],
    recommended: ['BUDGET_HOLDER'],
    thresholdMultiplier: 0.8
  },
  'decisionmakerboughtin': {
    required: ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION'],
    recommended: ['INFLUENCER'],
    thresholdMultiplier: 0.9
  },
  // Late stages: Need Legal + Procurement
  'contractsent': {
    required: ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION'],
    recommended: ['LEGAL', 'PROCUREMENT'],
    thresholdMultiplier: 1.0
  },
  'closedwon': {
    required: ['DECISION_MAKER', 'BUDGET_HOLDER'],
    recommended: [],
    thresholdMultiplier: 1.0
  },
  // Default for unknown stages
  'default': {
    required: ['CHAMPION'],
    recommended: ['DECISION_MAKER', 'BUDGET_HOLDER'],
    thresholdMultiplier: 0.7
  }
};

/**
 * Calculate breadth score - measures diversity of roles represented
 * @param {Array} contacts - Array of contacts with roles
 * @param {Object} options - Additional options
 * @returns {Object} Breadth analysis
 */
function calculateBreadthScore(contacts, options = {}) {
  const { dealStage = 'default' } = options;
  
  const coveredRoles = new Set();
  const roleContacts = {};
  
  contacts.forEach(contact => {
    const role = contact.effectiveRole || contact.properties?.hs_buying_role?.toUpperCase() || 'OTHER';
    coveredRoles.add(role);
    
    if (!roleContacts[role]) {
      roleContacts[role] = [];
    }
    roleContacts[role].push(contact);
  });
  
  const stageExpectations = STAGE_ROLE_EXPECTATIONS[dealStage] || STAGE_ROLE_EXPECTATIONS.default;
  
  // Check required roles coverage
  const missingRequired = stageExpectations.required.filter(role => !coveredRoles.has(role));
  const missingRecommended = stageExpectations.recommended.filter(role => !coveredRoles.has(role));
  const coveredRequired = stageExpectations.required.filter(role => coveredRoles.has(role));
  
  // Calculate breadth score
  const requiredCoverage = stageExpectations.required.length > 0
    ? (coveredRequired.length / stageExpectations.required.length) * 100
    : 100;
  
  // Bonus for additional roles beyond required
  const diversityBonus = Math.min((coveredRoles.size - coveredRequired.length) * 5, 20);
  
  const breadthScore = Math.min(Math.round(requiredCoverage * 0.8 + diversityBonus), 100);
  
  return {
    breadthScore,
    totalRolesRepresented: coveredRoles.size,
    coveredRoles: Array.from(coveredRoles),
    roleContacts,
    stageAnalysis: {
      dealStage,
      requiredRoles: stageExpectations.required,
      recommendedRoles: stageExpectations.recommended,
      missingRequired,
      missingRecommended,
      coveredRequired,
      thresholdMultiplier: stageExpectations.thresholdMultiplier
    }
  };
}

/**
 * Calculate depth score for a specific role - measures engagement strength
 * @param {Array} roleContacts - Contacts in this role
 * @param {Object} options - Additional options including recency data
 * @returns {Object} Depth analysis for the role
 */
function calculateRoleDepthScore(roleContacts, options = {}) {
  if (!roleContacts || roleContacts.length === 0) {
    return {
      depthScore: 0,
      engagementLevel: 'NONE',
      frequencyScore: 0,
      recencyScore: 0,
      contactCount: 0
    };
  }
  
  let totalEngagementScore = 0;
  let totalRecencyScore = 0;
  let activeContacts = 0;
  
  roleContacts.forEach(contact => {
    const engagements = contact.engagements || { total: 0 };
    const lastEngagement = contact.lastEngagementDate || null;
    
    // Frequency score based on total engagements
    const frequencyScore = Math.min(engagements.total * 10, 100);
    totalEngagementScore += frequencyScore;
    
    // Recency score based on last engagement
    const recencyScore = calculateRecencyScore(lastEngagement);
    totalRecencyScore += recencyScore;
    
    if (engagements.total > 0) {
      activeContacts++;
    }
  });
  
  const avgEngagement = roleContacts.length > 0 ? totalEngagementScore / roleContacts.length : 0;
  const avgRecency = roleContacts.length > 0 ? totalRecencyScore / roleContacts.length : 0;
  
  // Combined depth score (60% frequency, 40% recency)
  const depthScore = Math.round(avgEngagement * 0.6 + avgRecency * 0.4);
  
  // Determine engagement level
  let engagementLevel;
  if (depthScore >= 70) {
    engagementLevel = 'HIGH';
  } else if (depthScore >= 40) {
    engagementLevel = 'MEDIUM';
  } else if (depthScore > 0) {
    engagementLevel = 'LOW';
  } else {
    engagementLevel = 'NONE';
  }
  
  return {
    depthScore,
    engagementLevel,
    frequencyScore: Math.round(avgEngagement),
    recencyScore: Math.round(avgRecency),
    contactCount: roleContacts.length,
    activeContacts
  };
}

/**
 * Calculate recency score based on last engagement date
 * @param {Date|string|null} lastEngagementDate - Date of last engagement
 * @returns {number} Recency score 0-100
 */
function calculateRecencyScore(lastEngagementDate) {
  if (!lastEngagementDate) {
    return 0;
  }
  
  const now = new Date();
  const lastDate = new Date(lastEngagementDate);
  const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
  
  if (daysSince <= 7) {
    return 100 * RECENCY_WEIGHTS.LAST_7_DAYS;
  } else if (daysSince <= 14) {
    return 100 * RECENCY_WEIGHTS.LAST_14_DAYS;
  } else if (daysSince <= 30) {
    return 100 * RECENCY_WEIGHTS.LAST_30_DAYS;
  } else if (daysSince <= 60) {
    return 100 * RECENCY_WEIGHTS.LAST_60_DAYS;
  } else {
    return 100 * RECENCY_WEIGHTS.OLDER;
  }
}

/**
 * Calculate comprehensive depth analysis across all roles
 * @param {Array} contacts - Array of contacts
 * @param {Object} options - Additional options
 * @returns {Object} Overall depth analysis
 */
function calculateDepthScore(contacts, options = {}) {
  // Group contacts by role
  const roleGroups = {};
  contacts.forEach(contact => {
    const role = contact.effectiveRole || contact.properties?.hs_buying_role?.toUpperCase() || 'OTHER';
    if (!roleGroups[role]) {
      roleGroups[role] = [];
    }
    roleGroups[role].push(contact);
  });
  
  // Calculate depth for each role
  const roleDepths = {};
  let totalDepth = 0;
  let roleCount = 0;
  
  for (const [role, roleContacts] of Object.entries(roleGroups)) {
    const depth = calculateRoleDepthScore(roleContacts, options);
    roleDepths[role] = depth;
    totalDepth += depth.depthScore;
    roleCount++;
  }
  
  // Overall depth score
  const overallDepthScore = roleCount > 0 ? Math.round(totalDepth / roleCount) : 0;
  
  // Find strongest and weakest roles
  const sortedRoles = Object.entries(roleDepths)
    .sort((a, b) => b[1].depthScore - a[1].depthScore);
  
  const strongestRole = sortedRoles[0] || null;
  const weakestRole = sortedRoles[sortedRoles.length - 1] || null;
  
  return {
    overallDepthScore,
    roleDepths,
    strongestRole: strongestRole ? { role: strongestRole[0], ...strongestRole[1] } : null,
    weakestRole: weakestRole ? { role: weakestRole[0], ...weakestRole[1] } : null,
    roleCount
  };
}

/**
 * Calculate coverage analysis combining breadth and depth
 * @param {Array} contacts - Array of contacts
 * @param {Object} options - Options including dealStage
 * @returns {Object} Complete coverage analysis
 */
function calculateCoverageAnalysis(contacts, options = {}) {
  const breadthAnalysis = calculateBreadthScore(contacts, options);
  const depthAnalysis = calculateDepthScore(contacts, options);
  
  // Combined coverage score (50% breadth, 50% depth)
  const coverageScore = Math.round(
    breadthAnalysis.breadthScore * 0.5 + 
    depthAnalysis.overallDepthScore * 0.5
  );
  
  // Apply stage-specific threshold
  const adjustedThreshold = 70 * (breadthAnalysis.stageAnalysis.thresholdMultiplier || 1);
  const meetsStageExpectations = coverageScore >= adjustedThreshold;
  
  return {
    coverageScore,
    breadth: breadthAnalysis,
    depth: depthAnalysis,
    meetsStageExpectations,
    adjustedThreshold: Math.round(adjustedThreshold)
  };
}

/**
 * Track stakeholder engagement changes over time
 * @param {Object} currentSnapshot - Current engagement snapshot
 * @param {Object} previousSnapshot - Previous engagement snapshot (from storage)
 * @returns {Object} Lifecycle changes and alerts
 */
function trackStakeholderLifecycle(currentSnapshot, previousSnapshot = null) {
  const alerts = [];
  const changes = [];
  
  if (!previousSnapshot) {
    return {
      alerts: [],
      changes: [],
      isFirstSnapshot: true,
      summary: 'First engagement snapshot recorded'
    };
  }
  
  const currentContacts = currentSnapshot.contacts || [];
  const previousContacts = previousSnapshot.contacts || [];
  
  // Helper function to get unique contact identifier
  const getContactId = (contact) => {
    // Prefer contactId, then id, then email as fallback for uniqueness
    return contact.contactId || contact.id || contact.email || null;
  };
  
  // Create maps for comparison, filtering out contacts without valid IDs
  const currentMap = new Map(
    currentContacts
      .filter(c => getContactId(c) !== null)
      .map(c => [getContactId(c), c])
  );
  const previousMap = new Map(
    previousContacts
      .filter(c => getContactId(c) !== null)
      .map(c => [getContactId(c), c])
  );
  
  // Check for engagement changes per contact
  for (const [contactId, currentContact] of currentMap) {
    const previousContact = previousMap.get(contactId);
    
    if (!previousContact) {
      // New stakeholder added
      changes.push({
        type: 'NEW_STAKEHOLDER',
        contactId,
        contactName: currentContact.name || 'Unknown',
        role: currentContact.role || currentContact.effectiveRole,
        message: `New stakeholder added: ${currentContact.name} (${currentContact.role || 'Role unspecified'})`
      });
      continue;
    }
    
    const currentEngagement = currentContact.engagementScore || 0;
    const previousEngagement = previousContact.engagementScore || 0;
    const engagementChange = currentEngagement - previousEngagement;
    
    // Significant engagement changes
    if (engagementChange <= -20) {
      const change = {
        type: 'ENGAGEMENT_DECREASED',
        contactId,
        contactName: currentContact.name,
        role: currentContact.role || currentContact.effectiveRole,
        previousScore: previousEngagement,
        currentScore: currentEngagement,
        change: engagementChange
      };
      changes.push(change);
      
      // Generate alerts for key roles
      const role = (currentContact.role || currentContact.effectiveRole || '').toUpperCase();
      if (role === 'CHAMPION') {
        alerts.push({
          priority: 'HIGH',
          type: 'CHAMPION_COOLING',
          title: '⚠️ Champion is cooling off',
          message: `${currentContact.name}'s engagement dropped from ${previousEngagement} to ${currentEngagement}`,
          action: 'Schedule a check-in with your champion to maintain momentum'
        });
      } else if (role === 'DECISION_MAKER' && currentEngagement < 30) {
        alerts.push({
          priority: 'HIGH',
          type: 'DM_DISENGAGED',
          title: '🚨 Decision Maker disengaged',
          message: `${currentContact.name} hasn't engaged recently (score: ${currentEngagement})`,
          action: 'Request a meeting with the decision maker through your champion'
        });
      }
    } else if (engagementChange >= 20) {
      changes.push({
        type: 'ENGAGEMENT_INCREASED',
        contactId,
        contactName: currentContact.name,
        role: currentContact.role || currentContact.effectiveRole,
        previousScore: previousEngagement,
        currentScore: currentEngagement,
        change: engagementChange
      });
      
      const role = (currentContact.role || currentContact.effectiveRole || '').toUpperCase();
      if (role === 'BUDGET_HOLDER') {
        alerts.push({
          priority: 'MEDIUM',
          type: 'BUDGET_HOLDER_ENGAGED',
          title: '💰 Budget Holder engagement increased',
          message: `${currentContact.name}'s engagement increased from ${previousEngagement} to ${currentEngagement}`,
          action: 'Good sign! Consider discussing budget and timeline'
        });
      }
    }
  }
  
  // Check for removed stakeholders
  for (const [contactId, previousContact] of previousMap) {
    if (!currentMap.has(contactId)) {
      changes.push({
        type: 'STAKEHOLDER_REMOVED',
        contactId,
        contactName: previousContact.name || 'Unknown',
        role: previousContact.role || previousContact.effectiveRole,
        message: `Stakeholder removed: ${previousContact.name}`
      });
    }
  }
  
  // Check days since engagement for key roles
  const now = new Date();
  for (const contact of currentContacts) {
    const role = (contact.role || contact.effectiveRole || '').toUpperCase();
    const lastEngagement = contact.lastEngagementDate ? new Date(contact.lastEngagementDate) : null;
    
    if (lastEngagement) {
      const daysSince = Math.floor((now - lastEngagement) / (1000 * 60 * 60 * 24));
      
      if (role === 'DECISION_MAKER' && daysSince >= 14) {
        alerts.push({
          priority: 'HIGH',
          type: 'DM_INACTIVE',
          title: `⏰ DM hasn't engaged in ${daysSince} days`,
          message: `${contact.name} (Decision Maker) last engaged ${daysSince} days ago`,
          action: 'Reach out to re-engage the decision maker'
        });
      } else if (role === 'CHAMPION' && daysSince >= 9) {
        alerts.push({
          priority: 'MEDIUM',
          type: 'CHAMPION_INACTIVE',
          title: `⏰ Champion inactive ${daysSince} days`,
          message: `${contact.name} (Champion) last engaged ${daysSince} days ago`,
          action: 'Check in with your champion to maintain relationship'
        });
      }
    }
  }
  
  // Overall score change
  const scoreDelta = (currentSnapshot.overallScore || 0) - (previousSnapshot.overallScore || 0);
  if (Math.abs(scoreDelta) >= 10) {
    changes.push({
      type: 'SCORE_CHANGE',
      previousScore: previousSnapshot.overallScore,
      currentScore: currentSnapshot.overallScore,
      change: scoreDelta,
      message: `Score ${scoreDelta > 0 ? 'increased' : 'dropped'} from ${previousSnapshot.overallScore} → ${currentSnapshot.overallScore}`
    });
  }
  
  // Thread depth change
  const depthDelta = (currentSnapshot.threadDepth || 0) - (previousSnapshot.threadDepth || 0);
  if (depthDelta !== 0) {
    changes.push({
      type: 'DEPTH_CHANGE',
      previousDepth: previousSnapshot.threadDepth,
      currentDepth: currentSnapshot.threadDepth,
      change: depthDelta,
      message: `Thread depth ${depthDelta > 0 ? 'increased' : 'decreased'} from ${previousSnapshot.threadDepth} → ${currentSnapshot.threadDepth} contacts`
    });
  }
  
  return {
    alerts: alerts.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    changes,
    isFirstSnapshot: false,
    summary: `${changes.length} changes detected, ${alerts.length} alerts generated`
  };
}

/**
 * Calculate Champion Reliability Score
 * Based on responsiveness, advocacy indicators, meeting attendance, and influence
 * @param {Object} champion - Champion contact data
 * @param {Object} options - Additional data for scoring
 * @returns {Object} Champion strength analysis
 */
function calculateChampionStrength(champion, options = {}) {
  if (!champion) {
    return {
      strengthScore: 0,
      reliability: 'NONE',
      factors: [],
      recommendations: ['Identify and develop a champion within the organization']
    };
  }
  
  const factors = [];
  let totalScore = 0;
  
  const engagements = champion.engagements || { emails: 0, meetings: 0, calls: 0, total: 0 };
  const { responseRate = null, advocacyIndicators = [], meetingAttendance = null } = options;
  
  // Factor 1: Responsiveness (0-25 points)
  if (responseRate !== null) {
    const responsivenessScore = Math.min(responseRate * 25, 25);
    factors.push({
      name: 'Responsiveness',
      score: Math.round(responsivenessScore),
      maxScore: 25,
      description: `Response rate: ${Math.round(responseRate * 100)}%`
    });
    totalScore += responsivenessScore;
  } else {
    // Estimate from engagement frequency
    const estimatedResponsiveness = Math.min(engagements.total * 2, 25);
    factors.push({
      name: 'Responsiveness (estimated)',
      score: Math.round(estimatedResponsiveness),
      maxScore: 25,
      description: `Based on ${engagements.total} total engagements`
    });
    totalScore += estimatedResponsiveness;
  }
  
  // Factor 2: Advocacy indicators (0-25 points)
  const advocacyScore = Math.min(advocacyIndicators.length * 5 + 5, 25);
  factors.push({
    name: 'Advocacy',
    score: advocacyScore,
    maxScore: 25,
    description: advocacyIndicators.length > 0 
      ? `${advocacyIndicators.length} advocacy indicators detected`
      : 'No specific advocacy indicators detected'
  });
  totalScore += advocacyScore;
  
  // Factor 3: Meeting attendance (0-25 points)
  if (meetingAttendance !== null) {
    const attendanceScore = Math.min(meetingAttendance * 25, 25);
    factors.push({
      name: 'Meeting Attendance',
      score: Math.round(attendanceScore),
      maxScore: 25,
      description: `Attendance rate: ${Math.round(meetingAttendance * 100)}%`
    });
    totalScore += attendanceScore;
  } else {
    // Estimate from meeting count
    const meetingScore = Math.min(engagements.meetings * 5, 25);
    factors.push({
      name: 'Meeting Participation',
      score: meetingScore,
      maxScore: 25,
      description: `Participated in ${engagements.meetings} meetings`
    });
    totalScore += meetingScore;
  }
  
  // Factor 4: Influence role (0-25 points) - based on job title/seniority
  const jobTitle = champion.properties?.jobtitle || champion.jobTitle || '';
  let influenceScore = 10; // Base score
  
  if (/\b(senior|sr\.|lead|principal|director|vp|head)\b/i.test(jobTitle)) {
    influenceScore = 25;
  } else if (/\b(manager|supervisor)\b/i.test(jobTitle)) {
    influenceScore = 20;
  } else if (/\b(specialist|consultant|analyst)\b/i.test(jobTitle)) {
    influenceScore = 15;
  }
  
  factors.push({
    name: 'Influence Level',
    score: influenceScore,
    maxScore: 25,
    description: jobTitle || 'Title not specified'
  });
  totalScore += influenceScore;
  
  // Calculate reliability level
  let reliability;
  if (totalScore >= 80) {
    reliability = 'STRONG';
  } else if (totalScore >= 60) {
    reliability = 'MODERATE';
  } else if (totalScore >= 40) {
    reliability = 'DEVELOPING';
  } else {
    reliability = 'WEAK';
  }
  
  // Generate recommendations
  const recommendations = [];
  if (factors.find(f => f.name.includes('Responsiveness') && f.score < 15)) {
    recommendations.push('Improve communication frequency with champion');
  }
  if (factors.find(f => f.name === 'Advocacy' && f.score < 15)) {
    recommendations.push('Provide champion with compelling content to share internally');
  }
  if (factors.find(f => f.name.includes('Meeting') && f.score < 15)) {
    recommendations.push('Increase meeting frequency with champion');
  }
  if (reliability === 'WEAK') {
    recommendations.push('Consider identifying an additional or alternative champion');
  }
  
  return {
    strengthScore: Math.round(totalScore),
    reliability,
    factors,
    recommendations: recommendations.length > 0 ? recommendations : ['Champion is performing well - maintain current engagement']
  };
}

/**
 * Generate "What's Missing?" checklist based on analysis
 * @param {Object} analysisData - Coverage analysis and score data
 * @returns {Array} Checklist items with status
 */
function generateMissingChecklist(analysisData) {
  const checklist = [];
  const { breadth, depth, coverageScore } = analysisData;
  
  // Missing required roles
  if (breadth?.stageAnalysis?.missingRequired?.length > 0) {
    breadth.stageAnalysis.missingRequired.forEach(role => {
      checklist.push({
        category: 'MISSING_ROLE',
        priority: 'HIGH',
        status: 'MISSING',
        title: `Missing ${role.toLowerCase().replace('_', ' ')}`,
        description: `No ${role.toLowerCase().replace('_', ' ')} identified for this deal stage`,
        action: `Identify and add a ${role.toLowerCase().replace('_', ' ')} to the deal`
      });
    });
  }
  
  // Missing recommended roles
  if (breadth?.stageAnalysis?.missingRecommended?.length > 0) {
    breadth.stageAnalysis.missingRecommended.forEach(role => {
      checklist.push({
        category: 'RECOMMENDED_ROLE',
        priority: 'MEDIUM',
        status: 'RECOMMENDED',
        title: `Consider adding ${role.toLowerCase().replace('_', ' ')}`,
        description: `${role.toLowerCase().replace('_', ' ')} recommended for this deal stage`,
        action: `Identify a ${role.toLowerCase().replace('_', ' ')} in the organization`
      });
    });
  }
  
  // Low depth roles
  if (depth?.roleDepths) {
    Object.entries(depth.roleDepths).forEach(([role, roleDepth]) => {
      if (roleDepth.engagementLevel === 'LOW' && KEY_ROLES.includes(role)) {
        checklist.push({
          category: 'LOW_ENGAGEMENT',
          priority: 'MEDIUM',
          status: 'NEEDS_ATTENTION',
          title: `${role.toLowerCase().replace('_', ' ')} engagement low`,
          description: `${role} engagement score is ${roleDepth.depthScore}/100`,
          action: `Increase engagement with the ${role.toLowerCase().replace('_', ' ')}`
        });
      }
    });
  }
  
  // Seniority check
  if (breadth?.coveredRoles && !breadth.coveredRoles.some(r => ['DECISION_MAKER', 'BUDGET_HOLDER'].includes(r))) {
    checklist.push({
      category: 'SENIORITY',
      priority: 'HIGH',
      status: 'MISSING',
      title: 'Not enough seniority',
      description: 'No executive-level stakeholders identified',
      action: 'Identify and engage senior decision-makers'
    });
  }
  
  // Finance involvement
  if (!breadth?.coveredRoles?.includes('BUDGET_HOLDER')) {
    checklist.push({
      category: 'FINANCE',
      priority: 'MEDIUM',
      status: 'MISSING',
      title: 'No finance involvement',
      description: 'Budget holder not yet engaged',
      action: 'Request introduction to finance/procurement contact'
    });
  }
  
  return checklist.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

module.exports = {
  calculateBreadthScore,
  calculateDepthScore,
  calculateRoleDepthScore,
  calculateRecencyScore,
  calculateCoverageAnalysis,
  trackStakeholderLifecycle,
  calculateChampionStrength,
  generateMissingChecklist,
  STAGE_ROLE_EXPECTATIONS,
  RECENCY_WEIGHTS
};
