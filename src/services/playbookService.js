/**
 * Playbook Service - Inline sales playbooks and templates
 * 
 * This service provides:
 * 1. Contextual email templates based on deal state
 * 2. Multi-threading playbook guidance
 * 3. Role-specific engagement checklists
 * 4. Stage-based action plans
 */

// Email templates for common scenarios
const EMAIL_TEMPLATES = {
  RE_ENGAGE_DM: {
    id: 'reengage_dm',
    name: 'Re-engage Decision Maker',
    subject: 'Quick update on {{dealName}} - need your input',
    body: `Hi {{firstName}},

I wanted to reach out with a quick update on our conversation regarding {{dealName}}.

{{champion}} has been great to work with and has helped us understand your team's requirements well. However, I wanted to ensure you have visibility into our progress and get your input on a few key points:

1. {{keyPoint1}}
2. {{keyPoint2}}

Would you have 15 minutes this week for a brief call? I'd value your perspective as we move forward.

Best regards,
{{senderName}}`,
    variables: ['firstName', 'dealName', 'champion', 'keyPoint1', 'keyPoint2', 'senderName'],
    useCase: 'When decision maker engagement has dropped or is missing'
  },

  EXPAND_STAKEHOLDERS: {
    id: 'expand_stakeholders',
    name: 'Request Additional Stakeholder Introduction',
    subject: 'Growing the conversation - {{dealName}}',
    body: `Hi {{firstName}},

As we progress with {{dealName}}, I want to make sure we're aligned with all the key stakeholders who will be impacted by this decision.

Based on our conversations, it seems like {{suggestedRole}} would benefit from being part of our discussions. Would you be able to introduce us, or should I reach out directly?

Having their perspective early will help us ensure the solution meets everyone's needs and avoid any surprises down the road.

Thanks for your help!

Best,
{{senderName}}`,
    variables: ['firstName', 'dealName', 'suggestedRole', 'senderName'],
    useCase: 'When deal is single-threaded or missing key roles'
  },

  CHAMPION_CHECK_IN: {
    id: 'champion_checkin',
    name: 'Champion Check-in',
    subject: 'Checking in - {{dealName}}',
    body: `Hi {{firstName}},

I wanted to touch base and see how things are going on your end with {{dealName}}.

A few things I wanted to check:
- How is the internal discussion progressing?
- Is there anything I can provide to help you make the case internally?
- Are there any concerns or objections coming up that we should address?

I'm here to support however I can. Let me know if you'd like to sync up this week.

Best,
{{senderName}}`,
    variables: ['firstName', 'dealName', 'senderName'],
    useCase: 'When champion engagement is dropping'
  },

  BUDGET_HOLDER_INTRO: {
    id: 'budget_holder_intro',
    name: 'Budget Holder Introduction',
    subject: 'Budget planning for {{dealName}}',
    body: `Hi {{firstName}},

{{referrerName}} suggested I reach out regarding {{dealName}}. As the {{roleTitle}}, I wanted to ensure you have visibility into the investment we're discussing.

Here's a quick summary:
- Investment: {{amount}}
- Expected ROI: {{roi}}
- Timeline: {{timeline}}

Would you have 20 minutes for a brief overview? I'd be happy to walk through the business case and answer any questions about the financial impact.

Best regards,
{{senderName}}`,
    variables: ['firstName', 'referrerName', 'dealName', 'roleTitle', 'amount', 'roi', 'timeline', 'senderName'],
    useCase: 'When budget holder needs to be engaged'
  },

  DEAL_STALLED: {
    id: 'deal_stalled',
    name: 'Re-engage Stalled Deal',
    subject: 'Moving forward on {{dealName}}?',
    body: `Hi {{firstName}},

I noticed it's been a few weeks since we last connected on {{dealName}}. I wanted to check in and see if anything has changed on your end.

If priorities have shifted, I completely understand. However, if you're still interested in moving forward, I'd love to understand:
- What's needed to get this back on track?
- Are there any new stakeholders we should involve?
- Has anything changed in your requirements?

Even a quick reply letting me know the status would be helpful.

Best,
{{senderName}}`,
    variables: ['firstName', 'dealName', 'senderName'],
    useCase: 'When deal has been stuck for extended period'
  }
};

