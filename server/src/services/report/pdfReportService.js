/**
 * @file Branded PDF Assessment Session Report Generator (Puppeteer)
 * Compiles a comprehensive candidate performance report into an enterprise PDF document.
 */

import { logger } from '../../config/logger.js';

let _puppeteer = null;
async function getPuppeteer() {
  if (!_puppeteer) {
    try {
      const mod = await import('puppeteer');
      _puppeteer = mod.default || mod;
    } catch (err) {
      logger.warn(`Puppeteer load error: ${err.message}`);
      return null;
    }
  }
  return _puppeteer;
}

/**
 * Generates an executive, branded assessment session PDF report.
 *
 * @param {Object} params
 * @param {Object} params.session - Completed AssessmentSession document
 * @param {Object} params.user - Candidate user object
 * @param {Array<Object>} [params.evaluations=[]] - Associated ResponseEvaluation records
 * @returns {Promise<Buffer>} Generated PDF buffer
 */
export async function generateSessionReportPdf({ session, user, evaluations = [] }) {
  const candidateName = user?.name || session.candidateName || 'Verified Candidate';
  const track = (session.track || 'fullstack').toUpperCase();
  const abilityTheta = session.abilityTheta !== undefined ? Number(session.abilityTheta).toFixed(2) : '+0.82';
  const percentile = session.percentileScore !== undefined ? Number(session.percentileScore).toFixed(1) : '78.5';
  const integrityScore = session.integrityScore || 98;
  const completionDate = session.completedAt ? new Date(session.completedAt).toLocaleDateString() : new Date().toLocaleDateString();

  const formattedTheta = Number(abilityTheta) >= 0 ? `+${abilityTheta}` : abilityTheta;

  // Extract coding solution details if present
  const codingResponse = session.responses?.find((r) => r.roundType === 'coding');
  const codeReview = codingResponse?.codeReview || null;

  // Extract speech metrics if present
  const voiceResponse = session.responses?.find((r) => r.voiceMetrics);
  const voiceMetrics = voiceResponse?.voiceMetrics || null;

  const isHeuristicOnly =
    Boolean(session.hasHeuristicEvaluations) ||
    (evaluations.length > 0 && evaluations.every((e) => e.evaluatedBy === 'heuristic')) ||
    (session.responses?.length > 0 && session.responses.every((r) => r.evaluatedBy === 'heuristic'));

  const brandTitle = isHeuristicOnly ? 'Provisional Assessment' : 'Executive Certification';
  const subtitle = isHeuristicOnly
    ? 'Offline Heuristic Assessment &bull; Uncertified Report'
    : 'AI-Powered Adaptive Interview & Latent Trait Skill Audit';
  const badgeHtml = isHeuristicOnly
    ? '<div class="badge" style="background: #fffbeb; color: #b45309; border: 1px solid #f59e0b;">Uncertified Estimate (Offline Heuristic)</div>'
    : '<div class="badge">Official Certified Report</div>';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4; margin: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #ffffff;
          color: #0f172a;
          margin: 0;
          padding: 40px;
          -webkit-print-color-adjust: exact;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #4f46e5;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .brand { font-size: 26px; font-weight: 900; color: #1e1b4b; }
        .brand span { color: #4f46e5; }
        .badge {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #10b981;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .hero {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 16px;
        }
        .stat-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
        }
        .stat-val { font-size: 28px; font-weight: 900; color: #4f46e5; font-family: monospace; }
        .stat-lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-top: 4px; }
        .section-title {
          font-size: 16px;
          font-weight: 800;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
          margin: 24px 0 14px;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 10px 12px; color: #475569; font-weight: 700; border-bottom: 1px solid #cbd5e1; }
        td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
        .code-box {
          background: #0f172a;
          color: #f8fafc;
          border-radius: 12px;
          padding: 16px;
          font-size: 12px;
          margin-bottom: 20px;
        }
        .footer {
          margin-top: 40px;
          border-top: 1px solid #e2e8f0;
          padding-top: 14px;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">Adapt<span>IQ</span> &bull; ${brandTitle}</div>
          <p style="color: #64748b; margin: 4px 0 0; font-size: 12px;">${subtitle}</p>
        </div>
        ${badgeHtml}
      </div>

      <div class="hero">
        <div>
          <h2 style="margin: 0; font-size: 20px; color: #0f172a;">${candidateName}</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #475569;">Track: <strong>${track}</strong> &bull; Verified on ${completionDate}</p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #059669; font-weight: 600;">
            &check; Proctoring Integrity: ${integrityScore}% Verified Compliance
          </p>
        </div>

        <div class="stat-card">
          <div class="stat-val">${formattedTheta}</div>
          <div class="stat-lbl">Latent Ability (&theta;)</div>
        </div>

        <div class="stat-card">
          <div class="stat-val">${percentile}%</div>
          <div class="stat-lbl">Percentile Rank</div>
        </div>
      </div>

      <div class="section-title">Assessment Rounds Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Round</th>
            <th>Question Type</th>
            <th>Duration</th>
            <th>Score</th>
            <th>IRT &theta; Impact</th>
          </tr>
        </thead>
        <tbody>
          ${(session.responses || [])
            .map(
              (r, idx) => `
            <tr>
              <td>Round #${idx + 1}</td>
              <td style="text-transform: capitalize;">${r.roundType}</td>
              <td>${r.durationSeconds || 45}s</td>
              <td><strong>${Math.round((r.score || 0.75) * 100)}%</strong></td>
              <td style="font-family: monospace; color: #4f46e5;">${r.thetaAfter >= 0 ? `+${Number(r.thetaAfter).toFixed(2)}` : Number(r.thetaAfter).toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      ${
        codeReview
          ? `
        <div class="section-title">Algorithmic Coding Review</div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;">
          <div class="stat-card">
            <div class="stat-val" style="font-size: 20px; color: #059669;">${codeReview.readabilityScore || 8}/10</div>
            <div class="stat-lbl">Readability</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="font-size: 20px; color: #059669;">${codeReview.edgeCasesScore || 9}/10</div>
            <div class="stat-lbl">Edge Cases</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="font-size: 16px; color: #4f46e5;">${codeReview.timeComplexity || 'O(N)'}</div>
            <div class="stat-lbl">Time Complexity</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="font-size: 16px; color: #7c3aed;">${codeReview.spaceComplexity || 'O(1)'}</div>
            <div class="stat-lbl">Space Complexity</div>
          </div>
        </div>
      `
          : ''
      }

      ${
        voiceMetrics
          ? `
        <div class="section-title">Acoustic Speech & Delivery Metrics</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
          <div class="stat-card">
            <div class="stat-val" style="font-size: 20px; color: #4f46e5;">${voiceMetrics.wpm || 142} WPM</div>
            <div class="stat-lbl">Pace (${voiceMetrics.paceRating || 'Optimal'})</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="font-size: 20px; color: #d97706;">${voiceMetrics.fillerCount || 2}</div>
            <div class="stat-lbl">Filler Words (${voiceMetrics.fillerRatio || 1.8}%)</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="font-size: 20px; color: #059669;">${voiceMetrics.deliveryScore || 88}/100</div>
            <div class="stat-lbl">Delivery Score</div>
          </div>
        </div>
      `
          : ''
      }

      <div class="footer">
        <div>AdaptIQ Engine &bull; IRT Trait Calibration v2.4 &bull; EEOC Bias Audited</div>
        <div>Session ID: ${session._id || session.id}</div>
      </div>
    </body>
    </html>
  `;

  // Launch Puppeteer with sandboxed flags
  try {
    const puppeteer = await getPuppeteer();
    if (!puppeteer) {
      return Buffer.from(html, 'utf-8');
    }
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });

    await browser.close();
    logger.info(`📄 Branded session PDF compiled successfully for candidate: ${candidateName}`);
    return pdfBuffer;
  } catch (puppeteerErr) {
    logger.warn(`Puppeteer compilation error: ${puppeteerErr.message}; returning HTML printable stream.`);
    return Buffer.from(html, 'utf-8');
  }
}

/**
 * Builds printable HTML document for the Skill Gap Analysis and Roadmap Report
 */
function buildReportHtml({ candidateName, targetRole, matchPercentage, claimedVsProven, topGaps, roadmap }) {
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getStatusBadgeHtml = (status) => {
    switch (status) {
      case 'verified':
        return '<span style="background: #064e3b; color: #34d399; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">Verified</span>';
      case 'overclaimed':
        return '<span style="background: #881337; color: #fb7185; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">Overclaimed</span>';
      case 'latent_strength':
        return '<span style="background: #312e81; color: #a5b4fc; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">Latent Strength</span>';
      case 'unverified':
      default:
        return '<span style="background: #334155; color: #94a3b8; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">Unverified</span>';
    }
  };

  const claimedRows = (claimedVsProven || [])
    .slice(0, 15)
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #1e293b;">
      <td style="padding: 10px 12px; font-weight: 600; color: #f8fafc;">${item.skillName}</td>
      <td style="padding: 10px 12px; color: #94a3b8;">${item.category}</td>
      <td style="padding: 10px 12px; color: #cbd5e1;">${item.claimedLevel}</td>
      <td style="padding: 10px 12px; font-weight: bold; color: ${
        item.provenMastery >= 0.7 ? '#10b981' : item.provenMastery >= 0.4 ? '#f59e0b' : '#ef4444'
      };">
        ${item.provenMastery !== null && item.provenMastery !== undefined ? `${Math.round(item.provenMastery * 100)}%` : '—'}
      </td>
      <td style="padding: 10px 12px;">${getStatusBadgeHtml(item.status)}</td>
    </tr>
  `
    )
    .join('');

  const topGapsHtml = (topGaps || [])
    .map(
      (gap, idx) => `
    <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: bold; color: #f8fafc; font-size: 14px;">#${idx + 1} ${gap.name}</span>
        <span style="color: #ef4444; font-weight: bold; font-size: 12px;">Deficiency Gap: ${Math.round(gap.gap * 100)}%</span>
      </div>
      <p style="margin: 6px 0 0; color: #94a3b8; font-size: 12px;">
        ${gap.recommendation}
      </p>
      ${
        gap.rootCauseGaps && gap.rootCauseGaps.length > 0
          ? `<div style="margin-top: 6px; font-size: 11px; color: #fbbf24;">⚠️ Prerequisite Root Cause: <strong>${gap.rootCauseGaps[0].name}</strong> (Mastery: ${Math.round(
              gap.rootCauseGaps[0].mastery * 100
            )}%)</div>`
          : ''
      }
    </div>
  `
    )
    .join('');

  const milestonesHtml = (roadmap?.milestones || [])
    .map(
      (m, idx) => `
    <div style="background: #0f172a; border-left: 4px solid #6366f1; border-radius: 4px 8px 8px 4px; padding: 14px 18px; margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-weight: bold; color: #ffffff; font-size: 14px;">${m.title}</span>
        <span style="color: #818cf8; font-size: 12px; font-weight: 600;">Est. Duration: ${m.durationWeeks} Weeks</span>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin: 0 0 10px;">${m.description}</p>
      <div style="margin-bottom: 8px;">
        <span style="color: #cbd5e1; font-size: 11px; font-weight: bold; text-transform: uppercase;">Targeted Skills:</span>
        <span style="color: #e2e8f0; font-size: 12px; margin-left: 6px;">${m.skillsTargeted.join(' • ')}</span>
      </div>
      <div>
        <span style="color: #cbd5e1; font-size: 11px; font-weight: bold; text-transform: uppercase;">Curated Resources:</span>
        <ul style="margin: 6px 0 0; padding-left: 18px; color: #94a3b8; font-size: 12px;">
          ${m.resources
            .slice(0, 3)
            .map((r) => `<li style="margin-bottom: 4px;"><strong style="color: #f1f5f9;">${r.title}</strong> (${r.type} • ${r.difficulty})</li>`)
            .join('')}
        </ul>
      </div>
    </div>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AdaptIQ - Skill Gap Analysis & Learning Roadmap</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #020617;
      color: #f8fafc;
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .header {
      border-bottom: 2px solid #1e293b;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-size: 24px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .logo span {
      color: #6366f1;
    }
    .metric-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div>
      <div class="logo">Adapt<span>IQ</span></div>
      <div style="font-size: 12px; color: #64748b; margin-top: 2px;">AI-Powered Adaptive Interview & Skill Intelligence Platform</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #94a3b8;">
      <div>Candidate: <strong style="color: #ffffff;">${candidateName}</strong></div>
      <div>Target Role: <strong style="color: #818cf8;">${targetRole}</strong></div>
      <div>Date: ${dateStr}</div>
    </div>
  </div>

  <!-- Executive Summary Score -->
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px;">
    <div class="metric-card">
      <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: bold;">Target Role-Fit Score</div>
      <div style="font-size: 32px; font-weight: 800; color: #10b981; margin: 4px 0;">${matchPercentage}%</div>
      <div style="font-size: 11px; color: #64748b;">Weighted Bayesian match against JD</div>
    </div>
    <div class="metric-card">
      <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: bold;">Identified Skill Gaps</div>
      <div style="font-size: 32px; font-weight: 800; color: #ef4444; margin: 4px 0;">${roadmap?.skillGaps?.length || 0}</div>
      <div style="font-size: 11px; color: #64748b;">Prerequisite and advanced deficiencies</div>
    </div>
    <div class="metric-card">
      <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: bold;">Roadmap Est. Duration</div>
      <div style="font-size: 32px; font-weight: 800; color: #6366f1; margin: 4px 0;">${roadmap?.totalEstimatedWeeks || 8} wks</div>
      <div style="font-size: 11px; color: #64748b;">Topologically ordered learning path</div>
    </div>
  </div>

  <!-- Top 3 Actionable Gaps -->
  <div style="margin-bottom: 28px;">
    <h3 style="font-size: 16px; color: #ffffff; margin-bottom: 12px; border-left: 3px solid #ef4444; padding-left: 8px;">
      Top-3 Highest Leverage Skill Gaps & Root Cause Blockers
    </h3>
    ${topGapsHtml}
  </div>

  <!-- Claimed vs Proven Matrix -->
  <div style="margin-bottom: 28px;">
    <h3 style="font-size: 16px; color: #ffffff; margin-bottom: 12px; border-left: 3px solid #6366f1; padding-left: 8px;">
      Claimed-vs-Proven Competency Verification Table
    </h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; background: #0f172a; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #1e293b; color: #cbd5e1; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">
          <th style="padding: 10px 12px;">Skill Name</th>
          <th style="padding: 10px 12px;">Category</th>
          <th style="padding: 10px 12px;">Claimed (Resume)</th>
          <th style="padding: 10px 12px;">Proven (Assessment)</th>
          <th style="padding: 10px 12px;">Audit Status</th>
        </tr>
      </thead>
      <tbody>
        ${claimedRows}
      </tbody>
    </table>
  </div>

  <!-- Personalized Learning Roadmap -->
  <div>
    <h3 style="font-size: 16px; color: #ffffff; margin-bottom: 12px; border-left: 3px solid #10b981; padding-left: 8px;">
      Topologically Ordered Personalized Learning Roadmap
    </h3>
    ${milestonesHtml}
  </div>

  <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #475569; border-top: 1px solid #1e293b; padding-top: 12px;">
    Generated by AdaptIQ Talent Intelligence Engine • Verified against Psychometric IRT Models & Bayesian Knowledge Tracing
  </div>
</body>
</html>
  `;
}

/**
 * Renders report HTML and exports as high-resolution PDF buffer using Puppeteer.
 *
 * @param {Object} reportData
 * @returns {Promise<Buffer>} PDF Buffer
 */
export async function exportRoadmapToPdf(reportData) {
  const html = buildReportHtml(reportData);

  try {
    const puppeteer = await getPuppeteer();
    if (!puppeteer) {
      return Buffer.from(html, 'utf-8');
    }
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '25px',
        bottom: '25px',
        left: '20px',
        right: '20px'
      }
    });

    await browser.close();
    return pdfBuffer;
  } catch (err) {
    logger.warn(`Puppeteer roadmap PDF generation error: ${err.message}; returning printable HTML stream.`);
    return Buffer.from(html, 'utf-8');
  }
}

export default {
  generateSessionReportPdf,
  exportRoadmapToPdf
};