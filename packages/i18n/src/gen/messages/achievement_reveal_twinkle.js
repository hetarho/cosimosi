/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ amount: NonNullable<unknown>, total: NonNullable<unknown> }} Achievement_Reveal_TwinkleInputs */

const en_achievement_reveal_twinkle = /** @type {(inputs: Achievement_Reveal_TwinkleInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.amount} stardust. You now hold ${i?.total}.`)
};

const ko_achievement_reveal_twinkle = /** @type {(inputs: Achievement_Reveal_TwinkleInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`별가루 ${i?.amount}. 이제 ${i?.total} 가지고 있어요.`)
};

/**
* | output |
* | --- |
* | "{amount} stardust. You now hold {total}." |
*
* @param {Achievement_Reveal_TwinkleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_reveal_twinkle = /** @type {((inputs: Achievement_Reveal_TwinkleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Reveal_TwinkleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_reveal_twinkle(inputs)
	return ko_achievement_reveal_twinkle(inputs)
});