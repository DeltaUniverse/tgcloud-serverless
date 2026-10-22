/**
 * @fileoverview Update handler for incoming chat join requests.
 */
import { api, BotApiError, db } from "sdk";

import { BOT_API_BAD_REQUEST, BOT_API_FORBIDDEN } from "../lib/constants.js";
import { createDiceKeyboard } from "../lib/dice.js";
import { joinRequest } from "../schema.js";

/**
 * Handles incoming chat join requests by sending an interactive dice verification message
 * and recording the request in the database.
 *
 * @param {Record<string, any>} chatJoinRequest - The Telegram ChatJoinRequest payload
 */
export default async function (chatJoinRequest) {
  const { chat, user_chat_id } = chatJoinRequest;

  let diceMessage;

  try {
    diceMessage = await api.sendDice({
      chat_id: user_chat_id,
      emoji: "🎲",
      reply_markup: createDiceKeyboard(),
    });
  } catch (error) {
    if (
      error instanceof BotApiError &&
      (error.code === BOT_API_FORBIDDEN || error.code === BOT_API_BAD_REQUEST)
    ) {
      return;
    }
    throw error;
  }

  let inviteLink = chat.username ? `https://t.me/${chat.username}` : "";

  if (!inviteLink) {
    try {
      const chatDetails = await api.getChat({ chat_id: chat.id });
      if (chatDetails?.username) {
        inviteLink = `https://t.me/${chatDetails.username}`;
      } else if (chatDetails?.invite_link) {
        inviteLink = chatDetails.invite_link;
      }
    } catch {
      inviteLink = "";
    }
  }

  if (!inviteLink) {
    try {
      inviteLink = await api.exportChatInviteLink({ chat_id: chat.id });
    } catch {
      inviteLink = "";
    }
  }

  await db.insert(joinRequest).values({
    userId: user_chat_id,
    msgId: diceMessage.message_id,
    chatId: chat.id,
    inviteLink,
  }).run();
}
