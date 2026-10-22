/**
 * @fileoverview Update handler for callback queries on dice join requests.
 */
import { api, BotApiError, db } from "sdk";
import { and, eq } from "sdk/db";

import { BOT_API_BAD_REQUEST } from "../lib/constants.js";
import { joinRequest } from "../schema.js";

/**
 * Handles callback queries for dice verification verification, approving or declining join requests.
 *
 * @param {Record<string, any>} callbackQuery - The Telegram CallbackQuery payload
 */
export default async function (callbackQuery) {
  try {
    await api.answerCallbackQuery({ callback_query_id: callbackQuery.id });
  } catch (error) {
    if (error instanceof BotApiError && error.code === BOT_API_BAD_REQUEST) {
      return;
    }
    throw error;
  }

  const { message, data, from } = callbackQuery;

  if (
    message?.chat?.type !== "private" ||
    !message?.dice ||
    !data ||
    !/^[1-6]$/.test(data)
  ) {
    return;
  }

  const whereClause = and(
    eq(joinRequest.userId, from.id),
    eq(joinRequest.msgId, message.message_id),
  );

  const record = await db.select().from(joinRequest).where(whereClause).get();

  if (!record) {
    try {
      await api.editMessageReplyMarkup({
        chat_id: message.chat.id,
        message_id: message.message_id,
      });
    } catch (error) {
      if (error instanceof BotApiError && error.code === BOT_API_BAD_REQUEST) {
        return;
      }
      throw error;
    }
    return;
  }

  const target = {
    chat_id: record.chatId,
    user_id: record.userId,
  };
  const isMatch = message.dice.value === Number(data);

  const resolveRequest =
    (isMatch
      ? api.approveChatJoinRequest(target)
      : api.declineChatJoinRequest(target)).catch((error) => {
        if (
          error instanceof BotApiError && error.code === BOT_API_BAD_REQUEST
        ) {
          return null;
        }
        throw error;
      });

  const editMarkup = api.editMessageReplyMarkup({
    chat_id: record.userId,
    message_id: record.msgId,
    reply_markup: record.inviteLink
      ? { inline_keyboard: [[{ text: "Open", url: record.inviteLink }]] }
      : undefined,
  }).catch((error) => {
    if (error instanceof BotApiError && error.code === BOT_API_BAD_REQUEST) {
      return null;
    }
    throw error;
  });

  const deleteRecord = db.delete(joinRequest).where(whereClause).run();

  await Promise.all([resolveRequest, editMarkup, deleteRecord]);
}
