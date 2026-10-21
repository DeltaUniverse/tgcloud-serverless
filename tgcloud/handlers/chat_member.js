/**
 * @fileoverview Update handler for chat member status transitions.
 */
import { api, BotApiError } from "sdk";

import { BOT_API_BAD_REQUEST, BOT_API_FORBIDDEN } from "../lib/constants.js";

/**
 * Handles chat member status updates, unbanning newly joined members in channels.
 *
 * @param {Record<string, any>} chatMemberUpdated - The Telegram ChatMemberUpdated payload
 */
export default async function (chatMemberUpdated) {
  const { chat, new_chat_member } = chatMemberUpdated;
  if (chat.type !== "channel" || new_chat_member.status !== "member") return;

  try {
    await api.unbanChatMember({
      chat_id: chat.id,
      user_id: new_chat_member.user.id,
    });
  } catch (error) {
    if (
      error instanceof BotApiError &&
      (error.code === BOT_API_BAD_REQUEST || error.code === BOT_API_FORBIDDEN)
    ) {
      return;
    }
    throw error;
  }
}
