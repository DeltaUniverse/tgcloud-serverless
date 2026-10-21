/**
 * @fileoverview Comprehensive media forwarder for Telegram Business messages.
 * Supports all Telegram Bot API media types based on corefork.telegram.org/bots/api specifications.
 */
import { api } from "sdk";

/**
 * Forwards any supported Telegram message media to the target chat with the specified delivery parameters.
 *
 * @param {Record<string, any>} message - The incoming Telegram Message object
 * @param {{ chat_id: number, reply_markup?: any }} deliveryParameters - Base delivery parameters
 * @returns {Promise<any> | null} Bot API call promise or null if unsupported
 */
export function forwardMessage(message, deliveryParameters) {
  const { chat_id, reply_markup } = deliveryParameters;

  if (message.text) {
    return api.sendMessage({
      chat_id,
      text: message.text,
      entities: message.entities,
      reply_markup,
    });
  }

  const mediaParams = {
    chat_id,
    caption: message.caption,
    caption_entities: message.caption_entities,
    reply_markup,
  };

  if (message.sticker?.file_id) {
    return api.sendSticker({
      chat_id,
      sticker: message.sticker.file_id,
      emoji: message.sticker.emoji,
      reply_markup,
    });
  }

  if (message.voice?.file_id) {
    return api.sendVoice({
      ...mediaParams,
      voice: message.voice.file_id,
      duration: message.voice.duration,
    });
  }

  if (message.video_note?.file_id) {
    return api.sendVideoNote({
      chat_id,
      video_note: message.video_note.file_id,
      duration: message.video_note.duration,
      length: message.video_note.length,
      reply_markup,
    });
  }

  if (Array.isArray(message.photo) && message.photo.length > 0) {
    const photo = message.photo.at(-1);
    if (photo?.file_id) {
      return api.sendPhoto({
        ...mediaParams,
        photo: photo.file_id,
        show_caption_above_media: message.show_caption_above_media,
        has_spoiler: message.has_media_spoiler,
      });
    }
  }

  if (message.video?.file_id) {
    return api.sendVideo({
      ...mediaParams,
      video: message.video.file_id,
      duration: message.video.duration,
      width: message.video.width,
      height: message.video.height,
      supports_streaming: message.video.supports_streaming,
      show_caption_above_media: message.show_caption_above_media,
      has_spoiler: message.has_media_spoiler,
    });
  }

  if (message.animation?.file_id) {
    return api.sendAnimation({
      ...mediaParams,
      animation: message.animation.file_id,
      duration: message.animation.duration,
      width: message.animation.width,
      height: message.animation.height,
      show_caption_above_media: message.show_caption_above_media,
      has_spoiler: message.has_media_spoiler,
    });
  }

  if (message.document?.file_id) {
    return api.sendDocument({
      ...mediaParams,
      document: message.document.file_id,
    });
  }

  if (message.audio?.file_id) {
    return api.sendAudio({
      ...mediaParams,
      audio: message.audio.file_id,
      duration: message.audio.duration,
      performer: message.audio.performer,
      title: message.audio.title,
    });
  }

  if (message.contact?.phone_number) {
    return api.sendContact({
      chat_id,
      phone_number: message.contact.phone_number,
      first_name: message.contact.first_name || "",
      last_name: message.contact.last_name,
      vcard: message.contact.vcard,
      reply_markup,
    });
  }

  const location = message.venue?.location ?? message.location;

  if (message.venue && location) {
    return api.sendVenue({
      chat_id,
      latitude: location.latitude,
      longitude: location.longitude,
      title: message.venue.title || "",
      address: message.venue.address || "",
      foursquare_id: message.venue.foursquare_id,
      foursquare_type: message.venue.foursquare_type,
      google_place_id: message.venue.google_place_id,
      google_place_type: message.venue.google_place_type,
      reply_markup,
    });
  }

  if (location?.latitude !== undefined && location?.longitude !== undefined) {
    return api.sendLocation({
      chat_id,
      latitude: location.latitude,
      longitude: location.longitude,
      horizontal_accuracy: message.location?.horizontal_accuracy,
      live_period: message.location?.live_period,
      heading: message.location?.heading,
      proximity_alert_radius: message.location?.proximity_alert_radius,
      reply_markup,
    });
  }

  if (message.poll) {
    return api.sendPoll({
      chat_id,
      question: message.poll.question,
      question_entities: message.poll.question_entities,
      options: message.poll.options.map((option) => ({
        text: option.text,
        text_entities: option.text_entities,
      })),
      is_anonymous: message.poll.is_anonymous,
      type: message.poll.type,
      allows_multiple_answers: message.poll.allows_multiple_answers,
      correct_option_id: message.poll.correct_option_id,
      explanation: message.poll.explanation,
      explanation_entities: message.poll.explanation_entities,
      open_period: message.poll.open_period,
      close_date: message.poll.close_date,
      is_closed: message.poll.is_closed,
      reply_markup,
    });
  }

  if (message.dice) {
    return api.sendDice({
      chat_id,
      emoji: message.dice.emoji,
      reply_markup,
    });
  }

  if (message.paid_media) {
    return api.sendPaidMedia({
      chat_id,
      star_count: message.paid_media.star_count,
      media: message.paid_media.paid_media,
      caption: message.caption,
      caption_entities: message.caption_entities,
      show_caption_above_media: message.show_caption_above_media,
      reply_markup,
    });
  }

  if (message.game) {
    return api.sendGame({
      chat_id,
      game_short_name: message.game.title,
      reply_markup,
    });
  }

  return null;
}
