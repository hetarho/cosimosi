/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_Caption_FadingInputs */

const en_landing_play_caption_fading = /** @type {(inputs: Landing_Play_Caption_FadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unvisited, it dims. It never disappears — the sentence itself stays.`)
};

const ko_landing_play_caption_fading = /** @type {(inputs: Landing_Play_Caption_FadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`찾지 않는 동안 별은 조금씩 어두워져요. 그래도 사라지지는 않아요. 문장은 그대로 남아 있거든요.`)
};

/**
* | output |
* | --- |
* | "Unvisited, it dims. It never disappears — the sentence itself stays." |
*
* @param {Landing_Play_Caption_FadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_caption_fading = /** @type {((inputs?: Landing_Play_Caption_FadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_Caption_FadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_caption_fading(inputs)
	return ko_landing_play_caption_fading(inputs)
});