const {
  handleWorkflowAction,
  handleScoreThresholdCheck,
  handleRoleCoverageCheck,
  handleStakeholderCountCheck,
  getAvailableActions,
  WORKFLOW_ACTIONS,
  ACTION_RESULTS
} = require('../src/services/workflowActionsService');

describe('Workflow Actions Service', () => {
  const mockDealData = {
    dealId: '123',
    deal: {
      dealname: 'Test Deal',
      dealstage: 'qualifiedtobuy'
    },
    contacts: [
      {
        id: '1',
        properties: {
          firstname: 'John',
          lastname: 'Doe',
          hs_buying_role: 'DECISION_MAKER',
          jobtitle: 'CEO'
        },
        engagements: { emails: 5, meetings: 3, calls: 2, total: 10 }
      },
      {
        id: '2',
        properties: {
          firstname: 'Jane',
          lastname: 'Smith',
          hs_buying_role: 'CHAMPION',
          jobtitle: 'Product Manager'
        },
        engagements: { emails: 8, meetings: 5, calls: 3, total: 16 }
      }
    ]
  };

  describe('handleScoreThresholdCheck', () => {
    test('returns CONDITION_MET when score below threshold', () => {
      const lowScoreDeal = {
        ...mockDealData,
        contacts: [{
          id: '1',
          properties: {},
          engagements: { total: 1 }
        }]
      };
      
      const result = handleScoreThresholdCheck({ threshold: 60, comparison: 'LESS_THAN' }, lowScoreDeal);
      
      expect(result.result).toBe(ACTION_RESULTS.CONDITION_MET);
      expect(result.outputFields.condition_met).toBe(true);
    });

    test('returns CONDITION_NOT_MET when score above threshold', () => {
      const result = handleScoreThresholdCheck({ threshold: 30, comparison: 'LESS_THAN' }, mockDealData);
      
      expect(result.result).toBe(ACTION_RESULTS.CONDITION_NOT_MET);
      expect(result.outputFields.condition_met).toBe(false);
    });

    test('supports GREATER_THAN comparison', () => {
      const result = handleScoreThresholdCheck({ threshold: 30, comparison: 'GREATER_THAN' }, mockDealData);
      
      expect(result.outputFields.comparison_type).toBe('GREATER_THAN');
    });

    test('supports EQUALS comparison', () => {
      const result = handleScoreThresholdCheck({ threshold: 50, comparison: 'EQUALS' }, mockDealData);
      
      expect(result.outputFields.comparison_type).toBe('EQUALS');
    });
  });

  describe('handleRoleCoverageCheck', () => {
    test('returns CONDITION_MET when role is present and engaged', () => {
      const result = handleRoleCoverageCheck(
        { role: 'DECISION_MAKER', engagementThreshold: 20 },
        mockDealData
      );
      
      expect(result.result).toBe(ACTION_RESULTS.CONDITION_MET);
      expect(result.outputFields.role_present).toBe(true);
      expect(result.outputFields.role_engaged).toBe(true);
    });

    test('returns CONDITION_NOT_MET when role is missing', () => {
      const result = handleRoleCoverageCheck(
        { role: 'BUDGET_HOLDER', engagementThreshold: 0 },
        mockDealData
      );
      
      expect(result.result).toBe(ACTION_RESULTS.CONDITION_NOT_MET);
      expect(result.outputFields.role_present).toBe(false);
    });

    test('returns contacts in role', () => {
      const result = handleRoleCoverageCheck(
        { role: 'CHAMPION', engagementThreshold: 0 },
        mockDealData
      );
      
      expect(result.outputFields.contacts_in_role).toBe(1);
      expect(result.outputFields.role_contacts.length).toBe(1);
    });
  });

  describe('handleStakeholderCountCheck', () => {
    test('returns CONDITION_MET when count meets minimum', () => {
      const result = handleStakeholderCountCheck(
        { minCount: 2, countEngagedOnly: false },
        mockDealData
      );
      
      expect(result.result).toBe(ACTION_RESULTS.CONDITION_MET);
      expect(result.outputFields.stakeholder_count).toBe(2);
    });

    test('returns CONDITION_NOT_MET when count below minimum', () => {
      const result = handleStakeholderCountCheck(
        { minCount: 5, countEngagedOnly: false },
        mockDealData
      );
      
      expect(result.result).toBe(ACTION_RESULTS.CONDITION_NOT_MET);
    });

    test('counts only engaged contacts when specified', () => {
      const dealWithMixedEngagement = {
        ...mockDealData,
        contacts: [
          ...mockDealData.contacts,
          {
            id: '3',
            properties: {},
            engagements: { total: 0 }
          }
        ]
      };
      
      const result = handleStakeholderCountCheck(
        { minCount: 2, countEngagedOnly: true, engagementThreshold: 20 },
        dealWithMixedEngagement
      );
      
      expect(result.outputFields.counted_engaged_only).toBe(true);
    });

    test('identifies single-threaded deals', () => {
      const singleContactDeal = {
        ...mockDealData,
        contacts: [mockDealData.contacts[0]]
      };
      
      const result = handleStakeholderCountCheck(
        { minCount: 1 },
        singleContactDeal
      );
      
      expect(result.outputFields.is_single_threaded).toBe(true);
    });
  });

  describe('handleWorkflowAction', () => {
    test('handles CHECK_SCORE_THRESHOLD action', () => {
      const result = handleWorkflowAction(
        WORKFLOW_ACTIONS.CHECK_SCORE_THRESHOLD,
        { threshold: 50 },
        mockDealData
      );
      
      expect(result.result).toBeDefined();
      expect(result.outputFields).toBeDefined();
    });

    test('handles RECALCULATE_SCORE action', () => {
      const result = handleWorkflowAction(
        WORKFLOW_ACTIONS.RECALCULATE_SCORE,
        {},
        mockDealData
      );
      
      expect(result.result).toBe(ACTION_RESULTS.ACTION_COMPLETED);
      expect(result.outputFields.overall_score).toBeDefined();
      expect(result.outputFields.engagement_score).toBeDefined();
      expect(result.outputFields.breadth_score).toBeDefined();
      expect(result.outputFields.depth_score).toBeDefined();
    });

    test('handles CREATE_TASK action', () => {
      const result = handleWorkflowAction(
        WORKFLOW_ACTIONS.CREATE_TASK,
        { subject: 'Follow up on multi-threading', dueInDays: 5 },
        mockDealData
      );
      
      expect(result.result).toBe(ACTION_RESULTS.ACTION_COMPLETED);
      expect(result.taskPayload).toBeDefined();
      expect(result.taskPayload.properties.hs_task_subject).toBe('Follow up on multi-threading');
    });

    test('handles NOTIFY_ON_CONDITION action', () => {
      const result = handleWorkflowAction(
        WORKFLOW_ACTIONS.NOTIFY_ON_CONDITION,
        { notificationType: 'SCORE_BELOW_THRESHOLD' },
        mockDealData
      );
      
      expect(result.result).toBe(ACTION_RESULTS.ACTION_COMPLETED);
      expect(result.notification).toBeDefined();
      expect(result.notification.message).toBeDefined();
    });

    test('handles UPDATE_DEAL_PROPERTY action', () => {
      const result = handleWorkflowAction(
        WORKFLOW_ACTIONS.UPDATE_DEAL_PROPERTY,
        {},
        mockDealData
      );
      
      expect(result.result).toBe(ACTION_RESULTS.ACTION_COMPLETED);
      expect(result.propertyUpdates).toBeDefined();
      expect(result.propertyUpdates.multi_thread_score).toBeDefined();
    });

    test('returns error for unknown action type', () => {
      const result = handleWorkflowAction(
        'UNKNOWN_ACTION',
        {},
        mockDealData
      );
      
      expect(result.result).toBe(ACTION_RESULTS.ACTION_FAILED);
      expect(result.error).toContain('Unknown action type');
    });
  });

  describe('getAvailableActions', () => {
    test('returns list of available actions', () => {
      const actions = getAvailableActions();
      
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    });

    test('actions have required properties', () => {
      const actions = getAvailableActions();
      
      actions.forEach(action => {
        expect(action.actionType).toBeDefined();
        expect(action.label).toBeDefined();
        expect(action.description).toBeDefined();
        expect(action.inputFields).toBeDefined();
        expect(action.outputFields).toBeDefined();
      });
    });

    test('includes score threshold action', () => {
      const actions = getAvailableActions();
      const scoreAction = actions.find(a => a.actionType === WORKFLOW_ACTIONS.CHECK_SCORE_THRESHOLD);
      
      expect(scoreAction).toBeDefined();
      expect(scoreAction.inputFields.find(f => f.name === 'threshold')).toBeDefined();
    });
  });

  describe('WORKFLOW_ACTIONS', () => {
    test('has all action types', () => {
      expect(WORKFLOW_ACTIONS.CHECK_SCORE_THRESHOLD).toBeDefined();
      expect(WORKFLOW_ACTIONS.CHECK_ROLE_COVERAGE).toBeDefined();
      expect(WORKFLOW_ACTIONS.CHECK_STAKEHOLDER_COUNT).toBeDefined();
      expect(WORKFLOW_ACTIONS.CREATE_TASK).toBeDefined();
      expect(WORKFLOW_ACTIONS.NOTIFY_ON_CONDITION).toBeDefined();
      expect(WORKFLOW_ACTIONS.RECALCULATE_SCORE).toBeDefined();
    });
  });

  describe('ACTION_RESULTS', () => {
    test('has all result types', () => {
      expect(ACTION_RESULTS.CONDITION_MET).toBeDefined();
      expect(ACTION_RESULTS.CONDITION_NOT_MET).toBeDefined();
      expect(ACTION_RESULTS.ACTION_COMPLETED).toBeDefined();
      expect(ACTION_RESULTS.ACTION_FAILED).toBeDefined();
    });
  });
});
