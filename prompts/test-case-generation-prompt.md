# Test Case Generation Prompt

## Feature

[INSERT FEATURE]

## System Context

[INSERT SHORT SYSTEM DESCRIPTION]

## Requirement

[INSERT REQUIREMENT]

## Generate Test Cases For

- happy path
- negative path
- boundary conditions
- invalid inputs
- dependency failure
- timeout
- retry behaviour
- duplicate requests
- state transitions
- concurrency where relevant
- security / access control
- performance where relevant
- observability / logging

## Test Case Format

Use this table:

| Test ID | Scenario | Preconditions | Input / Steps | Expected Result | Evidence | Priority |
|---|---|---|---|---|---|---|

## Rules

- Avoid duplicate tests.
- Keep each test focused on one behaviour.
- Use realistic inputs.
- Identify the likely failure layer where useful.
- Include both functional and non-functional cases.
- Prefer risk-based coverage over large numbers of shallow cases.

## Additional Section

After the table, add:

### Highest-Risk Scenarios

### Regression Candidates

### Automation Candidates

### Cases Better Suited to Exploratory Testing