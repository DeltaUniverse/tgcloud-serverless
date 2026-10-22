# AGENTS.md

Orientation for AI coding assistants (and humans) working in this project. This
file is auto-loaded by Claude Code, Cursor, and similar tools — keep it short
and true.

- Project SDK reference (db, Bot API, fetch):
  [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md).
- Telegram Bot API specification (methods, types, updates):
  [corefork.telegram.org/bots/api](https://corefork.telegram.org/bots/api)
  (canonical: [core.telegram.org/bots/api](https://core.telegram.org/bots/api)).

## What this project is

A **Telegram Mini App bot** running on Telegram's serverless platform. You write
JavaScript modules (database schema, shared library code, update handlers); the
platform runs them in a V8 isolate. The `tgcloud` CLI syncs this local project
with the bot's cloud environment — think `wrangler`/`vercel` + `drizzle-kit`.

There is no server to run locally and no `node_modules` to import from at
runtime: the only things available inside a module are the platform SDK and
other modules in this project.

## Layout

Everything the platform runs lives in the **`tgcloud/`** folder. The rest of the
project root is yours (a mini-app front-end, config, docs).

| Path                 | What it is                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `tgcloud/schema.js`  | Database schema — tables as **named exports**. One file.                                                                                 |
| `tgcloud/lib/`       | Shared modules. Subdirectories allowed (`lib/internal/util.js`).                                                                         |
| `tgcloud/handlers/`  | Update handlers, **one level only**. Names match Telegram Bot API `Update` fields (`message`, `callback_query`, `chat_join_request`, …). |
| `tgcloud/endpoints/` | Functions the Mini App calls (`POST /api/<name>`), **one level only**.                                                                   |
| `tgcloud.jsonc`      | Project config. Its `"static"` block names the build folder hosted as the Mini App.                                                      |
| `docs/`              | Reference docs (this project's, for you). Not deployed.                                                                                  |
| `.tgcloud/`          | CLI state (credentials, snapshot, cached layout). **Never edit or read from here** — it's gitignored machine state.                      |

Only `.js` files under `tgcloud/` (`schema.js`, `lib/`, `handlers/`,
`endpoints/`) are deployed as code, plus — when `tgcloud.jsonc` names one — the
front-end's build folder as the Mini App's static files. Everything else
(Markdown, config, `.tgcloud/`, the front-end's sources) is local-only. Module
names are relative to `tgcloud/`: the file `tgcloud/handlers/message.js` is the
module `handlers/message`.

## Mini App front-end

If the project root holds a front-end (Vite, React, Vue, …), its **build
output** is deployed next to the bot and served as the Mini App at
`https://app<app_id>.tgcloud.ai/` — `push` prints the exact URL.

- `tgcloud.jsonc` → `{ "static": { "source": "dist" } }` — `source` names the
  build folder; the other keys of the `static` object are the serving config
  (e.g. `"spa": true` serves `index.html` for unknown extension-less paths —
  client-side routing; `immutable`, `headers`, `redirects`). `tgcloud init`
  writes the file when it recognizes the front-end; after that it's a normal
  project file. JSON with comments and trailing commas (a project may use a
  strict-JSON `tgcloud.json` instead — never both). `"static": "dist"` is
  accepted as a shorthand for `{ "source": "dist" }`. `"static": false` removes
  the deployed site on the next push.
- **Build before you push.** `push` uploads the folder as it is on disk; it
  never runs the build. `npm run deploy` (build + push) is the safe default.
- The front-end is ordinary browser code with npm packages — none of the
  `tgcloud/` module rules apply to it, and `tgcloud/` modules can't import it.
  It talks to the bot's code only through **endpoints** (below).
- The site is served from the host root, so the bundler's default `base` (`/`)
  is right. Don't add `X-Frame-Options` or a restrictive `frame-ancestors`:
  Telegram Web opens Mini Apps in an iframe.

## Endpoints — the Mini App's server side

`tgcloud/endpoints/<name>.js` is called by the Mini App as `POST /api/<name>` on
the same host as the static site. Use it for anything the front-end can't do
itself: the database, the Bot API, secrets.

- `export default async function (input, ctx)` — `input` is the JSON body (an
  object); the return value goes back as JSON.
- `ctx.initData` is the Mini App's init data **verified by the platform** (same
  shape as `Telegram.WebApp.initDataUnsafe`): `ctx.initData.user` is the caller.
  There is no `ctx.user`. Invalid init data → `401`, the endpoint never runs.
- Refuse with
  `throw new EndpointError('Out of stock', { code: 'OUT_OF_STOCK' })`
  (`import { EndpointError } from 'sdk'`) → `400`, the Mini App gets
  `description` + `parameters`. Any other exception → generic `500`; never rely
  on its message reaching the client.
- Front-end call:
  `Telegram.WebApp.Serverless.call('<name>', input, (err, result) => …)` from
  the official `telegram-web-app.js` — it sends the init data; `err` has
  `message` (description), `type` (`'ENDPOINT_ERROR'` for your `EndpointError`)
  and `parameters`. Don't hand-roll `fetch` + init data.
- Names: letters, digits, `_`, not starting with a digit (`getProfile`).
  Scaffold with `npx tgcloud add endpoints/<name>`; test with
  `npx tgcloud run endpoints/<name> '{}' --ctx '{ initData: { user: { id: 1 } } }'`.

## Module system — the rules that bite

- **Import project modules by relative path WITH the `.js` extension; import the
  SDK by name.** (from `tgcloud/handlers/message.js`:)
  - ✅ `import { users } from '../schema.js'`
  - ✅ `import { addItem } from '../lib/cart.js'`
  - ✅ `import { db, api, fetch } from 'sdk'` /
    `import { eq, sql } from 'sdk/db'`
  - ❌ `import { users } from '../schema'` → a relative import must end in `.js`
  - ❌ `import x from '../../src/x.js'` → nothing outside `tgcloud/` is
    reachable
  - A module's _name_ is its path inside `tgcloud/` without `.js` (`lib/cart`);
    `tgcloud run` takes it, and `from 'lib/cart'` (no extension) also resolves —
    but write relative imports.
- **No filesystem, no npm packages** at runtime. Only `sdk` (and its submodules
  like `sdk/db`) and your own project modules exist.
- A handler module's `export default` is what the platform invokes, with the
  update's **payload** as the first argument — for `handlers/message` that's the
  `Message` (i.e. `update.message`), for `handlers/callback_query` the
  `CallbackQuery`, for `handlers/chat_join_request` the `ChatJoinRequest`, and
  so on. Names match fields of Telegram's
  [`Update`](https://corefork.telegram.org/bots/api#update) object. The full
  `Update` (with `update_id`) is on the second argument: `ctx.update`. An
  endpoint's `export default` gets `(input, ctx)` — see _Endpoints_ above.

## Platform SDK (`import … from 'sdk'`)

- **`db`** — the database (query builder + schema DSL). Full API:
  [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md).
- **`api`** — the Telegram Bot API client. Call any method as
  `api.<methodName>(params)`
  ([Bot API Reference](https://corefork.telegram.org/bots/api)).
  - **Methods & Params**: camelCase method name (`api.sendMessage`, `api.getMe`,
    `api.editMessageText`), passing a single object with snake_case parameters
    matching the Bot API spec (`chat_id`, `reply_parameters`, `reply_markup`,
    etc.).
  - **Envelope unwrapped**: returns the `result` directly on `{ ok: true }` — no
    `.ok`/`.result` wrapper.
  - **Throws `BotApiError`**: on `{ ok: false }`
    (`import { BotApiError } from 'sdk'`). Contains `.code` (HTTP/Telegram
    `error_code`, e.g. 400, 403, 429), `.description`, `.method`, and
    `.parameters`
    ([ResponseParameters](https://corefork.telegram.org/bots/api#responseparameters),
    e.g. `retry_after`, `migrate_to_chat_id`).
  - **Files**: `import { InputFile } from 'sdk'`. Pass
    `new InputFile(bytes, filename, { type })` at any depth in params.
    Downloads: `await api.getFileContent(file_id)` (Uint8Array) or
    `await api.getFileStream(file_id)` by `file_id` only (up to 20 MB).
- **`fetch`** — outbound HTTP, web-`fetch`-like (`res.status/ok`, `res.json()`,
  `res.text()`, streaming via `for await`, redirects followed).
- **`EndpointError`** — the one way an endpoint refuses a call (see
  _Endpoints_).

## Database — the rules that bite

Full API in [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md). The non-obvious parts:

- **Every DB call is async — always `await`.** `.all()`, `.get()`, `.values()`,
  `.run()`, `db.$count()` and the raw `db.run/all/get` all return Promises.
- **No foreign keys.** `.references()` and `foreignKey()` **throw at
  declaration** — the runtime runs with FKs off, so they'd be silently inert.
  Enforce integrity in application code (delete children before parents, etc.).
- **Drops happen only via `.deprecated('reason')`** on a column/table/index.
  Deleting the declaration does _not_ drop anything.
- **Type changes aren't automatic** — do them by hand with `db.run(...)`.

## Deploy & migrate workflow

**Deploying never touches the database.** Schema sync is a separate, explicit
step.

The CLI is a local dev-dependency, so run it with `npx tgcloud <command>` (or
use the `npm run` scripts in package.json — e.g. `npm run deploy`):

```
npx tgcloud status     # what changed locally vs the cloud
npx tgcloud push       # deploy modules (and the static build) to the cloud
npx tgcloud migrate    # apply tgcloud/schema.js changes to the database (interactive)
npx tgcloud run <module> [args]   # execute a handler or endpoint server-side
npx tgcloud pull       # bring the local project in line with the cloud
npx tgcloud login      # link this project to a bot
npx tgcloud webhook    # show the bot's webhook and whether it matches your handlers
```

After you change `tgcloud/schema.js`, `push` reports what the DB _would_ change
but applies nothing — run `npx tgcloud migrate` to actually apply it.

The platform manages the bot's webhook for you, derived from your deployed
`handlers/*`, and refreshes it on `push`. If it ever drifts — e.g. someone
called `setWebhook` with the raw bot token — `npx tgcloud webhook` shows the
mismatch and `npx tgcloud webhook sync` repairs it.
