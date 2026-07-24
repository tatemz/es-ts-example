# Vocabulary

The root `README.md` explains the event-sourcing concepts. This file explains
the words this codebase chose for them, so that a name you meet in one package
means the same thing in the next one.

If you add a word, add it here. If you rename one, rename it everywhere in the
same commit: two names for one idea is the defect this file exists to prevent.

## Writing Versus Replaying

The single most important distinction in an event-sourced codebase is whether a
fact is about to be written or is being read back. Two verbs carry it, and
nothing else may:

| Word                               | Means                                                              |
| ---------------------------------- | ------------------------------------------------------------------ |
| `recordEvent`                      | A brand-new fact. Queued in `pendingEvents` for the store.         |
| `replayEvent`                      | A fact already in the store. Advances state, queues nothing.       |
| `replayInto`                       | Fold a whole log into a state value, without an aggregate wrapper. |
| `replayCounter`, `replayAggregate` | Rebuild an aggregate from its log.                                 |

There is no boolean flag anywhere that switches between these. If you find
yourself wanting one, you want the other function.

## Domain Words

| Word               | Means                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Decision           | A pure function that accepts or rejects a command. Lives in `Decisions.ts`, named for the command: `toggleArticleBookmark`. |
| Rejection          | A tagged reason a decision said no, such as `CounterIsDisabled`. Lives in `Rejections.ts`. Not "invariant", not "error".    |
| Reducer            | `(state, event) => state`. Redux jargon, kept because every JavaScript developer already knows it.                          |
| Aggregate          | State plus version plus pending events, for one id.                                                                         |
| `newCounter(id)`   | A counter with no history yet. Not "empty": nothing was emptied.                                                            |
| `counterStateFrom` | The state a log adds up to, with no aggregate wrapper.                                                                      |
| `defineAggregate`  | Where you declare how an aggregate replays. Not a factory-factory.                                                          |

## Application Words

| Word                   | Means                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Receipt                | What a command returns: an id and a version. Deliberately cannot describe state.                       |
| Summary                | What a query returns: a tagged row per state that can exist.                                           |
| `eventStoreFor`        | Narrows the shared `DomainEvent` stream to one slice's events.                                         |
| Projection             | Events folded into a shape built for querying.                                                         |
| `ProjectionCheckpoint` | A projection's state plus how far through the log it has read.                                         |
| `matchesProjection`    | Whether a projection cares about one source event.                                                     |
| `clients.ts`           | RPC client tags for a slice. `eventStore.ts` holds the store service. Neither is called `services.ts`. |
| `*ClientLive`          | Effect idiom: the layer that provides a service tag for real.                                          |

Parameter objects are nouns: `StreamQuery`, `AllEventsQuery`,
`AppendRequest<Event>`. A verb-shaped type name makes `fetch(query: FetchEvents)`
read as a function taking a function.

## Web Words

Four file roles, one export each:

| Role       | File              | Owns                                                                    |
| ---------- | ----------------- | ----------------------------------------------------------------------- |
| Controller | `*.controller.ts` | Decode the request, call the client, redirect or hand off a model.      |
| Factory    | `*.factory.ts`    | Every presentation decision. Turns read data into tagged render states. |
| Model      | `*.model.ts`      | A schema of what will be rendered.                                      |
| View       | `*.view.tsx`      | Markup only.                                                            |

`pages/` are whole screens; `controls/` are the reusable pieces pages compose.
The directory carries that distinction, so component names do not: it is
`SubmitButton`, never `EsTsExampleSubmitButton`.

There is no theme layer. One theme shipped, so views live directly under
`src/views/`. Reintroduce the indirection when a second theme actually exists.

## Known Compromises

These names are wrong-ish and staying for now. They are recorded so the next
reader knows it was a decision, not an oversight:

- **`.factory.ts`** — these are presenters, not GoF factories. The word is baked
  into roughly fourteen lint rules; renaming deserves its own change.
- **`Reducer`** — Redux jargon in a domain layer. Kept for familiarity.
- **`Decision<Aggregate, Error>`** — a decision returns the whole aggregate, so
  `pendingEvents`, a persistence concern, reaches into pure domain code.
  Returning only events would be cleaner and touches every test.
