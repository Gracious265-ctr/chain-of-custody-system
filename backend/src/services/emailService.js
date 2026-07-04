const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');

dotenv.config();

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured successfully');
  console.log(`📧 From: ${process.env.EMAIL_FROM || 'Chain of Custody <no-reply@chainofcustody.local>'}`);
} else {
  console.log('⚠️ SendGrid API key missing. Emails will not be sent.');
  console.log('📧 Please set SENDGRID_API_KEY in your .env file');
}

// Send password email (New User)
const sendPasswordEmail = async (email, username, password, role) => {
  try {
    // Log to console for debugging
    console.log('=========================================');
    console.log('📧 NEW USER ACCOUNT CREATED');
    console.log('=========================================');
    console.log(`👤 Username: ${username}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Role: ${role}`);
    console.log(`🔐 Password: ${password}`);
    console.log(`🔗 Login URL: http://localhost:3000/login`);
    console.log('=========================================');

    if (process.env.SENDGRID_API_KEY) {
      const loginUrl = `http://localhost:3000/login`;
      const fromEmail = process.env.EMAIL_FROM || 'Chain of Custody <no-reply@chainofcustody.local>';
      
      const msg = {
        to: email,
        from: fromEmail,
        subject: `Welcome to Chain of Custody - Your Account Details`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background: #0f3460; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0;">⚖️ Criminal Evidence Chain of Custody</h2>
              <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Blockchain Criminal Evidence Chain of Custody Management System</p>
            </div>
            <div style="padding: 20px;">
              <h2 style="color: #0f3460;">Welcome to Chain of Custody System!</h2>
              <p>Your account has been created by the Administrator. Here are your login details:</p>
              
              <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #0f3460;">
                <p style="margin: 5px 0;"><strong>👤 Username:</strong> <span style="color: #0f3460; font-weight: 600;">${username}</span></p>
                <p style="margin: 5px 0;"><strong>📧 Email:</strong> <span style="color: #0f3460;">${email}</span></p>
                <p style="margin: 5px 0;"><strong>🔑 Role:</strong> <span style="color: #0f3460;">${role}</span></p>
                <p style="margin: 5px 0;"><strong>🔐 Temporary Password:</strong> <code style="background: #edf2f7; padding: 4px 8px; border-radius: 4px; font-size: 16px; font-weight: 700; color: #e53e3e;">${password}</code></p>
              </div>
              
              <div style="background: #ebf8ff; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #bee3f8;">
                <p style="margin: 0; color: #2b6cb0; font-weight: 600;">🔗 Login Instructions:</p>
                <ol style="margin: 8px 0 0 20px; color: #2d3748;">
                  <li>Click the login button below</li>
                  <li>Enter your username: <strong>${username}</strong></li>
                  <li>Enter the temporary password provided above</li>
                  <li>You will be prompted to change your password upon first login</li>
                </ol>
              </div>
              
              <a href="${loginUrl}" style="display: inline-block; background: #0f3460; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 15px 0; text-align: center; width: 100%; box-sizing: border-box;">
                🔐 Login to Chain of Custody System
              </a>
              
              <p style="margin-top: 20px; font-size: 14px; color: #718096; background: #fff5f5; padding: 12px; border-radius: 6px; border: 1px solid #fed7d7;">
                <strong>⚠️ Important Security Notice:</strong><br>
                For security reasons, please change your password immediately after logging in. This is a temporary password and should not be shared with anyone.
              </p>
            </div>
            <div style="background: #f7fafc; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #718096;">
              <p style="margin: 0;">This is an automated message from Chain of Custody System.</p>
              <p style="margin: 5px 0 0 0;">For any questions, please contact your system administrator.</p>
            </div>
          </div>
        `
      };

      const info = await sgMail.send(msg);
      console.log(`✅ Email sent successfully to ${email}: ${info[0].statusCode}`);
      return { success: true, messageId: info[0].headers['x-message-id'] };
    } else {
      console.error('❌ Email not sent - SendGrid not configured.');
      return { success: false, error: 'SendGrid not configured' };
    }
  } catch (error) {
    console.error('❌ Error sending email:', error.response?.body || error);
    return { success: false, error: error.message };
  }
};

// Send password change notification
const sendPasswordChangedEmail = async (email, username) => {
  try {
    console.log('=========================================');
    console.log('📧 PASSWORD CHANGED');
    console.log('=========================================');
    console.log(`👤 Username: ${username}`);
    console.log(`📧 Email: ${email}`);
    console.log('=========================================');

    if (process.env.SENDGRID_API_KEY) {
      const fromEmail = process.env.EMAIL_FROM || 'Chain of Custody <no-reply@chainofcustody.local>';
      
      const msg = {
        to: email,
        from: fromEmail,
        subject: `Chain of Custody - Password Changed`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background: #0f3460; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0;">⚖️ Criminal Evidence Chain of Custody</h2>
            </div>
            <div style="padding: 20px;">
              <h2>Password Changed Successfully</h2>
              <p>Hello <strong>${username}</strong>,</p>
              <p>Your password has been changed successfully.</p>
              <div style="background: #fff5f5; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #fed7d7;">
                <p style="margin: 0; color: #9b2c2c; font-weight: 600;">🚨 If you did not make this change:</p>
                <p style="margin: 5px 0 0 0; color: #4a5568;">Please contact the Administrator immediately to secure your account.</p>
              </div>
            </div>
            <div style="background: #f7fafc; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #718096;">
              <p style="margin: 0;">This is an automated message from Chain of Custody System.</p>
            </div>
          </div>
        `
      };

      const info = await sgMail.send(msg);
      console.log(`✅ Password change notification sent to ${email}: ${info[0].statusCode}`);
      return { success: true, messageId: info[0].headers['x-message-id'] };
    } else {
      console.error('❌ Password change notification not sent - SendGrid not configured.');
      return { success: false, error: 'SendGrid not configured' };
    }
  } catch (error) {
    console.error('❌ Error sending password change email:', error.response?.body || error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendPasswordEmail, sendPasswordChangedEmail };

