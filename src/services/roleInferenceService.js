/**
 * Role Inference Service - AI-based role inference from job titles and behavior patterns
 * 
 * This service infers buying roles when they aren't explicitly set on contacts by analyzing:
 * 1. Job titles
 * 2. Behavior patterns (engagement timing, frequency)
 * 3. Email signature patterns (future enhancement)
 * 4. Meeting transcript analysis (future enhancement)
 */

// Job title patterns mapped to buying roles
const JOB_TITLE_PATTERNS = {
  DECISION_MAKER: [
    /\b(ceo|chief executive|president|owner|founder|managing director|general manager|gm|principal)\b/i,
    /\b(vp|vice president|svp|senior vice president|evp|executive vice president)\b/i,
    /\b(director|head of|leader)\b/i,
    /\bc-level|c-suite|chief\b/i
  ],
  BUDGET_HOLDER: [
    /\b(cfo|chief financial|finance director|controller|treasurer|finance manager)\b/i,
    /\b(vp of finance|vp finance|head of finance|finance lead)\b/i,
    /\b(procurement|purchasing|buyer|sourcing)\b/i,
    /\b(budget|financial|accounts payable)\b/i
  ],
  CHAMPION: [
    /\b(senior|sr\.|lead|principal)\b.*\b(manager|engineer|developer|consultant|analyst|specialist)\b/i,
    /\b(manager|team lead|team leader|supervisor)\b/i,
    /\b(project manager|program manager|product manager|pm)\b/i
  ],
  INFLUENCER: [
    /\b(engineer|developer|architect|designer|analyst|consultant|specialist)\b/i,
    /\b(scientist|researcher|expert|advisor)\b/i,
    /\b(technical|technology|it)\b/i
  ],
  END_USER: [
    /\b(associate|assistant|coordinator|representative|support|admin)\b/i,
    /\b(user|operator|technician|clerk)\b/i,
    /\b(intern|trainee|junior|jr\.|entry)\b/i
  ],
  LEGAL: [
    /\b(legal|counsel|attorney|lawyer|compliance|regulatory)\b/i,
    /\b(general counsel|chief legal|legal director)\b/i
  ],
  PROCUREMENT: [
    /\b(procurement|purchasing|vendor|supplier|sourcing)\b/i,
    /\b(contracts|contract manager|vendor manager)\b/i
  ]
};

// Seniority level keywords for additional context
const SENIORITY_KEYWORDS = {
  EXECUTIVE: [/\b(chief|c-level|c-suite|executive|president|ceo|cfo|cto|coo|cmo|cio)\b/i],
  SENIOR: [/\b(senior|sr\.|principal|lead|head|director|vp|vice president)\b/i],
  MID: [/\b(manager|supervisor|team lead|specialist|consultant)\b/i],
  JUNIOR: [/\b(junior|jr\.|associate|assistant|entry|intern|trainee)\b/i]
};

/**
 * Infer buying role from job title
 * @param {string} jobTitle - The contact's job title
 * @returns {Object} Inferred role and confidence score
 */
function inferRoleFromJobTitle(jobTitle) {
  if (!jobTitle || typeof jobTitle !== 'string') {
    return {
      inferredRole: null,
      confidence: 0,
      source: 'job_title',
      matches: []
    };
  }

  const normalizedTitle = jobTitle.toLowerCase().trim();
  const matches = [];

  // Check each role's patterns
  for (const [role, patterns] of Object.entries(JOB_TITLE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedTitle)) {
        matches.push({
          role,
          pattern: pattern.toString(),
          matchedText: normalizedTitle.match(pattern)?.[0]
        });
      }
    }
  }

  if (matches.length === 0) {
    return {
      inferredRole: null,
      confidence: 0,
      source: 'job_title',
      matches: []
    };
  }

  // Special case: Finance-related titles should be BUDGET_HOLDER even if they match DECISION_MAKER
  const isFinanceRole = /\b(cfo|financial|finance|budget|treasury|controller|procurement|purchasing)\b/i.test(normalizedTitle);
  const hasFinanceMatch = matches.find(m => m.role === 'BUDGET_HOLDER' || m.role === 'PROCUREMENT');
  
  if (isFinanceRole && hasFinanceMatch) {
    return {
      inferredRole: hasFinanceMatch.role,
      confidence: Math.min(matches.length * 25 + 25, 90),
      source: 'job_title',
      matches
    };
  }

  // Determine the best match based on priority and frequency
  const roleCounts = {};
  matches.forEach(m => {
    roleCounts[m.role] = (roleCounts[m.role] || 0) + 1;
  });

  // Priority order for roles (higher index = higher priority for inference)
  const rolePriority = ['END_USER', 'INFLUENCER', 'CHAMPION', 'BUDGET_HOLDER', 'DECISION_MAKER', 'LEGAL', 'PROCUREMENT'];
  
  let bestRole = null;
  let bestScore = -1;

  for (const [role, count] of Object.entries(roleCounts)) {
    const priorityScore = rolePriority.indexOf(role) * 10;
    const totalScore = priorityScore + count;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestRole = role;
    }
  }

  // Calculate confidence based on match quality
  const confidence = Math.min(matches.length * 25 + 25, 90);

  return {
    inferredRole: bestRole,
    confidence,
    source: 'job_title',
    matches
  };
}

