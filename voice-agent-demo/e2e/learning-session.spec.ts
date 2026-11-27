import { expect, test } from '@playwright/test'

async function installSpeechFixtures(
  page: import('@playwright/test').Page,
  options: { transcript: string; error?: string },
) {
  await page.addInitScript(({ transcript, error }) => {
    class FixtureRecognition {
      lang = ''
      continuous = true
      interimResults = true
      onresult: ((event: unknown) => void) | null = null
      onerror: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null

      start() {
        setTimeout(() => {
          if (error) {
            this.onerror?.({ error, message: 'private browser detail' })
            return
          }
          this.onresult?.({ results: [[{ transcript }]] })
        }, 350)
      }

      stop() {}

      abort() {
        this.onend?.()
      }
    }

    class FixtureUtterance {
      text: string
      onend: (() => void) | null = null
      onerror: (() => void) | null = null

      constructor(text: string) {
        this.text = text
      }
    }

    Object.defineProperty(globalThis, 'webkitSpeechRecognition', {
      configurable: true,
      value: FixtureRecognition,
    })
    Object.defineProperty(globalThis, 'SpeechRecognition', {
      configurable: true,
      value: FixtureRecognition,
    })
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: FixtureUtterance,
    })
    Object.defineProperty(globalThis, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: FixtureUtterance) {
          document.documentElement.dataset.spokenText = utterance.text
          setTimeout(() => utterance.onend?.(), 450)
        },
      },
    })
  }, options)
}

test('session startup error is visible and can be retried', async ({ page }) => {
  await page.goto('/')
  let firstAttempt = true
  await page.route('**/api/sessions', async (route) => {
    if (firstAttempt) {
      firstAttempt = false
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Learning sessions are temporarily unavailable' }),
      })
      return
    }
    await route.continue()
  })

  await page.getByRole('button', { name: 'Start learning session' }).click()
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  await expect(page.getByRole('button', { name: 'Start learning session' })).toBeEnabled()

  await page.getByRole('button', { name: 'Start learning session' }).click()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()
})

test('spoken question uses the learning session API and reads only the answer text', async ({
  page,
}) => {
  await installSpeechFixtures(page, {
    transcript: 'How does psychological safety help a team?',
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Start learning session' }).click()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()

  const turnRequestPromise = page.waitForRequest(
    (request) => request.url().includes('/turns') && request.method() === 'POST',
  )
  const turnResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/turns') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Ask by voice' }).click()
  await expect(page.locator('.voice-status')).toContainText('Listening')
  const turnRequest = await turnRequestPromise
  expect(turnRequest.postDataJSON()).toEqual({
    question: 'How does psychological safety help a team?',
  })
  const turnResponse = await turnResponsePromise
  expect(turnResponse.status()).toBe(200)
  const answerBody = await turnResponse.json() as {
    answer: { speakableText: string; usedFallback: boolean }
  }
  expect(answerBody.answer.speakableText.trim().length).toBeGreaterThan(0)
  expect(answerBody.answer.usedFallback).toBe(false)

  await expect(page.locator('.voice-status')).toContainText('Speaking')
  await expect(page.locator('.session-message')).toContainText('Answer ready')
  const spokenText = await page.locator('html').getAttribute('data-spoken-text')
  expect(spokenText).toBeTruthy()
  expect(spokenText).not.toContain('http')
  await expect(page.locator('.voice-status')).toContainText('Ready')

  const transcriptResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/transcript') && response.status() === 200,
  )
  await page.getByRole('button', { name: 'Show conversation' }).click()
  const transcriptResponse = await transcriptResponsePromise
  const transcriptBody = await transcriptResponse.json() as {
    turns: Array<{
      question: string
      answer: string
      evidence: Array<{ sourceId: string; excerpt: string }>
    }>
  }
  expect(transcriptBody.turns).toHaveLength(1)
  expect(transcriptBody.turns[0]).toMatchObject({
    question: 'How does psychological safety help a team?',
    answer: answerBody.answer.speakableText,
    evidence: [expect.objectContaining({ sourceId: 'google-project-aristotle' })],
  })

  const conversation = page.locator('.conversation-transcript')
  await expect(conversation.getByText('How does psychological safety help a team?')).toBeVisible()
  await expect(conversation.getByText(answerBody.answer.speakableText)).toBeVisible()
  await expect(conversation.getByRole('link', { name: /Google re:Work/ })).toBeVisible()
  await expect(conversation.locator('blockquote')).toContainText('Psychological safety')
})

