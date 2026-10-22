/**
 * @fileoverview Update handler for incoming Telegram messages.
 */
import { api, BotApiError, db, fetch, InputFile } from "sdk";

import { BOT_USERNAME, SUDO_CHAT_ID, SUDO_USER_ID } from "../lib/config.js";
import {
  BOT_API_BAD_REQUEST,
  CAPTION_PREVIEW_LENGTH,
  MAX_MESSAGE_LENGTH,
} from "../lib/constants.js";
import { evaluateCode, serialize } from "../lib/eval.js";
import * as schema from "../schema.js";

/**
 * Handles incoming Telegram messages: start command, sudo authorization, and code evaluation.
 *
 * @param {Record<string, any>} message - The Telegram Message payload
 * @param {Record<string, any>} context - Platform context containing full Update
 */
export default async function (message, context) {
  if (message.chat.type === "private" && message.text === "/start") {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: "Add To:",
      entities: [{ offset: 0, length: 7, type: "bold" }],
      link_preview_options: {
        url: "https://http.dog/200.webp",
        show_above_text: true,
      },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Channel",
              url: `https://t.me/${BOT_USERNAME}?startchannel`,
            },
            {
              text: "Group",
              url: `https://t.me/${BOT_USERNAME}?startgroup`,
            },
          ],
          [
            {
              text: "Chat Automation",
              url: "tg://settings/edit",
            },
          ],
        ],
      },
    });

    return;
  }

  if (
    message.from?.id !== SUDO_USER_ID &&
    message.sender_chat?.id !== SUDO_CHAT_ID
  ) {
    return;
  }

  const rawInputText = message.caption ?? message.text ?? "";
  if (!rawInputText.endsWith(";")) return;

  const responseMessage = await api.sendMessage({
    chat_id: message.chat.id,
    message_thread_id: message.message_thread_id,
    direct_messages_topic_id: message.direct_messages_topic?.topic_id,
    text: "...",
    reply_parameters: {
      message_id: message.message_id,
      allow_sending_without_reply: true,
    },
  });

  let evaluationResult;

  try {
    const evaluationScope = {
      api,
      db,
      fetch,
      schema,
      message,
      context,
      responseMessage,
      // Backward compatibility aliases for interactive evaluation:
      msg: message,
      ctx: context,
      respond: responseMessage,
    };

    evaluationResult = await evaluateCode(rawInputText, evaluationScope);
    if (rawInputText.endsWith("return;")) return;
  } catch (evaluationError) {
    evaluationResult = String(evaluationError);
  }

  const serializedOutput = serialize(evaluationResult);

  if (serializedOutput.length > MAX_MESSAGE_LENGTH) {
    const outputFileDocument = new InputFile(
      new TextEncoder().encode(serializedOutput),
      "Output.TXT",
      { type: "text/plain" },
    );

    const preview = serializedOutput.slice(0, CAPTION_PREVIEW_LENGTH);
    const previewCaption = `${preview} ...`;

    try {
      await api.editMessageMedia({
        chat_id: responseMessage.chat.id,
        message_id: responseMessage.message_id,
        media: {
          type: "document",
          media: outputFileDocument,
          caption: previewCaption,
          caption_entities: [
            {
              offset: 0,
              length: previewCaption.length,
              type: "pre",
              language: "js",
            },
          ],
        },
      });
    } catch (mediaEditError) {
      if (
        mediaEditError instanceof BotApiError &&
        mediaEditError.code === BOT_API_BAD_REQUEST
      ) {
        // Fallback to sending as a new document if message editing is rejected
        await api.sendDocument({
          chat_id: message.chat.id,
          document: outputFileDocument,
          caption: previewCaption,
          caption_entities: [
            {
              offset: 0,
              length: previewCaption.length,
              type: "pre",
              language: "js",
            },
          ],
          reply_parameters: {
            message_id: message.message_id,
            allow_sending_without_reply: true,
          },
        });
        return;
      }
      throw mediaEditError;
    }

    return;
  }

  try {
    await api.editMessageText({
      chat_id: responseMessage.chat.id,
      message_id: responseMessage.message_id,
      text: serializedOutput,
      entities: [
        {
          offset: 0,
          length: serializedOutput.length,
          type: "pre",
          language: "js",
        },
      ],
    });
  } catch (apiError) {
    if (
      apiError instanceof BotApiError &&
      apiError.code === BOT_API_BAD_REQUEST
    ) {
      return;
    }
    throw apiError;
  }
}