/**
 * Infer seniority level from job title
 * @param {string} jobTitle - The contact's job title
 * @returns {Object} Seniority level and confidence
 */
function inferSeniorityLevel(jobTitle) {
  if (!jobTitle || typeof jobTitle !== 'string') {
    return { level: 'UNKNOWN', confidence: 0 };
  }

  const normalizedTitle = jobTitle.toLowerCase().trim();

  for (const [level, patterns] of Object.entries(SENIORITY_KEYWORDS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedTitle)) {
        return {
          level,
          confidence: 80,
          matchedPattern: normalizedTitle.match(pattern)?.[0]
        };
      }
    }
  }

  return { level: 'UNKNOWN', confidence: 0 };
}

/**
 * Infer role from engagement behavior patterns
 * @param {Object} engagements - Contact engagement data
 * @param {Object} engagementTiming - Timing data for engagements
 * @returns {Object} Behavior-based role inference
 */
function inferRoleFromBehavior(engagements, engagementTiming = {}) {
  const { emails = 0, meetings = 0, calls = 0, total = 0 } = engagements;
  const { firstEngagementWeek = null, meetingStage = null } = engagementTiming;

  const indicators = [];
  let inferredRole = null;
  let confidence = 0;

  // Economic buyers (Decision Makers, Budget Holders) rarely join early calls
  // They typically engage in mid-to-late stages
  if (meetingStage === 'late' && meetings >= 1 && meetings <= 2) {
    indicators.push({
      type: 'late_stage_joiner',
      suggestion: 'DECISION_MAKER',
      reason: 'Joined meetings late in deal cycle - typical of economic buyers'
    });
    inferredRole = 'DECISION_MAKER';
    confidence = 50;
  }

  // Champions typically have high engagement throughout
  if (total >= 10 && meetings >= 3) {
    indicators.push({
      type: 'high_engagement',
      suggestion: 'CHAMPION',
      reason: 'High overall engagement with multiple meetings suggests champion behavior'
    });
    if (!inferredRole) {
      inferredRole = 'CHAMPION';
      confidence = 60;
    }
  }

  // End users often have email-heavy communication, fewer meetings
  if (emails >= 5 && meetings <= 1) {
    indicators.push({
      type: 'email_heavy',
      suggestion: 'END_USER',
      reason: 'Email-heavy communication pattern typical of end users'
    });
    if (!inferredRole) {
      inferredRole = 'END_USER';
      confidence = 40;
    }
  }

  // Early-stage frequent engagement suggests influencer or champion
  if (firstEngagementWeek === 'early' && total >= 5) {
    indicators.push({
      type: 'early_adopter',
      suggestion: 'INFLUENCER',
      reason: 'Early and frequent engagement suggests influencer role'
    });
    if (!inferredRole) {
      inferredRole = 'INFLUENCER';
      confidence = 45;
    }
  }

  return {
    inferredRole,
    confidence,
    source: 'behavior',
    indicators
  };
}

/**
 * Analyze text for budget/approval language patterns
 * Can be used for email signatures, meeting transcripts, etc.
 * @param {string} text - Text to analyze
 * @returns {Object} Language-based role indicators
 */
