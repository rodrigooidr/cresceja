import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const {
  SES_REGION,
  SES_ACCESS_KEY,
  SES_SECRET_KEY,
  SES_FROM_EMAIL,
} = process.env;

let client = null;
if (SES_REGION && SES_ACCESS_KEY && SES_SECRET_KEY) {
  client = new SESClient({
    region: SES_REGION,
    credentials: {
      accessKeyId: SES_ACCESS_KEY,
      secretAccessKey: SES_SECRET_KEY,
    },
  });
}

export async function sendEmail({ to, subject, html }) {
  if (!client) {
    console.log('[ses] stub send', { to, subject });
    return { MessageId: 'stub' };
  }
  const command = new SendEmailCommand({
    Destination: { ToAddresses: [to] },
    Message: {
      Body: { Html: { Data: html } },
      Subject: { Data: subject },
    },
    Source: SES_FROM_EMAIL || to,
  });
  return client.send(command);
}

export default { sendEmail };
