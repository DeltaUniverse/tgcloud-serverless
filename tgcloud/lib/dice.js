/**
 * @fileoverview Dice inline keyboard generator with Fisher-Yates shuffle.
 */

/**
 * Creates a randomized 2x3 inline keyboard containing values 1 through 6.
 *
 * @returns {{ inline_keyboard: Array<Array<{ text: string, callback_data: string }>> }}
 */
export function createDiceKeyboard() {
  const diceButtons = Array.from({ length: 6 }, (_, index) => {
    const value = String(index + 1);
    return { text: value, callback_data: value };
  });

  for (let index = diceButtons.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [diceButtons[index], diceButtons[randomIndex]] = [
      diceButtons[randomIndex],
      diceButtons[index],
    ];
  }

  return {
    inline_keyboard: [
      diceButtons.slice(0, 2),
      diceButtons.slice(2, 4),
      diceButtons.slice(4, 6),
    ],
  };
}
