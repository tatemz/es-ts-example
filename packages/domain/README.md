# @es-ts-example/domain

This package owns pure business decisions for five bounded contexts: counter,
experience, adventure, identity, and payments. A command should be
understandable from state, events, invariants, and reducer logic without HTTP,
storage, browser APIs, or provider DTOs.

## Boundary

Production code may depend only on Effect and the aggregate/decision contracts
from `@es-ts-example/event-sourcing`. Adventure, counter, experience, and identity are
isolated contexts. Payments deliberately references adventure and experience
facts; do not turn that exception into general cross-context coupling.

External SDKs, HTTP calls, browser APIs, runtime configuration, and persistence
concerns belong outside this package.

Shared types hold stable cross-context concepts such as identifiers, revision
content, party-size limits, media references, and place references. Media
references identify content; media bytes belong in application storage.

## Experience Blocks

Creator steps are ordered canvases. A step owns its `blocks` array; do not add a
second completion-item container.

The eight explicit variants are narrative, static place, media, place check-in,
manual check, secret code, multiple choice, and photo proof. The last five are
completable and carry `AnyoneCompletes` or `EveryoneCompletes` criteria. Derive
completable blocks from each step instead of storing a second collection.

Future integrations should add explicit block variants with clear behavior. Do
not smuggle provider-specific data through a generic `IntegrationBlock` payload.

## Place References

`PinDrop` stores creator-authored name and coordinates. `ProviderPlace` stores a
creator label and provider reference. Opening hours, provider photos, and other
volatile business data are resolved outside the domain. Domain decisions may
require a place reference but must not depend on live provider metadata.

## Rejections

Domain decisions return precise tagged invariants. Callers branch on the tag;
do not replace it with a generic command failure.

## Tests

Use unit tests for decision examples, property tests for broad invariants, and
Effect BDD for product behavior. Product features live in `features/product`;
domain step definitions live in `packages/domain/test/e2e/steps`.

The domain `e2e` script selects browse, counter, navigation, creator, adventure,
and party features explicitly. Payment feature files are not wired into that
script yet.