// Multi-threading playbooks
const PLAYBOOKS = {
  BUILD_MULTI_THREADED_DEAL: {
    id: 'build_multi_threaded',
    name: 'How to Build a Multi-Threaded Deal',
    description: 'Step-by-step guide to expanding stakeholder engagement',
    stages: [
      {
        stage: 1,
        title: 'Map the Organization',
        duration: '1-2 days',
        actions: [
          'Research the company org chart on LinkedIn',
          'Identify key departments impacted by your solution',
          'List potential stakeholders by role',
          'Understand reporting relationships'
        ],
        tips: [
          'Look for recent press releases about leadership changes',
          'Check if your champion can share an internal org chart'
        ]
      },
      {
        stage: 2,
        title: 'Identify Key Roles',
        duration: '1 week',
        actions: [
          'Identify the Decision Maker (final approval)',
          'Find the Budget Holder (controls funding)',
          'Develop your Champion (internal advocate)',
          'Locate Influencers (technical evaluators)',
          'Consider End Users (daily users of solution)'
        ],
        tips: [
          'Ask your champion: "Who else needs to be involved?"',
          'Look for job titles that suggest budget authority'
        ]
      },
      {
        stage: 3,
        title: 'Request Introductions',
        duration: 'Ongoing',
        actions: [
          'Ask champion for warm introductions',
          'Propose joint meetings with new stakeholders',
          'Offer value-specific content for each role',
          'Create role-specific meeting agendas'
        ],
        tips: [
          'Frame introductions as helping stakeholder do their job better',
          'Provide your champion with email templates they can forward'
        ]
      },
      {
        stage: 4,
        title: 'Engage Each Stakeholder',
        duration: 'Throughout deal',
        actions: [
          'Schedule 1:1 conversations with each key stakeholder',
          'Understand their specific goals and concerns',
          'Provide relevant content and case studies',
          'Build individual relationships, not just deal relationships'
        ],
        tips: [
          'Tailor your messaging to each stakeholder\'s priorities',
          'Document individual stakeholder needs and objections'
        ]
      },
      {
        stage: 5,
        title: 'Maintain Momentum',
        duration: 'Throughout deal',
        actions: [
          'Regular check-ins with all stakeholders',
          'Share updates that are relevant to each role',
          'Address concerns quickly and transparently',
          'Keep everyone aligned on next steps'
        ],
        tips: [
          'Use a stakeholder map to track engagement',
          'Set reminders for follow-ups with each person'
        ]
      }
    ]
  },

  CHAMPION_DEVELOPMENT: {
    id: 'champion_development',
    name: 'Champion Development Playbook',
    description: 'How to identify and nurture internal champions',
    stages: [
      {
        stage: 1,
        title: 'Identify Potential Champions',
        actions: [
          'Look for contacts who are enthusiastic about your solution',
          'Find people whose success is tied to your solution\'s success',
          'Identify those with influence but not final authority',
          'Consider mid-level managers or team leads'
        ],
        characteristics: [
          'Engaged in discovery calls',
          'Asks detailed questions',
          'Shares internal information',
          'Responds quickly to communications'
        ]
      },
      {
        stage: 2,
        title: 'Develop the Champion',
        actions: [
          'Help them understand the full value proposition',
          'Equip them with talking points for internal conversations',
          'Provide case studies and ROI data',
          'Make them look good internally'
        ],
        resources: [
          'Internal presentation deck',
          'ROI calculator',
          'Competitive comparison',
          'Customer testimonials'
        ]
      },
      {
        stage: 3,
        title: 'Enable Internal Selling',
        actions: [
          'Create materials they can share internally',
          'Coach them on handling objections',
          'Provide answers to likely questions',
          'Offer to join internal meetings'
        ],
        tips: [
          'Ask: "What concerns might [stakeholder] have?"',
          'Role-play internal conversations with your champion'
        ]
      },
      {
        stage: 4,
        title: 'Maintain the Relationship',
        actions: [
          'Regular check-ins even outside deal context',
          'Celebrate their wins',
          'Provide ongoing value and insights',
          'Make them a customer success story'
        ]
      }
    ]
  },

  EXECUTIVE_ENGAGEMENT: {
    id: 'executive_engagement',
    name: 'Executive Engagement Playbook',
    description: 'How to effectively engage C-level stakeholders',
    stages: [
      {
        stage: 1,
        title: 'Prepare Thoroughly',
        actions: [
          'Research the executive\'s background and priorities',
          'Understand company strategic initiatives',
          'Prepare business-level talking points (not features)',
          'Calculate ROI and business impact'
        ],
        avoid: [
          'Don\'t lead with product features',
          'Don\'t waste time on basics covered with others',
          'Don\'t be unprepared for tough questions'
        ]
      },
      {
        stage: 2,
        title: 'Get the Meeting',
        actions: [
          'Request introduction through your champion',
          'Lead with business value in outreach',
          'Keep requests brief and specific',
          'Offer flexible timing options'
        ],
        tips: [
          'Executives are busy - ask for 15-20 minutes max initially',
          'Reference specific business challenges they care about'
        ]
      },
      {
        stage: 3,
        title: 'Run an Effective Meeting',
        actions: [
          'Start with their priorities, not your pitch',
          'Ask strategic questions about their goals',
          'Present business outcomes, not features',
          'Be concise and respectful of time'
        ],
        agenda: [
          '2 min: Acknowledge their time and set context',
          '5 min: Ask about their priorities',
          '10 min: Connect your solution to their goals',
          '3 min: Define next steps and commitments'
        ]
      },
      {
        stage: 4,
        title: 'Follow Through',
        actions: [
          'Send brief summary within 24 hours',
          'Deliver on any commitments immediately',
          'Loop in their team with clear action items',
          'Provide executive-level updates periodically'
        ]
      }
    ]
  }
};

