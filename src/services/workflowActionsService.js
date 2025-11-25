/**
 * Workflow Actions Service - Custom HubSpot workflow actions
 * 
 * This service provides:
 * 1. Custom workflow action handlers
 * 2. Score threshold triggers
 * 3. Role-based notification triggers
 * 4. Automatic task creation
 */

const { calculateMultiThreadingScore } = require('./scoringService');
const { calculateCoverageAnalysis } = require('./coverageAnalysisService');

// Workflow action types
const WORKFLOW_ACTIONS = {
  CHECK_SCORE_THRESHOLD: 'check_score_threshold',
  CHECK_ROLE_COVERAGE: 'check_role_coverage',
  CHECK_STAKEHOLDER_COUNT: 'check_stakeholder_count',
  NOTIFY_ON_CONDITION: 'notify_on_condition',
  CREATE_TASK: 'create_task',
  UPDATE_DEAL_PROPERTY: 'update_deal_property',
  RECALCULATE_SCORE: 'recalculate_score'
};

// Action result types for HubSpot workflow
const ACTION_RESULTS = {
  CONDITION_MET: 'CONDITION_MET',
  CONDITION_NOT_MET: 'CONDITION_NOT_MET',
  ACTION_COMPLETED: 'ACTION_COMPLETED',
  ACTION_FAILED: 'ACTION_FAILED'
};

/**
 * Handle workflow action: Check if score is below threshold
 * @param {Object} params - Action parameters
 * @param {Object} dealData - Deal with contacts
 * @returns {Object} Action result
 */
function handleScoreThresholdCheck(params, dealData) {
  const { threshold = 40, comparison = 'LESS_THAN' } = params;
  const scoreData = calculateMultiThreadingScore(dealData);
  
  let conditionMet = false;
  
  switch (comparison) {
    case 'LESS_THAN':
      conditionMet = scoreData.overallScore < threshold;
      break;
    case 'LESS_THAN_OR_EQUAL':
      conditionMet = scoreData.overallScore <= threshold;
      break;
    case 'GREATER_THAN':
      conditionMet = scoreData.overallScore > threshold;
      break;
    case 'GREATER_THAN_OR_EQUAL':
      conditionMet = scoreData.overallScore >= threshold;
      break;
    case 'EQUALS':
      conditionMet = scoreData.overallScore === threshold;
      break;
    default:
      conditionMet = scoreData.overallScore < threshold;
  }
  
  return {
    result: conditionMet ? ACTION_RESULTS.CONDITION_MET : ACTION_RESULTS.CONDITION_NOT_MET,
    outputFields: {
      current_score: scoreData.overallScore,
      threshold_value: threshold,
      comparison_type: comparison,
      condition_met: conditionMet,
      risk_level: scoreData.riskLevel,
      stakeholder_count: scoreData.contactCount
    }
  };
}

/**
 * Handle workflow action: Check if specific role is engaged
 * @param {Object} params - Action parameters
 * @param {Object} dealData - Deal with contacts
 * @returns {Object} Action result
 */
function handleRoleCoverageCheck(params, dealData) {
  const { role = 'DECISION_MAKER', engagementThreshold = 0 } = params;
  const scoreData = calculateMultiThreadingScore(dealData);
  
  const roleContacts = scoreData.contacts.filter(c => 
    (c.role || '').toUpperCase() === role.toUpperCase() ||
    (c.effectiveRole || '').toUpperCase() === role.toUpperCase()
  );
  
  const hasRole = roleContacts.length > 0;
  const hasEngagedRole = roleContacts.some(c => c.engagementScore >= engagementThreshold);
  
  return {
    result: hasEngagedRole ? ACTION_RESULTS.CONDITION_MET : ACTION_RESULTS.CONDITION_NOT_MET,
    outputFields: {
      role_checked: role,
      role_present: hasRole,
      role_engaged: hasEngagedRole,
      contacts_in_role: roleContacts.length,
      engagement_threshold: engagementThreshold,
      role_contacts: roleContacts.map(c => ({
        name: c.name,
        email: c.email,
        engagementScore: c.engagementScore
      }))
    }
  };
}

