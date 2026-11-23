/**
 * @file Candidate Assessment Invitation Service (Nodemailer)
 * Generates and dispatches branded email invitations with unique assessment session tokens.
 */

import nodemailer from 'nodemailer';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

let transporter = null;

/**
 * Initializes or returns existing Nodemailer transporter
 */
const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Development / Test Ethereal or Mock Transport
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      logger.info(`📧 Nodemailer initialized with Ethereal test account: ${testAccount.user}`);
    } catch (e) {
      // Stream Transport fallback
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows',
        buffer: true
      });
      logger.info('📧 Nodemailer initialized with StreamTransport fallback');
    }
  }

  return transporter;
};

/**
 * Sends a personalized, branded candidate assessment invitation email.
 *
 * @param {Object} params
 * @param {string} params.recipientEmail
 * @param {string} params.recipientName
 * @param {string} params.track - Assessment role track (e.g. 'fullstack', 'frontend')
 * @param {string} [params.customNote]
 * @param {string} params.inviteUrl
 * @param {string} [params.recruiterName]
 * @returns {Promise<{ success: boolean, messageId: string, previewUrl: string|null }>}
 */
export async function sendCandidateInvitation({
  recipientEmail,
  recipientName,
  track = 'Full-Stack Engineering',
  customNote = '',
  inviteUrl,
  recruiterName = 'AdaptIQ Talent Acquisition Team'
}) {
  try {
    const mailTransporter = await getTransporter();

    const trackNameMap = {
      fullstack: 'Full-Stack Engineering',
      frontend: 'Frontend Architecture',
      backend: 'Backend & Cloud Systems',
      devops: 'DevOps & Site Reliability',
      datascience: 'AI & Machine Learning'
    };
    const formattedTrack = trackNameMap[track.toLowerCase()] || track;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; }
          .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px 24px; text-align: center; }
          .logo { font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }
          .content { padding: 32px 24px; }
          .btn { display: inline-block; background-color: #6366f1; color: #ffffff !important; padding: 14px 28px; border-radius: 12px; font-weight: 700; text-decoration: none; margin: 24px 0; text-align: center; }
          .callout { background: #0f172a; border-left: 4px solid #6366f1; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #cbd5e1; }
          .footer { padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">AdaptIQ &bull; AI Assessment</div>
            <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">Adaptive Skill & Latent Ability Certification</p>
          </div>
          <div class="content">
            <h2 style="color: #ffffff; margin-top: 0;">Hello ${recipientName},</h2>
            <p style="color: #cbd5e1; line-height: 1.6;">
              You have been invited by <strong>${recruiterName}</strong> to take an AI-powered adaptive interview for the <strong>${formattedTrack}</strong> track on AdaptIQ.
            </p>
            ${
              customNote
                ? `<div class="callout"><strong>Recruiter Note:</strong><br>${customNote}</div>`
                : ''
            }
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="btn">Launch Assessment Session &rarr;</a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
              <strong>What to Expect:</strong><br>
              &bull; <strong>Adaptive Question Engine:</strong> Questions calibrate to your skill level in real-time.<br>
              &bull; <strong>Multi-Round Format:</strong> Algorithmic coding, system architecture, and STAR behavioral questions.<br>
              &bull; <strong>Explainable AI Feedback:</strong> Instant rubric breakdowns, SHAP attribution, and skill gap roadmaps.
            </p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} AdaptIQ AI Platforms &bull; Equal Opportunity & Bias-Audited Testing
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await mailTransporter.sendMail({
      from: `"AdaptIQ AI" <${process.env.SMTP_FROM || 'assessments@adaptiq.ai'}>`,
      to: recipientEmail,
      subject: `Interview Invitation: ${formattedTrack} Assessment on AdaptIQ`,
      html: htmlContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    logger.info(`✉️ Sent assessment invitation to ${recipientEmail} (ID: ${info.messageId})`);

    return {
      success: true,
      messageId: info.messageId,
      previewUrl
    };
  } catch (error) {
    logger.error(`Failed to send invitation email: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  sendCandidateInvitation
};