// Role-based checklists
const ROLE_CHECKLISTS = {
  DECISION_MAKER: {
    role: 'Decision Maker',
    description: 'Final authority on purchase decision',
    engagement_checklist: [
      { item: 'Identify the Decision Maker', status: 'pending' },
      { item: 'Confirm their role and authority', status: 'pending' },
      { item: 'Understand their personal priorities', status: 'pending' },
      { item: 'Present business case and ROI', status: 'pending' },
      { item: 'Address risk and compliance concerns', status: 'pending' },
      { item: 'Secure their commitment to timeline', status: 'pending' }
    ],
    key_questions: [
      'What are your top priorities this quarter?',
      'What would success look like for this initiative?',
      'What concerns do you have about moving forward?',
      'What criteria will you use to make the final decision?'
    ],
    content_to_provide: [
      'Executive summary',
      'Business case with ROI',
      'Risk mitigation plan',
      'Implementation timeline',
      'Customer references (peer-level)'
    ]
  },

  BUDGET_HOLDER: {
    role: 'Budget Holder',
    description: 'Controls budget allocation',
    engagement_checklist: [
      { item: 'Identify the Budget Holder', status: 'pending' },
      { item: 'Understand budget cycle and timing', status: 'pending' },
      { item: 'Present financial justification', status: 'pending' },
      { item: 'Discuss payment terms and options', status: 'pending' },
      { item: 'Address procurement requirements', status: 'pending' },
      { item: 'Secure budget commitment', status: 'pending' }
    ],
    key_questions: [
      'What is the budget cycle for this type of purchase?',
      'Is budget allocated for this initiative?',
      'What financial metrics matter most?',
      'What approval processes exist for this investment level?'
    ],
    content_to_provide: [
      'Detailed pricing breakdown',
      'ROI analysis',
      'Total cost of ownership',
      'Payment options',
      'Vendor compliance documents'
    ]
  },

  CHAMPION: {
    role: 'Champion',
    description: 'Internal advocate for your solution',
    engagement_checklist: [
      { item: 'Identify potential Champion', status: 'pending' },
      { item: 'Validate their influence and motivation', status: 'pending' },
      { item: 'Equip with internal selling materials', status: 'pending' },
      { item: 'Coach on handling objections', status: 'pending' },
      { item: 'Support their internal meetings', status: 'pending' },
      { item: 'Maintain regular communication', status: 'pending' }
    ],
    key_questions: [
      'Who else needs to be involved in this decision?',
      'What internal resistance might we face?',
      'How can I help you make the case internally?',
      'What would make this a win for you personally?'
    ],
    content_to_provide: [
      'Internal presentation deck',
      'Competitive comparison',
      'Objection handling guide',
      'Email templates for internal stakeholders',
      'Success metrics and case studies'
    ]
  },

  INFLUENCER: {
    role: 'Influencer',
    description: 'Technical evaluator or advisor',
    engagement_checklist: [
      { item: 'Identify key Influencers', status: 'pending' },
      { item: 'Understand their evaluation criteria', status: 'pending' },
      { item: 'Conduct technical deep-dive', status: 'pending' },
      { item: 'Address integration requirements', status: 'pending' },
      { item: 'Provide technical documentation', status: 'pending' },
      { item: 'Secure technical approval', status: 'pending' }
    ],
    key_questions: [
      'What are your must-have technical requirements?',
      'What systems does this need to integrate with?',
      'What concerns do you have about implementation?',
      'Who else on your team should evaluate this?'
    ],
    content_to_provide: [
      'Technical documentation',
      'Integration guides',
      'Security and compliance docs',
      'Implementation timeline',
      'Technical case studies'
    ]
  }
};

