/**
 * @fileoverview Update handler for bot's own chat member status transitions.
 */
import { api, BotApiError } from "sdk";

import { BOT_API_BAD_REQUEST, BOT_API_FORBIDDEN } from "../lib/constants.js";

/**
 * Handles bot's own administrative permission updates across channels and groups,
 * leaving chats where required permissions are not granted.
 *
 * @param {Record<string, any>} chatMemberUpdated - The Telegram ChatMemberUpdated payload for the bot
 */
export default async function (chatMemberUpdated) {
  const { chat, new_chat_member } = chatMemberUpdated;

  // If the bot has already left or been removed from the chat, no action is needed
  if (
    new_chat_member.status === "left" || new_chat_member.status === "kicked"
  ) {
    return;
  }

  if (chat.type === "channel") {
    if (new_chat_member.can_restrict_members) return;
  } else if (chat.type === "supergroup") {
    if (new_chat_member.can_invite_users) {
      try {
        const { join_by_request } = await api.getChat({ chat_id: chat.id });
        if (join_by_request) return;
      } catch (error) {
        if (
          !(error instanceof BotApiError &&
            (error.code === BOT_API_BAD_REQUEST ||
              error.code === BOT_API_FORBIDDEN))
        ) {
          throw error;
        }
        return;
      }
    }
  } else {
    return;
  }

  try {
    await api.leaveChat({ chat_id: chat.id });
  } catch (error) {
    if (
      !(error instanceof BotApiError &&
        (error.code === BOT_API_BAD_REQUEST ||
          error.code === BOT_API_FORBIDDEN))
    ) {
      throw error;
    }
  }
}
