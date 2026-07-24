# @es-ts-example/web

This package is the Bun/Effect HTTP composition root and a server-rendered MVC
view over the application RPC clients. It renders escaped HTML through JSX and
uses ordinary forms with Post/Redirect/Get. There is no client-side JavaScript.

## Routed Surface

`src/routes.ts` is the path source of truth; `src/server.ts` owns method and
controller wiring.

| Method | Path                                | Controller           |
| ------ | ----------------------------------- | -------------------- |
| GET    | `/`                                 | `getCounterPage`     |
| GET    | `/articles`                         | `getArticlesPage`    |
| POST   | `/actions/counter/create`           | `postCreateCounter`  |
| POST   | `/actions/counter/command`          | `postCounterCommand` |
| POST   | `/actions/articles/toggle-bookmark` | `postToggleBookmark` |
| GET    | `/client.css`                       | compiled stylesheet  |

Every POST redirects; no mutation renders its own response. The articles slice
uses the fixed local identity `user-local`, because this example has no
authentication.

## MVC Boundary

Four file roles, one export each, enforced by the `es-ts-example/mvc-*` oxlint
rules:

- **Controllers** (`src/controllers/*.controller.ts`) decode the request, call
  the application RPC client, and hand data to a factory. A GET controller
  returns one page model. A POST controller returns a redirect target.
- **Factories** (`src/factories/**/*.factory.ts`) are the presentation decision
  boundary. They translate application read data into tagged render states and
  resolve user-facing copy through typed i18n messages. Every branch a page can
  take is decided here.
- **Models** (`src/models/**/*.model.ts`) are schemas of what will be rendered.
  Private tagged unions make impossible combinations unrepresentable: a counter
  list is `CounterListEmpty` or `CounterListPopulated` with a non-empty array,
  never an array plus a boolean.
- **Views** (`src/views/**/*.view.tsx`) translate render states into markup and
  nothing else. A view may dispatch over a tagged union, but it may not branch
  on array length, domain values, or coupled optional fields; those are factory
  decisions.

`pages/` holds whole-screen roles; `controls/` holds the reusable form controls
that pages compose. Only page models and page views are exported from
`src/index.ts`.

Domain tags and entities never cross into models. If a view needs to know that a
counter is disabled, the factory has already turned that into `statusText`.

Duplication between two page views is often coincidental. Prefer explicit markup
and well-formed render states over abstractions that push layout decisions back
into views.

## Runtime

`bin/main.ts` starts the server. `bin/runtime.ts` selects the domain event store
from validated runtime configuration and provides the in-process application RPC
clients. See the root `README.md` for environment variables.

Tailwind 4 and daisyUI 5 compile `src/styles.css` to `public/client.css`;
`start` and `check` build the stylesheet first.

## Local Feedback

```shell
bun --filter @es-ts-example/web build
bun --filter @es-ts-example/web test
bun --filter @es-ts-example/web test:property
bun --filter @es-ts-example/web e2e
bun --filter @es-ts-example/web lint
bun --filter @es-ts-example/web mutation:dev
```

Web e2e tests are Bun HTTP tests under `test/e2e` that drive a real server, not
Effect BDD step definitions.

## Current-State Traps

- View unit tests assert whole rendered HTML strings, so any markup change
  updates a long expected string. That is deliberate: it is the only place the
  rendered contract is pinned.
- `src/mvc/jsx-runtime.ts` is a hand-written JSX runtime, not React. It escapes
  text, drops empty attributes, and sorts attributes; unfamiliar output usually
  comes from those rules rather than from a view bug.
