# Telegram Serverless Bot

A serverless Telegram bot built on Telegram's serverless isolate platform
(`tgcloud`), running update handlers in isolated V8 environments with persistent
SQLite storage and direct Bot API integration.

## Architecture & Layout

All deployable runtime code is located in the `tgcloud/` directory:

```
tgcloud/
├── handlers/               # Telegram Bot API update handlers (one-to-one mapping)
│   ├── business_message.js # Message routing for Telegram Business connections
│   ├── callback_query.js   # Interactive dice verification processing
│   ├── chat_join_request.js# Chat join request verification entry point
│   ├── chat_member.js      # Channel membership status automation
│   ├── message.js          # Start command and sudo evaluation sandbox
│   └── my_chat_member.js   # Chat permissions validation and auto-leave guard
├── lib/                    # Shared runtime utility modules
│   ├── constants.js        # Global configuration, credentials, and error codes
│   ├── dice.js             # Randomized Fisher-Yates inline keyboard generator
│   ├── eval.js             # Async code evaluator and object serializer
│   └── forward.js          # Typed message media forwarder
└── schema.js               # Database schema definitions (SQLite via tgcloud SDK)
```

## Features

### 1. Interactive Join Request Verification

- When a user requests to join a protected channel or supergroup
  (`chat_join_request`), the bot rolls a randomized Telegram dice (`🎲`) in a
  private chat with the user and displays a shuffled 2x3 inline keyboard
  (numbers 1–6).
- User selection is handled via `callback_query`. If the selected number matches
  the dice roll, the request is approved (`approveChatJoinRequest`); otherwise,
  it is declined (`declineChatJoinRequest`).
- If an invite link is present, the message markup is updated with an "Open"
  button; if not, the reply markup is cleanly removed. Database records are
  removed once resolved.

### 2. Business Connection Automation

- Processes messages received from Telegram Business connections
  (`business_message`).
- Forwards customer inquiries directly to the business account owner, attaching
  deep-link action buttons for cross-platform support (iOS and Android).
- Deletes the original message from the customer-facing chat to maintain clean
  communication channels.

### 3. Administrative Permission Guard

- Monitors the bot's own administrative rights transitions across channels and
  supergroups (`my_chat_member`).
- Automatically leaves chats (`leaveChat`) if mandatory administrative
  privileges are missing (such as `can_restrict_members` for channels or
  `can_invite_users` when join requests are required).

### 4. Interactive Sudo Console

- Authorizes configured sudo users (`SUDO_USER_ID`, `SUDO_CHAT_ID`) to execute
  JavaScript expressions ending with a semicolon (`;`).
- Executes code asynchronously with direct access to the platform SDK (`api`,
  `db`, `fetch`, `schema`).
- Handles complex object serialization, truncating lengthy outputs and uploading
  results as a text document if output exceeds message length limits.

## Database Schema

The database schema is defined in `tgcloud/schema.js` using the platform's query
builder DSL:

- **`join_request`**: Tracks pending join verification states.
  - `id`: Auto-incrementing primary key.
  - `user_id`: Target user identifier.
  - `msg_id`: Message ID of the verification dice message.
  - `chat_id`: Target channel or group chat ID.
  - `invite_link`: Resolved chat invite link or username URL.
  - Index: `user_msg_idx` indexed on `(user_id, msg_id)`.

## Development & Deployment

This project uses the `tgcloud` CLI for synchronization and deployment.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Deno](https://deno.com/) (v2+ for code formatting and linting)
- `tgcloud` CLI (`npx tgcloud`)

### Commands

Inspect differences between the local project and the cloud runtime:

```bash
npx tgcloud status
```

Deploy modified modules to the serverless platform:

```bash
npx tgcloud push
```

Apply database migrations:

```bash
npx tgcloud migrate
```

Verify webhook synchronization:

```bash
npx tgcloud webhook
```

### Code Quality

Run linting and formatting via Deno without configuration files:

```bash
deno lint tgcloud/
deno fmt tgcloud/
```

Verify JavaScript syntax:

```bash
node --check tgcloud/schema.js tgcloud/handlers/*.js tgcloud/lib/*.js
```

## References

- [tgcloud SDK Reference](docs/tgcloud-sdk.md)
- [Agent & Contributor Orientation](AGENTS.md)
- [Telegram Bot API Documentation](https://corefork.telegram.org/bots/api)
