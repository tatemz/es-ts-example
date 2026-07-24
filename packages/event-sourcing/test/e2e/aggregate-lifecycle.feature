@infrastructure-contract @event-sourcing
Feature: Event-sourced aggregate lifecycle contract
  Event-sourced aggregates rebuild their current state from recorded facts and
  keep new facts unsaved until a repository persists them.

  Background:
    Given an event-sourced counter aggregate exists

    @audit-unreviewed @approval-unapproved @priority-p1-core
    Scenario: New aggregates start clean
      When a new counter aggregate is created
      Then the counter state is 0
      And the aggregate version is 0
      And the aggregate has no unsaved facts

    @audit-unreviewed @approval-unapproved @priority-p1-core
    Scenario: History rebuilds current aggregate state
      Given the counter history contains increments of 2 and 3
      When the aggregate is replayed from its history
      Then the counter state is 5
      And the aggregate version is 2
      And the aggregate has no unsaved facts

    @audit-unreviewed @approval-unapproved @priority-p0-critical
    Scenario: History is replayed in recorded order
      Given the counter history contains an increment of 2, a reset, and an increment of 3
      When the aggregate is replayed from its history
      Then the counter state is 3
      And the aggregate version is 3
      And the aggregate has no unsaved facts

    @audit-unreviewed @approval-unapproved @priority-p1-core
    Scenario: One new change is tracked as pending
      Given the counter has been replayed at version 2
      When the counter is incremented by 4
      Then the counter state is 9
      And the aggregate version is 3
      And the aggregate has unsaved facts:
        | fact               | value |
        | CounterIncremented | 4     |

    @audit-unreviewed @approval-unapproved @priority-p0-critical
    Scenario: Multiple new changes are tracked in order
      Given the counter has been replayed at version 2
      When the counter is incremented by 4
      And the counter is incremented by 1
      Then the counter state is 10
      And the aggregate version is 4
      And the aggregate has unsaved facts in order:
        | fact               | value |
        | CounterIncremented | 4     |
        | CounterIncremented | 1     |
