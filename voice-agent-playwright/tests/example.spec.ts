import { test, expect } from '@playwright/test';

const emailAddress = process.env.EMAIL_ADDRESS ?? process.env.email_address;
const agentUrl = process.env.AGENT_URL;

test('sign in and wait for manual mobile verification', async ({ page }) => {
  if (!emailAddress) {
    throw new Error('Set EMAIL_ADDRESS (or email_address) in the environment before running this test.');
  }
  if (!agentUrl) {
    throw new Error('Set AGENT_URL to the agent page URL before running this test.');
  }

  const target = new URL(agentUrl);
  if (target.protocol !== 'https:') {
    throw new Error('AGENT_URL must use HTTPS.');
  }

  await page.goto(target.toString());
  await page.getByRole('textbox', { name: 'Email address' }).fill(emailAddress);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(
    page.getByRole('textbox', { name: 'Enter verification code' }),
  ).toBeVisible({ timeout: 60_000 });

  console.log('Enter the verification code in the browser to continue. The code is not read or stored by this test.');
  await expect(page.getByRole('button', { name: 'Test call' })).toBeVisible({
    timeout: 180_000,
  });
  await page.getByRole('button', { name: 'Test call' }).click();
  await page.getByRole('dialog', { name: 'Test call' }).click();
  await page.getByRole('checkbox', { name: 'Save this call to' }).click();
  await page.getByRole('button', { name: 'Start talking' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('tabpanel', { name: 'Profile' }).dblclick();
  await page.getByRole('link', { name: 'Conversations' }).click();
});