// Stage-based action plans
const STAGE_ACTION_PLANS = {
  appointmentscheduled: {
    stage: 'Appointment Scheduled',
    focus: 'Discovery and qualification',
    multi_threading_actions: [
      'Identify who the champion might be',
      'Ask about other stakeholders impacted',
      'Research the org structure'
    ],
    minimum_contacts: 1,
    target_roles: ['CHAMPION', 'INFLUENCER']
  },
  qualifiedtobuy: {
    stage: 'Qualified to Buy',
    focus: 'Expanding stakeholder engagement',
    multi_threading_actions: [
      'Request introductions to Decision Maker',
      'Identify Budget Holder',
      'Schedule meetings with key influencers'
    ],
    minimum_contacts: 2,
    target_roles: ['CHAMPION', 'INFLUENCER', 'DECISION_MAKER']
  },
  presentationscheduled: {
    stage: 'Presentation Scheduled',
    focus: 'Engaging economic buyers',
    multi_threading_actions: [
      'Include Decision Maker in presentation',
      'Engage Budget Holder on financials',
      'Ensure champion is prepared to advocate'
    ],
    minimum_contacts: 3,
    target_roles: ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION']
  },
  decisionmakerboughtin: {
    stage: 'Decision Maker Bought-In',
    focus: 'Securing commitments',
    multi_threading_actions: [
      'Confirm budget approval process',
      'Identify any blockers',
      'Engage procurement/legal if needed'
    ],
    minimum_contacts: 4,
    target_roles: ['DECISION_MAKER', 'BUDGET_HOLDER', 'CHAMPION', 'LEGAL']
  },
  contractsent: {
    stage: 'Contract Sent',
    focus: 'Closing and implementation prep',
    multi_threading_actions: [
      'Engage legal/procurement for review',
      'Prepare implementation stakeholders',
      'Maintain champion engagement'
    ],
    minimum_contacts: 4,
    target_roles: ['DECISION_MAKER', 'BUDGET_HOLDER', 'LEGAL', 'PROCUREMENT']
  }
};

/**
 * Get contextual recommendations based on deal state
 * @param {Object} scoreData - Multi-threading score data
 * @param {string} dealStage - Current deal stage
 * @returns {Object} Contextual playbook recommendations
 */
