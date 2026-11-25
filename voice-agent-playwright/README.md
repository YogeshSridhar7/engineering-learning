# Voice agent Playwright proof of concept

This proof of concept automates only the sign-in portion of the website flow.
It opens Chromium visibly, fills the email address from the environment, and
waits for you to enter the mobile verification code in the browser. It does not
click **Test call**, speak to the agent, or create a calendar event.

## Setup

From this directory, set the email and agent page URL in your shell. These
variables need to be set in each terminal session unless you add them to your
shell configuration (for example, `~/.zshrc`):

```sh
cd /path/to/engineering-learning/voice-agent-playwright
export EMAIL_ADDRESS="your-work-email@example.com"
export AGENT_URL="https://your-agent-page-url"
```

`email_address` (lowercase) is also accepted if that is the variable name you
prefer:

```sh
export email_address="your-work-email@example.com"
```

## Record browser actions with codegen

Codegen is a separate Playwright command; it does not run through `npm test`.
It opens a new browser and writes recorded browser actions to a new test file:

```sh
npx playwright codegen --target=playwright-test \
  --output=tests/recorded-agent.spec.ts "$AGENT_URL"
```

Sign in and perform the UI steps to record. Inspect and edit the generated file
before running it. Codegen may record sensitive text that you type, including
one-time verification codes; remove those values and never commit them.
Codegen records website interactions only, not a phone conversation.

## Run tests

Run all tests:

```sh
npm test
```

Run one test file:

```sh
npm test -- tests/example.spec.ts
```

Run one test by its title (or a unique part of the title):

```sh
npm test -- --grep "sign in and wait"
```

List tests without running them:

```sh
npm test -- --list
```

Open Playwright's interactive test runner:

```sh
npx playwright test --ui
```

The project opens a visible Chromium window. After submitting the email, enter
the verification code on your phone into the website's verification field.
Submit it in the browser; the test waits up to three minutes for the agent page
to finish loading. The code is not read by the test.

The test intentionally does not save browser authentication state. You may need
to verify your identity each run. Do not add credentials, verification codes,
real caller details, or browser session files to source control.

## Scope and next step

This is an assisted UI smoke test, not yet an automated voice-call test. Before
adding a call action, confirm that the environment uses an approved test phone
number and a dedicated test calendar. Automating the conversation itself will
also require a supported way to provide caller audio or connect a test caller.
