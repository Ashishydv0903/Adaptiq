/**
 * @file PDF Report Export Service using Puppeteer
 * Generates an executive Skill Gap Analysis & Personalized Learning Roadmap PDF.
 */

import puppeteer from 'puppeteer';

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

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
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

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
