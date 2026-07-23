@infrastructure-contract @event-sourcing
Feature: Event store stream contract
  Event stores record facts in named streams, enforce expected versions, and
  expose records in a stable order for projectors and repositories.

  Background:
    Given an empty event store

    @audit-unreviewed @approval-unapproved @priority-p1-core
    Scenario: A new stream starts at version one
      When stream counter-1 records a counter creation and an increment of 2 at expected version 0
      Then stream counter-1 contains facts in order:
        | stream version | global position | fact               | value |
        | 1              | 1               | CounterCreated     |       |
        | 2              | 2               | CounterIncremented | 2     |

    @audit-unreviewed @approval-unapproved @priority-p0-critical
    Scenario: Stream reads exclude records from other streams
      Given stream counter-1 records a counter creation at expected version 0
      And stream counter-2 records a counter creation and an increment of 10 at expected version 0
      When stream counter-1 is fetched
      Then stream counter-1 contains facts in order:
        | stream version | global position | fact           | value |
        | 1              | 1               | CounterCreated |       |

    @audit-unreviewed @approval-unapproved @priority-p1-core
    Scenario: Stream reads can resume from an inclusive global position
      Given stream counter-1 records a counter creation at expected version 0
      And stream counter-2 records a counter creation and an increment of 10 at expected version 0
      And stream counter-1 records an increment of 2 at expected version 1
      When stream counter-1 is fetched from global position 3
      Then stream counter-1 contains facts in order:
        | stream version | global position | fact               | value |
        | 2              | 4               | CounterIncremented | 2     |

    @audit-unreviewed @approval-unapproved @priority-p0-critical
    Scenario: Stale appends are rejected
      Given stream counter-1 records a counter creation at expected version 0
      When stream counter-1 tries to record an increment of 1 at expected version 0
      Then the append is rejected with an expected version conflict
      And the conflict reports expected version 0 and actual version 1
      And stream counter-1 still contains only the counter creation

    @audit-unreviewed @approval-unapproved @priority-p2-guardrail
    Scenario: Empty appends preserve the next stream version
      When stream counter-1 records no facts at expected version 0
      Then stream counter-1 contains no facts
      And the next recorded fact in stream counter-1 has stream version 1