function getContextualRecommendations(scoreData, dealStage) {
  const recommendations = {
    templates: [],
    playbooks: [],
    checklists: [],
    actions: []
  };

  // Single-threaded recommendation
  if (scoreData.contactCount <= 1) {
    recommendations.templates.push(EMAIL_TEMPLATES.EXPAND_STAKEHOLDERS);
    recommendations.playbooks.push(PLAYBOOKS.BUILD_MULTI_THREADED_DEAL);
    recommendations.actions.push({
      priority: 'HIGH',
      action: 'Expand stakeholder coverage immediately',
      resource: 'Use the "Expand Stakeholders" email template'
    });
  }

  // Missing Decision Maker
  if (scoreData.missingKeyRoles?.includes('DECISION_MAKER')) {
    recommendations.templates.push(EMAIL_TEMPLATES.RE_ENGAGE_DM);
    recommendations.playbooks.push(PLAYBOOKS.EXECUTIVE_ENGAGEMENT);
    recommendations.checklists.push(ROLE_CHECKLISTS.DECISION_MAKER);
    recommendations.actions.push({
      priority: 'HIGH',
      action: 'Identify and engage Decision Maker',
      resource: 'Follow the Executive Engagement playbook'
    });
  }

  // Missing Budget Holder
  if (scoreData.missingKeyRoles?.includes('BUDGET_HOLDER')) {
    recommendations.templates.push(EMAIL_TEMPLATES.BUDGET_HOLDER_INTRO);
    recommendations.checklists.push(ROLE_CHECKLISTS.BUDGET_HOLDER);
    recommendations.actions.push({
      priority: 'HIGH',
      action: 'Engage Budget Holder on financial justification',
      resource: 'Use the Budget Holder introduction template'
    });
  }

  // Missing or weak Champion
  if (scoreData.missingKeyRoles?.includes('CHAMPION') || !scoreData.coveredRoles?.includes('CHAMPION')) {
    recommendations.templates.push(EMAIL_TEMPLATES.CHAMPION_CHECK_IN);
    recommendations.playbooks.push(PLAYBOOKS.CHAMPION_DEVELOPMENT);
    recommendations.checklists.push(ROLE_CHECKLISTS.CHAMPION);
    recommendations.actions.push({
      priority: 'MEDIUM',
      action: 'Develop internal champion',
      resource: 'Follow the Champion Development playbook'
    });
  }

  // Stage-specific actions
  const stageActions = STAGE_ACTION_PLANS[dealStage];
  if (stageActions) {
    recommendations.actions.push({
      priority: 'MEDIUM',
      action: `Stage focus: ${stageActions.focus}`,
      resource: stageActions.multi_threading_actions.join('; ')
    });

    // Add missing role checklists for this stage
    stageActions.target_roles.forEach(role => {
      if (scoreData.missingKeyRoles?.includes(role) && ROLE_CHECKLISTS[role]) {
        if (!recommendations.checklists.find(c => c.role === ROLE_CHECKLISTS[role].role)) {
          recommendations.checklists.push(ROLE_CHECKLISTS[role]);
        }
      }
    });
  }

  // Low engagement champion
  const championContact = scoreData.contacts?.find(c => 
    (c.role || '').toUpperCase() === 'CHAMPION'
  );
  if (championContact && championContact.engagementScore < 40) {
    recommendations.templates.push(EMAIL_TEMPLATES.CHAMPION_CHECK_IN);
    recommendations.actions.push({
      priority: 'HIGH',
      action: 'Champion engagement dropping - re-engage immediately',
      resource: 'Use Champion Check-in template'
    });
  }

  return recommendations;
}

/**
 * Render email template with variables
 * @param {string} templateId - Template identifier
 * @param {Object} variables - Variable values
 * @returns {Object} Rendered template
 */
function renderEmailTemplate(templateId, variables) {
  const template = Object.values(EMAIL_TEMPLATES).find(t => t.id === templateId);
  
  if (!template) {
    return { error: 'Template not found' };
  }

  let subject = template.subject;
  let body = template.body;

  // Replace variables
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(placeholder, value || '');
    body = body.replace(placeholder, value || '');
  }

  return {
    id: template.id,
    name: template.name,
    subject,
    body,
    missingVariables: template.variables.filter(v => !variables[v])
  };
}

module.exports = {
  EMAIL_TEMPLATES,
  PLAYBOOKS,
  ROLE_CHECKLISTS,
  STAGE_ACTION_PLANS,
  getContextualRecommendations,
  renderEmailTemplate
};
