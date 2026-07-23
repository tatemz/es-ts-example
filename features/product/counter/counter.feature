@product @counter
Feature: Counter
  A user creates counters and changes them within fixed bounds.
  Counters count between 0 and 5 and can be disabled, which freezes them.

  @audit-unreviewed @approval-unapproved @priority-p1-core
  Scenario: Creating a counter
    Given no counter exists
    When the counter is created
    Then the counter value is 0
    And the counter is active

  @audit-unreviewed @approval-unapproved @priority-p2-guardrail
  Scenario: Creating again leaves the existing counter active
    Given a counter was created
    When the counter is created again
    Then the counter is active

  @audit-unreviewed @approval-unapproved @priority-p1-core
  Scenario: Counting up
    Given a counter was created
    When the counter is incremented 2 times
    Then the counter value is 2

  @audit-unreviewed @approval-unapproved @priority-p1-core
  Scenario: Counting down
    Given a counter at value 2
    When the counter is decremented
    Then the counter value is 1

  @audit-unreviewed @approval-unapproved @priority-p2-guardrail
  Scenario: The counter never counts above 5
    Given a counter at value 5
    When the counter is incremented
    Then the change is rejected because the counter reached its maximum

  @audit-unreviewed @approval-unapproved @priority-p2-guardrail
  Scenario: The counter never counts below 0
    Given a counter was created
    When the counter is decremented
    Then the change is rejected because the counter reached its minimum

  @audit-unreviewed @approval-unapproved @priority-p2-guardrail
  Scenario: Disabling a counter freezes it
    Given a counter at value 2
    When the counter is disabled
    And the counter is incremented
    Then the change is rejected because the counter is disabled

  @audit-unreviewed @approval-unapproved @priority-p2-guardrail
  Scenario: A missing counter cannot change
    Given no counter exists
    When the counter is incremented
    Then the counter cannot be changed because it does not exist
