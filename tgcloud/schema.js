/**
 * @fileoverview Database schema definitions for the tgcloud bot platform.
 */
import { index, integer, table, text } from "sdk/db";

/**
 * Join request tracking table for dice verification verification flow.
 */
export const joinRequest = table(
  "join_request",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    msgId: integer("msg_id").notNull(),
    chatId: integer("chat_id").notNull(),
    inviteLink: text("invite_link").notNull(),
  },
  (columns) => ({
    userMsgIdx: index("user_msg_idx").on(columns.userId, columns.msgId),
  }),
);