/**
 * Handle workflow action: Check stakeholder count
 * @param {Object} params - Action parameters
 * @param {Object} dealData - Deal with contacts
 * @returns {Object} Action result
 */
function handleStakeholderCountCheck(params, dealData) {
  const { minCount = 3, countEngagedOnly = false, engagementThreshold = 20 } = params;
  const scoreData = calculateMultiThreadingScore(dealData);
  
  let count;
  if (countEngagedOnly) {
    count = scoreData.contacts.filter(c => c.engagementScore >= engagementThreshold).length;
  } else {
    count = scoreData.contactCount;
  }
  
  const conditionMet = count >= minCount;
  
  return {
    result: conditionMet ? ACTION_RESULTS.CONDITION_MET : ACTION_RESULTS.CONDITION_NOT_MET,
    outputFields: {
      stakeholder_count: count,
      minimum_required: minCount,
      counted_engaged_only: countEngagedOnly,
      condition_met: conditionMet,
      is_single_threaded: count <= 1
    }
  };
}

// HubSpot association type IDs
const ASSOCIATION_TYPE_IDS = {
  TASK_TO_DEAL: 216,
  TASK_TO_CONTACT: 214
};

/**
 * Generate task creation payload for HubSpot
 * @param {Object} params - Task parameters
 * @param {Object} dealData - Deal data
 * @param {Object} scoreData - Score analysis
 * @returns {Object} Task creation payload
 */
function generateTaskPayload(params, dealData, scoreData) {
  const {
    taskType = 'TODO',
    subject = 'Multi-Threading Action Required',
    notes = '',
    dueInDays = 3,
    priority = 'MEDIUM',
    ownerId = null
  } = params;
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueInDays);
  
  // Generate dynamic notes based on score
  let dynamicNotes = notes;
  if (!dynamicNotes) {
    dynamicNotes = `Multi-Threading Score: ${scoreData.overallScore}/100 (${scoreData.riskLevel} risk)\n`;
    dynamicNotes += `Stakeholders: ${scoreData.contactCount}\n`;
    dynamicNotes += `Engaged contacts: ${scoreData.threadDepth}\n`;
    
    if (scoreData.missingKeyRoles.length > 0) {
      dynamicNotes += `\nMissing roles: ${scoreData.missingKeyRoles.join(', ')}`;
    }
  }
  
  return {
    properties: {
      hs_task_subject: subject,
      hs_task_body: dynamicNotes,
      hs_task_status: 'NOT_STARTED',
      hs_task_type: taskType,
      hs_task_priority: priority,
      hs_timestamp: dueDate.getTime()
    },
    associations: [
      {
        to: { id: dealData.dealId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: ASSOCIATION_TYPE_IDS.TASK_TO_DEAL }]
      }
    ],
    ownerId
  };
}

/**
 * Generate notification payload
 * @param {Object} params - Notification parameters
 * @param {Object} dealData - Deal data
 * @param {Object} scoreData - Score analysis
 * @returns {Object} Notification content
 */
function generateNotificationPayload(params, dealData, scoreData) {
  const {
    notificationType = 'DEAL_ALERT',
    recipientType = 'DEAL_OWNER',
    customMessage = null
  } = params;
  
  let message = customMessage;
  
  if (!message) {
    switch (notificationType) {
      case 'SCORE_BELOW_THRESHOLD':
        message = `Deal "${dealData.deal?.dealname}" has a multi-threading score of ${scoreData.overallScore} (${scoreData.riskLevel} risk). Action recommended.`;
        break;
      case 'MISSING_ROLE':
        message = `Deal "${dealData.deal?.dealname}" is missing key roles: ${scoreData.missingKeyRoles.join(', ')}. Please identify and add stakeholders.`;
        break;
      case 'SINGLE_THREADED':
        message = `Deal "${dealData.deal?.dealname}" is single-threaded with only ${scoreData.contactCount} contact(s). High risk - add more stakeholders.`;
        break;
      default:
        message = `Multi-threading alert for deal "${dealData.deal?.dealname}". Score: ${scoreData.overallScore}/100`;
    }
  }
  
  return {
    recipientType,
    notificationType,
    message,
    dealId: dealData.dealId,
    dealName: dealData.deal?.dealname,
    score: scoreData.overallScore,
    riskLevel: scoreData.riskLevel
  };
}

