import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('');
  await page.goto('');
  await page.getByRole('textbox', { name: 'Email address' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('yogesh');
  await page.getByRole('textbox', { name: 'Email address' }).press('Enter');
  await page.getByRole('textbox', { name: 'Enter verification code' }).fill('');
  await page.getByRole('textbox', { name: 'Enter verification code' }).click();
  await page.getByRole('textbox', { name: 'Enter verification code' }).fill('');
  await page.getByRole('textbox', { name: 'Enter verification code' }).click();
  await page.getByRole('textbox', { name: 'Enter verification code' }).fill('');
});