test('microphone permission failure is safe and leaves typed questions available', async ({
  page,
}) => {
  await installSpeechFixtures(page, { transcript: '', error: 'not-allowed' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start learning session' }).click()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Ask by voice' }).click()
  await expect(page.getByRole('alert')).toContainText('Microphone permission was denied')
  await expect(page.getByRole('alert')).not.toContainText('private browser detail')
  await expect(page.getByRole('textbox', { name: 'Ask a learning question' })).toBeEnabled()
})

test('voice provider failure does not speak or invent an answer', async ({ page }) => {
  await installSpeechFixtures(page, {
    transcript: 'How does psychological safety help a team?',
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start learning session' }).click()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()
  await page.route('**/api/sessions/*/turns', (route) => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Answer generation is temporarily unavailable' }),
  }))

  await page.getByRole('button', { name: 'Ask by voice' }).click()
  await expect(page.getByRole('alert')).toContainText('Answer generation is temporarily unavailable')
  await expect(page.locator('html')).not.toHaveAttribute('data-spoken-text')
  await expect(page.locator('.conversation-transcript')).toHaveCount(0)
})

test('learner starts a session, asks a grounded question, and reviews its transcript', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your learning conversation' })).toBeVisible()

  await page.route('**/api/sessions', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200))
    await route.continue()
  })
  await page.getByRole('button', { name: 'Start learning session' }).click()
  await expect(page.getByText('Connecting', { exact: true })).toBeVisible()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Ask a learning question' })).toBeVisible()

  const questionInput = page.getByRole('textbox', { name: 'Ask a learning question' })
  await questionInput.fill(
    'How does psychological safety help a team?',
  )
  let firstAttempt = true
  await page.route('**/api/sessions/*/turns', async (route) => {
    if (firstAttempt) {
      firstAttempt = false
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Answer generation is temporarily unavailable' }),
      })
      return
    }
    await route.continue()
  })
  await page.getByRole('button', { name: 'Ask question' }).click()
  await expect(page.getByRole('alert')).toContainText('Answer generation is temporarily unavailable')
  await expect(questionInput).toHaveValue('How does psychological safety help a team?')
  await page.getByRole('button', { name: 'Ask question' }).click()

  await expect(page.locator('.session-message')).toContainText('Answer ready')
  const transcriptResponse = page.waitForResponse(
    (response) => response.url().includes('/transcript') && response.status() === 200,
  )
  await page.getByRole('button', { name: 'Show conversation' }).click()
  const transcriptResponseBody = await transcriptResponse
  expect(await transcriptResponseBody.json()).toMatchObject({
    turns: [{
      question: 'How does psychological safety help a team?',
      evidence: [expect.objectContaining({ sourceId: 'google-project-aristotle' })],
    }],
  })

  const transcript = page.locator('.conversation-transcript')
  await expect(transcript.getByText('You', { exact: true })).toBeVisible()
  await expect(transcript.getByText('How does psychological safety help a team?')).toBeVisible()
  await expect(transcript.getByText('Learning assistant')).toBeVisible()
  await expect(transcript.getByRole('link', { name: /Google re:Work/ })).toBeVisible()
  await expect(transcript.locator('blockquote')).toContainText('Psychological safety')
})

test('out-of-corpus question shows the fallback in the completed transcript', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start learning session' }).click()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()

  await page.getByRole('textbox', { name: 'Ask a learning question' }).fill(
    'How do I tune a carburetor?',
  )
  await page.getByRole('button', { name: 'Ask question' }).click()
  await expect(page.locator('.session-message')).toContainText('No matching evidence')

  await page.getByRole('button', { name: 'End session' }).click()
  await expect(page.getByText('Ended', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Show conversation' }).click()

  const transcript = page.locator('.conversation-transcript')
  await expect(transcript.getByRole('heading', { name: 'Completed conversation' })).toBeVisible()
  await expect(transcript).toContainText('How do I tune a carburetor?')
  await expect(transcript).toContainText(
    'I could not find enough evidence in the selected learning material.',
  )
})
