@product @bookmarks
Feature: Article bookmarks
  A reader keeps a list of articles to come back to. The catalog is the same for
  everyone; a bookmark is a fact one reader records on top of it.

  @audit-unreviewed @approval-unapproved @priority-p1-core
  Scenario: Bookmarking an article
    Given a reader with no bookmarks
    When the reader bookmarks "events-over-state"
    Then the article list shows bookmarks for "events-over-state"
    And the article list still shows every article in the catalog

  @audit-unreviewed @approval-unapproved @priority-p1-core
  Scenario: Bookmarking the same article again removes the bookmark
    Given a reader who bookmarked "events-over-state"
    When the reader bookmarks "events-over-state"
    Then the article list shows no bookmarks
    And the article list still shows every article in the catalog

  @audit-unreviewed @approval-unapproved @priority-p2-guardrail
  Scenario: Bookmarking a second article keeps the first
    Given a reader who bookmarked "events-over-state"
    When the reader bookmarks "small-batches"
    Then the article list shows bookmarks for "events-over-state, small-batches"

  @audit-unreviewed @approval-unapproved @priority-p2-guardrail
  Scenario: One reader's bookmarks belong to that reader alone
    Given a reader who bookmarked "events-over-state"
    When the article list is opened by a different reader
    Then the article list shows no bookmarks

  @audit-unreviewed @approval-unapproved @priority-p2-guardrail
  Scenario: Removing one bookmark leaves the others alone
    Given a reader who bookmarked "events-over-state"
    When the reader bookmarks "small-batches"
    And the reader bookmarks "events-over-state"
    Then the article list shows bookmarks for "small-batches"