function analyzeLanguagePatterns(text) {
  if (!text || typeof text !== 'string') {
    return { indicators: [], inferredRole: null, confidence: 0 };
  }

  const normalizedText = text.toLowerCase();
  const indicators = [];

  // Budget/approval language patterns
  const budgetPatterns = [
    /\b(approve|approval|authorize|authorization|sign off|sign-off)\b/i,
    /\b(budget|funding|investment|spend|expenditure)\b/i,
    /\b(i('ll| will) need to (approve|check|verify|confirm))\b/i,
    /\b(decision|decide|final say|authority)\b/i
  ];

  // Champion advocacy language
  const championPatterns = [
    /\b(excited|enthusiastic|love|great fit|perfect|recommend)\b/i,
    /\b(advocate|push for|support|champion|sponsor)\b/i,
    /\b(let me (talk|speak|discuss) with|i('ll| will) bring this to)\b/i
  ];

  // End user language
  const endUserPatterns = [
    /\b(use|using|daily|workflow|task|feature)\b/i,
    /\b(how (do|does|can|would) (i|we))\b/i
  ];

  for (const pattern of budgetPatterns) {
    if (pattern.test(normalizedText)) {
      indicators.push({
        type: 'budget_language',
        suggestion: 'BUDGET_HOLDER',
        matchedText: normalizedText.match(pattern)?.[0]
      });
    }
  }

  for (const pattern of championPatterns) {
    if (pattern.test(normalizedText)) {
      indicators.push({
        type: 'advocacy_language',
        suggestion: 'CHAMPION',
        matchedText: normalizedText.match(pattern)?.[0]
      });
    }
  }

  for (const pattern of endUserPatterns) {
    if (pattern.test(normalizedText)) {
      indicators.push({
        type: 'user_language',
        suggestion: 'END_USER',
        matchedText: normalizedText.match(pattern)?.[0]
      });
    }
  }

  // Determine best inference from language
  if (indicators.length === 0) {
    return { indicators: [], inferredRole: null, confidence: 0 };
  }

  const suggestionCounts = {};
  indicators.forEach(i => {
    suggestionCounts[i.suggestion] = (suggestionCounts[i.suggestion] || 0) + 1;
  });

  const bestSuggestion = Object.entries(suggestionCounts)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    indicators,
    inferredRole: bestSuggestion ? bestSuggestion[0] : null,
    confidence: bestSuggestion ? Math.min(bestSuggestion[1] * 20, 60) : 0,
    source: 'language_analysis'
  };
}

/**
 * Combine multiple inference sources to get best role estimate
 * @param {Object} contact - Contact object with properties and engagements
 * @param {Object} options - Additional options for inference
 * @returns {Object} Combined role inference with confidence
 */
function inferContactRole(contact, options = {}) {
  const jobTitle = contact.properties?.jobtitle || '';
  const explicitRole = contact.properties?.hs_buying_role;
  const engagements = contact.engagements || {};
  const { engagementTiming = {}, textSources = [] } = options;

  // If explicit role is set and valid, use it with high confidence
  if (explicitRole && explicitRole !== 'OTHER' && explicitRole !== 'Not specified') {
    return {
      role: explicitRole.toUpperCase(),
      confidence: 100,
      source: 'explicit',
      inferences: []
    };
  }

  const inferences = [];

  // Gather all inference sources
  const titleInference = inferRoleFromJobTitle(jobTitle);
  if (titleInference.inferredRole) {
    inferences.push({
      source: 'job_title',
      role: titleInference.inferredRole,
      confidence: titleInference.confidence,
      details: titleInference
    });
  }

  const behaviorInference = inferRoleFromBehavior(engagements, engagementTiming);
  if (behaviorInference.inferredRole) {
    inferences.push({
      source: 'behavior',
      role: behaviorInference.inferredRole,
      confidence: behaviorInference.confidence,
      details: behaviorInference
    });
  }

  // Analyze any text sources (emails, transcripts, etc.)
  for (const text of textSources) {
    const languageInference = analyzeLanguagePatterns(text);
    if (languageInference.inferredRole) {
      inferences.push({
        source: 'language',
        role: languageInference.inferredRole,
        confidence: languageInference.confidence,
        details: languageInference
      });
    }
  }

  // No inferences available
  if (inferences.length === 0) {
    return {
      role: 'OTHER',
      confidence: 0,
      source: 'default',
      inferences: []
    };
  }

  // Combine inferences with weighted scoring
  const roleScores = {};
  inferences.forEach(inf => {
    const sourceWeight = {
      job_title: 1.5,  // Job title is most reliable
      behavior: 1.0,
      language: 0.8
    }[inf.source] || 1.0;

    roleScores[inf.role] = (roleScores[inf.role] || 0) + (inf.confidence * sourceWeight);
  });

  // Find best role
  const bestRole = Object.entries(roleScores)
    .sort((a, b) => b[1] - a[1])[0];

  // Calculate combined confidence (cap at 95% for inferred roles)
  const combinedConfidence = Math.min(
    Math.round(bestRole[1] / inferences.length),
    95
  );

  return {
    role: bestRole[0],
    confidence: combinedConfidence,
    source: 'inferred',
    inferences,
    seniority: inferSeniorityLevel(jobTitle)
  };
}

/**
 * Process all contacts in a deal and infer roles
 * @param {Array} contacts - Array of contact objects
 * @param {Object} options - Additional options
 * @returns {Array} Contacts with inferred roles
 */
function inferRolesForContacts(contacts, options = {}) {
  return contacts.map(contact => {
    const roleInference = inferContactRole(contact, options);
    
    return {
      ...contact,
      inferredRole: roleInference,
      effectiveRole: roleInference.role,
      roleConfidence: roleInference.confidence,
      roleSource: roleInference.source
    };
  });
}

module.exports = {
  inferRoleFromJobTitle,
  inferSeniorityLevel,
  inferRoleFromBehavior,
  analyzeLanguagePatterns,
  inferContactRole,
  inferRolesForContacts,
  JOB_TITLE_PATTERNS,
  SENIORITY_KEYWORDS
};
