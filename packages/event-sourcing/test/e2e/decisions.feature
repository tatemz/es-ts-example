@domain-contract @event-sourcing
Feature: Event-sourced decision contract
  Event-sourced command handling expresses accepted decisions as facts and
  rejected decisions as typed domain errors.

  Background:
    Given a counter command handler uses event-sourced decisions

    @audit-unreviewed @approval-unapproved @priority-p1-core
    Scenario: Accepted commands produce facts
      Given the counter is open
      When an increment command for 1 is handled
      Then the decision succeeds with facts:
        | fact               | value |
        | CounterIncremented | 1     |

    @audit-unreviewed @approval-unapproved @priority-p2-guardrail
    Scenario: Rejected commands produce typed errors without facts
      Given the counter is closed
      When an increment command for 1 is handled
      Then the decision fails with a counter closed error
      And the decision produces no facts
