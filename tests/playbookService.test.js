const {
  getContextualRecommendations,
  renderEmailTemplate,
  EMAIL_TEMPLATES,
  PLAYBOOKS,
  ROLE_CHECKLISTS,
  STAGE_ACTION_PLANS
} = require('../src/services/playbookService');

describe('Playbook Service', () => {
  describe('getContextualRecommendations', () => {
    test('recommends expanding stakeholders for single-threaded deal', () => {
      const scoreData = {
        contactCount: 1,
        missingKeyRoles: ['DECISION_MAKER', 'BUDGET_HOLDER'],
        coveredRoles: ['CHAMPION'],
        contacts: []
      };
      
      const result = getContextualRecommendations(scoreData, 'qualifiedtobuy');
      
      expect(result.templates.find(t => t.id === 'expand_stakeholders')).toBeDefined();
      expect(result.playbooks.find(p => p.id === 'build_multi_threaded')).toBeDefined();
    });

    test('recommends DM engagement when decision maker missing', () => {
      const scoreData = {
        contactCount: 3,
        missingKeyRoles: ['DECISION_MAKER'],
        coveredRoles: ['CHAMPION', 'INFLUENCER'],
        contacts: []
      };
      
      const result = getContextualRecommendations(scoreData, 'presentationscheduled');
      
      expect(result.templates.find(t => t.id === 'reengage_dm')).toBeDefined();
      expect(result.playbooks.find(p => p.id === 'executive_engagement')).toBeDefined();
    });

    test('recommends budget holder engagement when missing', () => {
      const scoreData = {
        contactCount: 2,
        missingKeyRoles: ['BUDGET_HOLDER'],
        coveredRoles: ['CHAMPION', 'DECISION_MAKER'],
        contacts: []
      };
      
      const result = getContextualRecommendations(scoreData, 'decisionmakerboughtin');
      
      expect(result.templates.find(t => t.id === 'budget_holder_intro')).toBeDefined();
      expect(result.checklists.find(c => c.role === 'Budget Holder')).toBeDefined();
    });

    test('recommends champion development when champion missing', () => {
      const scoreData = {
        contactCount: 2,
        missingKeyRoles: ['CHAMPION'],
        coveredRoles: ['DECISION_MAKER'],
        contacts: []
      };
      
      const result = getContextualRecommendations(scoreData, 'qualifiedtobuy');
      
      expect(result.playbooks.find(p => p.id === 'champion_development')).toBeDefined();
    });

    test('recommends champion check-in for low engagement champion', () => {
      const scoreData = {
        contactCount: 3,
        missingKeyRoles: [],
        coveredRoles: ['CHAMPION', 'DECISION_MAKER'],
        contacts: [
          { name: 'John', role: 'CHAMPION', engagementScore: 25 }
        ]
      };
      
      const result = getContextualRecommendations(scoreData, 'presentationscheduled');
      
      expect(result.templates.find(t => t.id === 'champion_checkin')).toBeDefined();
    });

    test('includes stage-specific actions', () => {
      const scoreData = {
        contactCount: 2,
        missingKeyRoles: ['LEGAL'],
        coveredRoles: ['CHAMPION', 'DECISION_MAKER'],
        contacts: []
      };
      
      const result = getContextualRecommendations(scoreData, 'contractsent');
      
      const stageAction = result.actions.find(a => a.action.includes('Stage focus'));
      expect(stageAction).toBeDefined();
    });
  });

  describe('renderEmailTemplate', () => {
    test('renders template with variables', () => {
      const result = renderEmailTemplate('reengage_dm', {
        firstName: 'John',
        dealName: 'Enterprise Deal',
        champion: 'Jane Smith',
        keyPoint1: 'Integration requirements',
        keyPoint2: 'Timeline discussion',
        senderName: 'Sales Rep'
      });
      
      expect(result.subject).toContain('Enterprise Deal');
      expect(result.body).toContain('John');
      expect(result.body).toContain('Jane Smith');
      expect(result.missingVariables).toHaveLength(0);
    });

    test('identifies missing variables', () => {
      const result = renderEmailTemplate('reengage_dm', {
        firstName: 'John'
      });
      
      expect(result.missingVariables.length).toBeGreaterThan(0);
      expect(result.missingVariables).toContain('dealName');
    });

    test('returns error for unknown template', () => {
      const result = renderEmailTemplate('unknown_template', {});
      
      expect(result.error).toBeDefined();
    });
  });

  describe('EMAIL_TEMPLATES', () => {
    test('has required templates', () => {
      expect(EMAIL_TEMPLATES.RE_ENGAGE_DM).toBeDefined();
      expect(EMAIL_TEMPLATES.EXPAND_STAKEHOLDERS).toBeDefined();
      expect(EMAIL_TEMPLATES.CHAMPION_CHECK_IN).toBeDefined();
      expect(EMAIL_TEMPLATES.BUDGET_HOLDER_INTRO).toBeDefined();
      expect(EMAIL_TEMPLATES.DEAL_STALLED).toBeDefined();
    });

    test('templates have required properties', () => {
      Object.values(EMAIL_TEMPLATES).forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.subject).toBeDefined();
        expect(template.body).toBeDefined();
        expect(template.variables).toBeDefined();
        expect(template.useCase).toBeDefined();
      });
    });
  });

  describe('PLAYBOOKS', () => {
    test('has required playbooks', () => {
      expect(PLAYBOOKS.BUILD_MULTI_THREADED_DEAL).toBeDefined();
      expect(PLAYBOOKS.CHAMPION_DEVELOPMENT).toBeDefined();
      expect(PLAYBOOKS.EXECUTIVE_ENGAGEMENT).toBeDefined();
    });

    test('playbooks have stages with actions', () => {
      Object.values(PLAYBOOKS).forEach(playbook => {
        expect(playbook.id).toBeDefined();
        expect(playbook.name).toBeDefined();
        expect(playbook.description).toBeDefined();
        expect(playbook.stages).toBeDefined();
        expect(playbook.stages.length).toBeGreaterThan(0);
        
        playbook.stages.forEach(stage => {
          expect(stage.stage).toBeDefined();
          expect(stage.actions).toBeDefined();
          expect(stage.actions.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('ROLE_CHECKLISTS', () => {
    test('has checklists for key roles', () => {
      expect(ROLE_CHECKLISTS.DECISION_MAKER).toBeDefined();
      expect(ROLE_CHECKLISTS.BUDGET_HOLDER).toBeDefined();
      expect(ROLE_CHECKLISTS.CHAMPION).toBeDefined();
      expect(ROLE_CHECKLISTS.INFLUENCER).toBeDefined();
    });

    test('checklists have required components', () => {
      Object.values(ROLE_CHECKLISTS).forEach(checklist => {
        expect(checklist.role).toBeDefined();
        expect(checklist.description).toBeDefined();
        expect(checklist.engagement_checklist).toBeDefined();
        expect(checklist.engagement_checklist.length).toBeGreaterThan(0);
        expect(checklist.key_questions).toBeDefined();
        expect(checklist.key_questions.length).toBeGreaterThan(0);
        expect(checklist.content_to_provide).toBeDefined();
      });
    });
  });

  describe('STAGE_ACTION_PLANS', () => {
    test('has plans for deal stages', () => {
      expect(STAGE_ACTION_PLANS.appointmentscheduled).toBeDefined();
      expect(STAGE_ACTION_PLANS.qualifiedtobuy).toBeDefined();
      expect(STAGE_ACTION_PLANS.presentationscheduled).toBeDefined();
      expect(STAGE_ACTION_PLANS.decisionmakerboughtin).toBeDefined();
      expect(STAGE_ACTION_PLANS.contractsent).toBeDefined();
    });

    test('stage plans have required properties', () => {
      Object.values(STAGE_ACTION_PLANS).forEach(plan => {
        expect(plan.stage).toBeDefined();
        expect(plan.focus).toBeDefined();
        expect(plan.multi_threading_actions).toBeDefined();
        expect(plan.multi_threading_actions.length).toBeGreaterThan(0);
        expect(plan.minimum_contacts).toBeDefined();
        expect(plan.target_roles).toBeDefined();
      });
    });

    test('later stages require more contacts', () => {
      expect(STAGE_ACTION_PLANS.contractsent.minimum_contacts)
        .toBeGreaterThanOrEqual(STAGE_ACTION_PLANS.appointmentscheduled.minimum_contacts);
    });
  });
});