/**
 * Main workflow action handler
 * @param {string} actionType - Type of action
 * @param {Object} params - Action parameters
 * @param {Object} dealData - Deal with contacts
 * @returns {Object} Action result
 */
function handleWorkflowAction(actionType, params, dealData) {
  try {
    const scoreData = calculateMultiThreadingScore(dealData);
    
    switch (actionType) {
      case WORKFLOW_ACTIONS.CHECK_SCORE_THRESHOLD:
        return handleScoreThresholdCheck(params, dealData);
        
      case WORKFLOW_ACTIONS.CHECK_ROLE_COVERAGE:
        return handleRoleCoverageCheck(params, dealData);
        
      case WORKFLOW_ACTIONS.CHECK_STAKEHOLDER_COUNT:
        return handleStakeholderCountCheck(params, dealData);
        
      case WORKFLOW_ACTIONS.CREATE_TASK:
        return {
          result: ACTION_RESULTS.ACTION_COMPLETED,
          taskPayload: generateTaskPayload(params, dealData, scoreData)
        };
        
      case WORKFLOW_ACTIONS.NOTIFY_ON_CONDITION:
        return {
          result: ACTION_RESULTS.ACTION_COMPLETED,
          notification: generateNotificationPayload(params, dealData, scoreData)
        };
        
      case WORKFLOW_ACTIONS.RECALCULATE_SCORE:
        const coverageAnalysis = calculateCoverageAnalysis(
          dealData.contacts || [], 
          { dealStage: dealData.deal?.dealstage }
        );
        return {
          result: ACTION_RESULTS.ACTION_COMPLETED,
          outputFields: {
            overall_score: scoreData.overallScore,
            engagement_score: scoreData.engagementScore,
            participation_score: scoreData.participationScore,
            role_coverage_score: scoreData.roleCoverageScore,
            breadth_score: coverageAnalysis.breadth.breadthScore,
            depth_score: coverageAnalysis.depth.overallDepthScore,
            coverage_score: coverageAnalysis.coverageScore,
            risk_level: scoreData.riskLevel,
            thread_depth: scoreData.threadDepth,
            contact_count: scoreData.contactCount,
            covered_roles: scoreData.coveredRoles.join(', '),
            missing_roles: scoreData.missingKeyRoles.join(', ')
          }
        };
        
      case WORKFLOW_ACTIONS.UPDATE_DEAL_PROPERTY:
        return {
          result: ACTION_RESULTS.ACTION_COMPLETED,
          propertyUpdates: {
            multi_thread_score: scoreData.overallScore,
            stakeholder_count: scoreData.contactCount,
            engagement_score: scoreData.engagementScore,
            role_coverage_score: scoreData.roleCoverageScore,
            multi_thread_risk_level: scoreData.riskLevel
          }
        };
        
      default:
        return {
          result: ACTION_RESULTS.ACTION_FAILED,
          error: `Unknown action type: ${actionType}`
        };
    }
  } catch (error) {
    return {
      result: ACTION_RESULTS.ACTION_FAILED,
      error: error.message
    };
  }
}

/**
 * Get available workflow actions configuration
 * For use in HubSpot app configuration
 * @returns {Array} Available actions
 */
