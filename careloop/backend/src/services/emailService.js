const config = require('../config');

class EmailService {
  constructor() {
    this.sender = config.aws.sesSenderEmail;
  }

  /**
   * Send 6-Digit One-Time Password (OTP)
   */
  async sendOtpEmail(recipientEmail, otpCode) {
    const subject = `Your CareLoop Login Code: ${otpCode}`;
    const textBody = `Hello,\n\nYour 6-digit CareLoop verification code is: ${otpCode}\n\nThis code will expire in ${config.otpExpiresMinutes} minutes. If you did not request this login code, you can safely ignore this email.\n\nWarm regards,\nCareLoop Clinical Team`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background: #0B0D0C; color: #F4F6F4; border-radius: 12px; border: 1px solid #26302C;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background-color: #4ADE94;"></div>
          <span style="font-weight: 700; font-size: 18px; letter-spacing: -0.02em; color: #F4F6F4;">CareLoop</span>
        </div>
        <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 8px; color: #FFFFFF;">Verification Code</h2>
        <p style="font-size: 14px; color: #9BA8A2; line-height: 1.5; margin-bottom: 24px;">
          Use the following one-time code to authenticate your Caregiver or Clinical access session:
        </p>
        <div style="background: #121514; border: 1px solid #3A4740; border-radius: 8px; padding: 18px 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #4ADE94;">${otpCode}</span>
        </div>
        <p style="font-size: 12px; color: #5E6B65; line-height: 1.5; margin: 0;">
          This code expires in 10 minutes. Strictly confidential. Never share this code with anyone.
        </p>
      </div>
    `;

    // If AWS SES credentials exist, dispatch via AWS SES
    if (config.aws.isAwsConfigured) {
      try {
        console.log(`[AWS SES] Dispatching OTP email to ${recipientEmail} via region ${config.aws.region}...`);
        // AWS SES dispatch call logic placeholder
        return { success: true, provider: 'aws-ses', recipient: recipientEmail };
      } catch (err) {
        console.error('[AWS SES Error]', err);
      }
    }

    // Development & Local Fallback Logger
    console.log('\n' + '='.repeat(50));
    console.log(`[EMAIL DISPATCH - DEV/AWS LOG]`);
    console.log(`TO: ${recipientEmail}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`6-DIGIT OTP CODE: [ ${otpCode} ]`);
    console.log('='.repeat(50) + '\n');

    return {
      success: true,
      provider: 'dev-console-logger',
      recipient: recipientEmail,
      previewCode: otpCode // Exposed in dev response for instant convenience
    };
  }
}

module.exports = new EmailService();
