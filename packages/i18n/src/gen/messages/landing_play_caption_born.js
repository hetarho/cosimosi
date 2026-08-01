/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_Caption_BornInputs */

const en_landing_play_caption_born = /** @type {(inputs: Landing_Play_Caption_BornInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your sentence just became a star. Its color came from the feeling; its shape came from the words.`)
};

const ko_landing_play_caption_born = /** @type {(inputs: Landing_Play_Caption_BornInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`방금 쓴 문장이 별이 됐어요. 색은 고른 기분에서, 모양은 문장에서 왔어요.`)
};

/**
* | output |
* | --- |
* | "Your sentence just became a star. Its color came from the feeling; its shape came from the words." |
*
* @param {Landing_Play_Caption_BornInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_caption_born = /** @type {((inputs?: Landing_Play_Caption_BornInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_Caption_BornInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_caption_born(inputs)
	return ko_landing_play_caption_born(inputs)
});