function getAvailableActions() {
  return [
    {
      actionType: WORKFLOW_ACTIONS.CHECK_SCORE_THRESHOLD,
      label: 'Check Multi-Threading Score',
      description: 'Checks if the deal\'s multi-threading score meets a threshold',
      inputFields: [
        {
          name: 'threshold',
          label: 'Score Threshold',
          type: 'number',
          default: 40,
          required: true
        },
        {
          name: 'comparison',
          label: 'Comparison',
          type: 'enumeration',
          options: ['LESS_THAN', 'LESS_THAN_OR_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'EQUALS'],
          default: 'LESS_THAN',
          required: true
        }
      ],
      outputFields: ['current_score', 'threshold_value', 'condition_met', 'risk_level']
    },
    {
      actionType: WORKFLOW_ACTIONS.CHECK_ROLE_COVERAGE,
      label: 'Check Role Engagement',
      description: 'Checks if a specific buying role is engaged on the deal',
      inputFields: [
        {
          name: 'role',
          label: 'Buying Role',
          type: 'enumeration',
          options: ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION', 'INFLUENCER', 'END_USER'],
          default: 'DECISION_MAKER',
          required: true
        },
        {
          name: 'engagementThreshold',
          label: 'Minimum Engagement Score',
          type: 'number',
          default: 20,
          required: false
        }
      ],
      outputFields: ['role_present', 'role_engaged', 'contacts_in_role']
    },
    {
      actionType: WORKFLOW_ACTIONS.CHECK_STAKEHOLDER_COUNT,
      label: 'Check Stakeholder Count',
      description: 'Checks if deal has minimum number of stakeholders',
      inputFields: [
        {
          name: 'minCount',
          label: 'Minimum Stakeholders',
          type: 'number',
          default: 3,
          required: true
        },
        {
          name: 'countEngagedOnly',
          label: 'Count Engaged Only',
          type: 'boolean',
          default: false,
          required: false
        }
      ],
      outputFields: ['stakeholder_count', 'is_single_threaded', 'condition_met']
    },
    {
      actionType: WORKFLOW_ACTIONS.RECALCULATE_SCORE,
      label: 'Recalculate Multi-Threading Score',
      description: 'Recalculates and returns all score components',
      inputFields: [],
      outputFields: [
        'overall_score', 'engagement_score', 'participation_score',
        'role_coverage_score', 'breadth_score', 'depth_score',
        'risk_level', 'thread_depth', 'contact_count'
      ]
    },
    {
      actionType: WORKFLOW_ACTIONS.CREATE_TASK,
      label: 'Create Multi-Threading Task',
      description: 'Creates a task to address multi-threading issues',
      inputFields: [
        {
          name: 'subject',
          label: 'Task Subject',
          type: 'string',
          default: 'Address Multi-Threading Issues',
          required: true
        },
        {
          name: 'dueInDays',
          label: 'Due In Days',
          type: 'number',
          default: 3,
          required: false
        },
        {
          name: 'priority',
          label: 'Priority',
          type: 'enumeration',
          options: ['HIGH', 'MEDIUM', 'LOW'],
          default: 'MEDIUM',
          required: false
        }
      ],
      outputFields: ['task_created']
    },
    {
      actionType: WORKFLOW_ACTIONS.NOTIFY_ON_CONDITION,
      label: 'Send Multi-Threading Alert',
      description: 'Sends notification about multi-threading status',
      inputFields: [
        {
          name: 'notificationType',
          label: 'Alert Type',
          type: 'enumeration',
          options: ['SCORE_BELOW_THRESHOLD', 'MISSING_ROLE', 'SINGLE_THREADED', 'CUSTOM'],
          default: 'SCORE_BELOW_THRESHOLD',
          required: true
        },
        {
          name: 'recipientType',
          label: 'Recipient',
          type: 'enumeration',
          options: ['DEAL_OWNER', 'TEAM_MANAGER', 'CUSTOM'],
          default: 'DEAL_OWNER',
          required: true
        }
      ],
      outputFields: ['notification_sent']
    }
  ];
}

module.exports = {
  handleWorkflowAction,
  handleScoreThresholdCheck,
  handleRoleCoverageCheck,
  handleStakeholderCountCheck,
  generateTaskPayload,
  generateNotificationPayload,
  getAvailableActions,
  WORKFLOW_ACTIONS,
  ACTION_RESULTS
};
