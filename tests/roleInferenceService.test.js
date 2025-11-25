const {
  inferRoleFromJobTitle,
  inferSeniorityLevel,
  inferRoleFromBehavior,
  analyzeLanguagePatterns,
  inferContactRole,
  inferRolesForContacts
} = require('../src/services/roleInferenceService');

describe('Role Inference Service', () => {
  describe('inferRoleFromJobTitle', () => {
    test('identifies CEO as DECISION_MAKER', () => {
      const result = inferRoleFromJobTitle('Chief Executive Officer');
      expect(result.inferredRole).toBe('DECISION_MAKER');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('identifies CFO as BUDGET_HOLDER', () => {
      const result = inferRoleFromJobTitle('Chief Financial Officer');
      expect(result.inferredRole).toBe('BUDGET_HOLDER');
    });

    test('identifies VP of Finance as BUDGET_HOLDER', () => {
      const result = inferRoleFromJobTitle('VP of Finance');
      expect(result.inferredRole).toBe('BUDGET_HOLDER');
    });

    test('identifies Senior Manager as CHAMPION', () => {
      const result = inferRoleFromJobTitle('Senior Project Manager');
      expect(result.inferredRole).toBe('CHAMPION');
    });

    test('identifies Software Engineer as INFLUENCER', () => {
      const result = inferRoleFromJobTitle('Software Engineer');
      expect(result.inferredRole).toBe('INFLUENCER');
    });

    test('identifies Assistant as END_USER', () => {
      const result = inferRoleFromJobTitle('Administrative Assistant');
      expect(result.inferredRole).toBe('END_USER');
    });

    test('identifies General Counsel as LEGAL', () => {
      const result = inferRoleFromJobTitle('General Counsel');
      expect(result.inferredRole).toBe('LEGAL');
    });

    test('identifies Procurement Manager as PROCUREMENT or BUDGET_HOLDER', () => {
      const result = inferRoleFromJobTitle('Procurement Manager');
      // Procurement is finance-related, so it may return BUDGET_HOLDER or PROCUREMENT
      expect(['PROCUREMENT', 'BUDGET_HOLDER']).toContain(result.inferredRole);
    });

    test('returns null for empty job title', () => {
      const result = inferRoleFromJobTitle('');
      expect(result.inferredRole).toBeNull();
      expect(result.confidence).toBe(0);
    });

    test('returns null for null job title', () => {
      const result = inferRoleFromJobTitle(null);
      expect(result.inferredRole).toBeNull();
    });
  });

  describe('inferSeniorityLevel', () => {
    test('identifies EXECUTIVE level', () => {
      const result = inferSeniorityLevel('Chief Technology Officer');
      expect(result.level).toBe('EXECUTIVE');
    });

    test('identifies SENIOR level', () => {
      const result = inferSeniorityLevel('Senior Director of Engineering');
      expect(result.level).toBe('SENIOR');
    });

    test('identifies MID level', () => {
      const result = inferSeniorityLevel('Product Manager');
      expect(result.level).toBe('MID');
    });

    test('identifies JUNIOR level', () => {
      const result = inferSeniorityLevel('Junior Developer');
      expect(result.level).toBe('JUNIOR');
    });

    test('returns UNKNOWN for unrecognized title', () => {
      const result = inferSeniorityLevel('Rock Star');
      expect(result.level).toBe('UNKNOWN');
    });
  });

  describe('inferRoleFromBehavior', () => {
    test('identifies CHAMPION from high engagement', () => {
      const engagements = { emails: 10, meetings: 5, calls: 3, total: 18 };
      const result = inferRoleFromBehavior(engagements, {});
      expect(result.inferredRole).toBe('CHAMPION');
    });

    test('identifies END_USER from email-heavy engagement', () => {
      const engagements = { emails: 10, meetings: 0, calls: 0, total: 10 };
      const result = inferRoleFromBehavior(engagements, {});
      expect(result.inferredRole).toBe('END_USER');
    });

    test('identifies DECISION_MAKER from late stage joining', () => {
      const engagements = { emails: 2, meetings: 1, calls: 0, total: 3 };
      const result = inferRoleFromBehavior(engagements, { meetingStage: 'late' });
      expect(result.inferredRole).toBe('DECISION_MAKER');
    });

    test('returns null for minimal engagement', () => {
      const engagements = { emails: 1, meetings: 0, calls: 0, total: 1 };
      const result = inferRoleFromBehavior(engagements, {});
      expect(result.inferredRole).toBeNull();
    });
  });

  describe('analyzeLanguagePatterns', () => {
    test('identifies BUDGET_HOLDER from budget language', () => {
      const text = "I'll need to approve the budget for this project";
      const result = analyzeLanguagePatterns(text);
      expect(result.inferredRole).toBe('BUDGET_HOLDER');
    });

    test('identifies CHAMPION from advocacy language', () => {
      const text = "I'm excited about this solution and will advocate for it internally";
      const result = analyzeLanguagePatterns(text);
      expect(result.inferredRole).toBe('CHAMPION');
    });

    test('identifies END_USER from usage language', () => {
      const text = "How do I use this feature in my daily workflow?";
      const result = analyzeLanguagePatterns(text);
      expect(result.inferredRole).toBe('END_USER');
    });

    test('returns null for neutral text', () => {
      const text = "Thank you for the meeting.";
      const result = analyzeLanguagePatterns(text);
      expect(result.inferredRole).toBeNull();
    });

    test('handles empty text', () => {
      const result = analyzeLanguagePatterns('');
      expect(result.inferredRole).toBeNull();
    });
  });

  describe('inferContactRole', () => {
    test('uses explicit role when set', () => {
      const contact = {
        properties: {
          hs_buying_role: 'DECISION_MAKER',
          jobtitle: 'Junior Developer'
        },
        engagements: { total: 5 }
      };
      const result = inferContactRole(contact);
      expect(result.role).toBe('DECISION_MAKER');
      expect(result.source).toBe('explicit');
      expect(result.confidence).toBe(100);
    });

    test('infers role from job title when role not set', () => {
      const contact = {
        properties: {
          jobtitle: 'Chief Executive Officer'
        },
        engagements: { total: 5 }
      };
      const result = inferContactRole(contact);
      expect(result.role).toBe('DECISION_MAKER');
      expect(result.source).toBe('inferred');
    });

    test('returns OTHER when no inference possible', () => {
      const contact = {
        properties: {},
        engagements: { total: 0 }
      };
      const result = inferContactRole(contact);
      expect(result.role).toBe('OTHER');
    });
  });

  describe('inferRolesForContacts', () => {
    test('processes multiple contacts', () => {
      const contacts = [
        {
          id: '1',
          properties: {
            jobtitle: 'CEO'
          },
          engagements: { total: 5 }
        },
        {
          id: '2',
          properties: {
            jobtitle: 'CFO'
          },
          engagements: { total: 3 }
        }
      ];
      
      const result = inferRolesForContacts(contacts);
      
      expect(result.length).toBe(2);
      expect(result[0].effectiveRole).toBe('DECISION_MAKER');
      expect(result[1].effectiveRole).toBe('BUDGET_HOLDER');
    });

    test('handles empty contacts array', () => {
      const result = inferRolesForContacts([]);
      expect(result).toEqual([]);
    });
  });
});
