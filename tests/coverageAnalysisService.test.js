const {
  calculateBreadthScore,
  calculateDepthScore,
  calculateRoleDepthScore,
  calculateRecencyScore,
  calculateCoverageAnalysis,
  calculateChampionStrength,
  generateMissingChecklist,
  STAGE_ROLE_EXPECTATIONS
} = require('../src/services/coverageAnalysisService');

describe('Coverage Analysis Service', () => {
  describe('calculateBreadthScore', () => {
    test('returns high score when required roles are covered', () => {
      const contacts = [
        { properties: { hs_buying_role: 'CHAMPION' }, engagements: { total: 5 } },
        { properties: { hs_buying_role: 'INFLUENCER' }, engagements: { total: 3 } }
      ];
      
      const result = calculateBreadthScore(contacts, { dealStage: 'appointmentscheduled' });
      
      expect(result.breadthScore).toBeGreaterThanOrEqual(70);
      expect(result.stageAnalysis.missingRequired).toHaveLength(0);
    });

    test('returns low score when required roles are missing', () => {
      const contacts = [
        { properties: { hs_buying_role: 'END_USER' }, engagements: { total: 2 } }
      ];
      
      const result = calculateBreadthScore(contacts, { dealStage: 'appointmentscheduled' });
      
      expect(result.breadthScore).toBeLessThan(70);
      expect(result.stageAnalysis.missingRequired.length).toBeGreaterThan(0);
    });

    test('uses default stage expectations for unknown stage', () => {
      const contacts = [
        { properties: { hs_buying_role: 'CHAMPION' }, engagements: { total: 5 } }
      ];
      
      const result = calculateBreadthScore(contacts, { dealStage: 'unknownstage' });
      
      expect(result.stageAnalysis.dealStage).toBe('unknownstage');
      expect(result.stageAnalysis.requiredRoles).toBeDefined();
    });

    test('counts unique roles correctly', () => {
      const contacts = [
        { properties: { hs_buying_role: 'CHAMPION' }, engagements: { total: 5 } },
        { properties: { hs_buying_role: 'CHAMPION' }, engagements: { total: 3 } },
        { properties: { hs_buying_role: 'DECISION_MAKER' }, engagements: { total: 4 } }
      ];
      
      const result = calculateBreadthScore(contacts, {});
      
      expect(result.totalRolesRepresented).toBe(2);
      expect(result.coveredRoles).toContain('CHAMPION');
      expect(result.coveredRoles).toContain('DECISION_MAKER');
    });
  });

  describe('calculateRoleDepthScore', () => {
    test('returns 0 for empty role contacts', () => {
      const result = calculateRoleDepthScore([]);
      
      expect(result.depthScore).toBe(0);
      expect(result.engagementLevel).toBe('NONE');
    });

    test('calculates depth score based on engagement', () => {
      const contacts = [
        { engagements: { total: 10 }, lastEngagementDate: new Date() }
      ];
      
      const result = calculateRoleDepthScore(contacts);
      
      expect(result.depthScore).toBeGreaterThan(0);
      expect(result.contactCount).toBe(1);
    });

    test('identifies HIGH engagement level', () => {
      const contacts = [
        { engagements: { total: 20 }, lastEngagementDate: new Date() }
      ];
      
      const result = calculateRoleDepthScore(contacts);
      
      expect(result.engagementLevel).toBe('HIGH');
    });
  });

  describe('calculateRecencyScore', () => {
    test('returns 100 for engagement within last 7 days', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      
      const score = calculateRecencyScore(recentDate);
      
      expect(score).toBe(100);
    });

    test('returns 80 for engagement within last 14 days', () => {
      const date = new Date();
      date.setDate(date.getDate() - 10);
      
      const score = calculateRecencyScore(date);
      
      expect(score).toBe(80);
    });

    test('returns 0 for null date', () => {
      const score = calculateRecencyScore(null);
      expect(score).toBe(0);
    });
  });

  describe('calculateDepthScore', () => {
    test('calculates overall depth across roles', () => {
      const contacts = [
        { effectiveRole: 'CHAMPION', properties: { hs_buying_role: 'CHAMPION' }, engagements: { total: 10 } },
        { effectiveRole: 'DECISION_MAKER', properties: { hs_buying_role: 'DECISION_MAKER' }, engagements: { total: 5 } }
      ];
      
      const result = calculateDepthScore(contacts);
      
      expect(result.overallDepthScore).toBeGreaterThan(0);
      expect(result.roleDepths).toBeDefined();
      expect(result.roleCount).toBe(2);
    });

    test('identifies strongest and weakest roles', () => {
      const contacts = [
        { properties: { hs_buying_role: 'CHAMPION' }, engagements: { total: 20 } },
        { properties: { hs_buying_role: 'END_USER' }, engagements: { total: 1 } }
      ];
      
      const result = calculateDepthScore(contacts);
      
      expect(result.strongestRole.role).toBe('CHAMPION');
      expect(result.weakestRole.role).toBe('END_USER');
    });
  });

  describe('calculateCoverageAnalysis', () => {
    test('combines breadth and depth scores', () => {
      const contacts = [
        { properties: { hs_buying_role: 'CHAMPION' }, engagements: { total: 10 } },
        { properties: { hs_buying_role: 'DECISION_MAKER' }, engagements: { total: 8 } }
      ];
      
      const result = calculateCoverageAnalysis(contacts, { dealStage: 'default' });
      
      expect(result.coverageScore).toBeDefined();
      expect(result.breadth).toBeDefined();
      expect(result.depth).toBeDefined();
      expect(result.meetsStageExpectations).toBeDefined();
    });
  });

  describe('calculateChampionStrength', () => {
    test('returns NONE for no champion', () => {
      const result = calculateChampionStrength(null);
      
      expect(result.reliability).toBe('NONE');
      expect(result.strengthScore).toBe(0);
    });

    test('calculates strength based on engagement', () => {
      const champion = {
        engagements: { emails: 5, meetings: 3, calls: 2, total: 10 },
        properties: { jobtitle: 'Senior Manager' }
      };
      
      const result = calculateChampionStrength(champion, {});
      
      expect(result.strengthScore).toBeGreaterThan(0);
      expect(result.factors.length).toBeGreaterThan(0);
    });

    test('identifies STRONG champion', () => {
      const champion = {
        engagements: { emails: 10, meetings: 5, calls: 5, total: 20 },
        properties: { jobtitle: 'VP of Operations' }
      };
      
      const result = calculateChampionStrength(champion, {
        responseRate: 0.9,
        meetingAttendance: 0.95,
        advocacyIndicators: ['shared internally', 'recommended to team']
      });
      
      expect(result.reliability).toBe('STRONG');
    });
  });

  describe('generateMissingChecklist', () => {
    test('generates checklist for missing roles', () => {
      const coverageAnalysis = {
        breadth: {
          stageAnalysis: {
            missingRequired: ['DECISION_MAKER'],
            missingRecommended: ['LEGAL']
          },
          coveredRoles: ['CHAMPION']
        },
        depth: {
          roleDepths: {
            CHAMPION: { engagementLevel: 'LOW', depthScore: 20 }
          }
        }
      };
      
      const checklist = generateMissingChecklist(coverageAnalysis);
      
      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist.find(item => item.title.includes('decision maker'))).toBeDefined();
    });

    test('prioritizes HIGH items first', () => {
      const coverageAnalysis = {
        breadth: {
          stageAnalysis: {
            missingRequired: ['DECISION_MAKER'],
            missingRecommended: ['INFLUENCER']
          },
          coveredRoles: []
        },
        depth: { roleDepths: {} }
      };
      
      const checklist = generateMissingChecklist(coverageAnalysis);
      
      expect(checklist[0].priority).toBe('HIGH');
    });
  });
});
