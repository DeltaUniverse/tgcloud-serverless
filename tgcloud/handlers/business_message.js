/**
 * @fileoverview Update handler for incoming Telegram Business messages.
 */
import { api, BotApiError } from "sdk";

import { BOT_API_BAD_REQUEST, BOT_API_FORBIDDEN } from "../lib/constants.js";
import { forwardMessage } from "../lib/forward.js";

/**
 * Handles incoming business connection messages, forwards them to the business owner,
 * and removes the original message from the customer chat.
 *
 * @param {Record<string, any>} message - The Telegram Message payload from a business connection
 */
export default async function (message) {
  if (!message.from) return;

  let connection;
  try {
    connection = await api.getBusinessConnection({
      business_connection_id: message.business_connection_id,
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

  const { rights, user } = connection;
  if (!rights?.can_delete_all_messages || user.id === message.from.id) return;

  const initialKeyboard = message.reply_markup?.inline_keyboard ?? [];
  const userActionRow = [
    {
      text: "🍏",
      url: `https://t.me/@id${message.from.id}`,
      style: "primary",
    },
    {
      text: "🤖",
      url: `tg://openmessage?user_id=${message.from.id}`,
      style: "success",
    },
  ];

  const deliveryParameters = {
    chat_id: user.id,
    reply_markup: {
      inline_keyboard: [...initialKeyboard, userActionRow],
    },
  };

  const pendingSend = forwardMessage(message, deliveryParameters);
  if (!pendingSend) return;

  try {
    await pendingSend;
  } catch (error) {
    if (error instanceof BotApiError) return;
    throw error;
  }

  try {
    await api.deleteBusinessMessages({
      business_connection_id: message.business_connection_id,
      message_ids: [message.message_id],
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
