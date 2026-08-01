/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_Caption_RecalledInputs */

const en_landing_play_caption_recalled = /** @type {(inputs: Landing_Play_Caption_RecalledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recalled, it takes its light back — and holds on a little more firmly.`)
};

const ko_landing_play_caption_recalled = /** @type {(inputs: Landing_Play_Caption_RecalledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다시 떠올린 별은 밝기를 되찾아요. 그리고 조금 더 단단해져요.`)
};

/**
* | output |
* | --- |
* | "Recalled, it takes its light back — and holds on a little more firmly." |
*
* @param {Landing_Play_Caption_RecalledInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_caption_recalled = /** @type {((inputs?: Landing_Play_Caption_RecalledInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_Caption_RecalledInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_caption_recalled(inputs)
	return ko_landing_play_caption_recalled(inputs)
});