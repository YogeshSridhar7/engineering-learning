@voice @e2e @calendar-write
Feature: Book a health-check appointment through a voice agent
  This scenario is intended for a dedicated test agent and Google Calendar only.
  Use synthetic caller data and a future test slot. Never run it against a real
  patient's calendar. The call and calendar event are real side effects.

  Background:
    Given the browser is authenticated to the test environment
    And the agent is configured to use the dedicated test calendar
    And the caller simulator is connected to the agent's test-call number

  Scenario Outline: Book an available health-check slot
    Given the test calendar has no event at "<date>" "<time>" "<timezone>"
    When the caller asks to book a health check for "<date>" at "<time>"
    And the caller answers any required questions with synthetic test data
    And the caller confirms the agent's spoken summary of the appointment
    Then exactly one health-check appointment is present at "<date>" "<time>" "<timezone>"
    And the agent tells the caller the appointment was booked
    And the call transcript and calendar event agree on the date and time

    Examples:
      | date       | time  | timezone            |
      | 2026-12-03 | 10:30 | America/Los_Angeles |

  Scenario: Do not book when the caller declines confirmation
    Given the test calendar has no event for this test run
    When the agent summarizes a proposed health-check appointment
    And the caller says not to book it
    Then no appointment is created in the test calendar
    And the agent does not say the appointment was booked
