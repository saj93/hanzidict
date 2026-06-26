import { Resend } from 'resend';

const PLAN_LABELS = {
  monthly: { name: 'Monthly plan', amount: '$4.99' },
  annual:  { name: 'Annual plan',  amount: '$39.99' },
};

function buildHtml(plan) {
  const { name: planName, amount } = PLAN_LABELS[plan] ?? PLAN_LABELS.monthly;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f3ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f3ef; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius: 12px; overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 24px 40px; text-align: center;">
              <span style="font-size: 20px; font-weight: 700; color: #111111;">Hanzi<span style="color:#1D9E75;">Dict</span></span>
            </td>
          </tr>

          <!-- Green banner -->
          <tr>
            <td style="background-color:#1D9E75; padding: 28px 40px; text-align: center;">
              <p style="font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.8); letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 8px 0;">Premium unlocked</p>
              <p style="font-size: 28px; font-weight: 700; color: #ffffff; margin: 0;">Welcome to HanziDict Premium</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px 0 40px;">
              <p style="font-size: 15px; line-height: 1.6; color: #444444; margin: 0 0 24px 0;">
                Your premium access is now active. Here's what you've unlocked:
              </p>

              <!-- Feature list -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0efeb;">
                    <span style="color:#1D9E75; font-weight:700; margin-right:10px;">&#x2713;</span>
                    <span style="font-size:15px; color:#111111;">HSK 5–9 flashcards (12,000+ advanced words)</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0efeb;">
                    <span style="color:#1D9E75; font-weight:700; margin-right:10px;">&#x2713;</span>
                    <span style="font-size:15px; color:#111111;">Unlimited custom word lists</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f0efeb;">
                    <span style="color:#1D9E75; font-weight:700; margin-right:10px;">&#x2713;</span>
                    <span style="font-size:15px; color:#111111;">Full phrasebook – all situations and phrases</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color:#1D9E75; font-weight:700; margin-right:10px;">&#x2713;</span>
                    <span style="font-size:15px; color:#111111;">All 100 most common verbs</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Plan details -->
          <tr>
            <td style="padding: 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f7f4; border-radius:8px; padding:16px;">
                <tr>
                  <td style="padding:8px 16px;">
                    <p style="font-size:13px; color:#888888; margin:0 0 4px 0;">Plan</p>
                    <p style="font-size:15px; font-weight:600; color:#111111; margin:0;">${planName}</p>
                  </td>
                  <td style="padding:8px 16px; text-align:right;">
                    <p style="font-size:13px; color:#888888; margin:0 0 4px 0;">Amount charged</p>
                    <p style="font-size:15px; font-weight:600; color:#111111; margin:0;">${amount}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 32px 40px; text-align: center;">
              <a href="https://hanzidict.app/hsk" style="display: inline-block; background-color: #1D9E75; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">
                Start studying &rarr;
              </a>
            </td>
          </tr>

          <!-- Footer note -->
          <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center;">
              <p style="font-size: 13px; color: #999999; margin: 0;">
                You can manage or cancel your subscription at any time from your <a href="https://hanzidict.app/profile" style="color:#1D9E75; text-decoration:none;">account settings</a>.
              </p>
            </td>
          </tr>

        </table>

        <!-- Bottom wordmark -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
          <tr>
            <td style="text-align: center;">
              <p style="font-size: 12px; color: #aaaaaa; margin: 0;">HanziDict &middot; hanzidict.app</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPremiumEmail(toEmail, plan) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('[premium-email] RESEND_API_KEY not set'); return; }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: 'HanziDict <noreply@hanzidict.app>',
    to: toEmail,
    subject: 'Your HanziDict Premium is active',
    html: buildHtml(plan),
  });

  if (error) console.error('[premium-email] send error:', error.message ?? error);
}
