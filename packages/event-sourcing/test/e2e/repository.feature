@infrastructure-contract @event-sourcing
Feature: Aggregate repository contract
  Event-sourced repositories load aggregates from streams and save unsaved facts
  with optimistic concurrency.

  Background:
    Given an event store contains counter streams

    @audit-unreviewed @approval-unapproved @priority-p2-guardrail
    Scenario: Missing aggregates load as clean initial state
      When the counter repository loads counter-1
      Then the loaded counter state is 0
      And the loaded counter version is 0
      And the loaded counter has no unsaved facts

    @audit-unreviewed @approval-unapproved @priority-p1-core
    Scenario: Existing aggregates rehydrate from recorded facts
      Given stream counter-1 contains a counter creation and an increment of 2
      When the counter repository loads counter-1
      Then the loaded counter state is 2
      And the loaded counter version is 2
      And the loaded counter has no unsaved facts

    @audit-unreviewed @approval-unapproved @priority-p1-core
    Scenario: Changed aggregates append only pending facts
      Given the counter repository has loaded counter-1
      When the loaded counter is incremented by 3
      And the loaded counter is saved
      Then the saved counter state is 3
      And the saved counter version is 1
      And the saved counter has no unsaved facts
      And stream counter-1 contains facts in order:
        | fact               | value |
        | CounterIncremented | 3     |

    @audit-unreviewed @approval-unapproved @priority-p2-guardrail
    Scenario: Unchanged aggregates do not append facts
      Given the counter repository has loaded counter-1
      When the loaded counter is saved
      Then the saved counter state is 0
      And the saved counter version is 0
      And stream counter-1 contains no facts

    @audit-unreviewed @approval-unapproved @priority-p0-critical
    Scenario: Stale aggregate copies cannot overwrite newer facts
      Given two copies of counter-1 are loaded at the same version
      And the first copy has already saved an increment of 1
      When the second copy tries to save an increment of 2
      Then the save is rejected with an expected version conflict
      And the conflict reports expected version 0 and actual version 1
      And stream counter-1 contains facts in order:
        | fact               | value |
        | CounterIncremented | 1     |

    @audit-unreviewed @approval-unapproved @priority-p0-critical
    Scenario: Stream naming isolates repositories that share domain ids
      Given two counter repositories use different stream names
      When both repositories save a counter named shared-id
      Then the first repository loads shared-id with state 1
      And the second repository loads shared-id with state 2
      And each repository only sees its own facts
