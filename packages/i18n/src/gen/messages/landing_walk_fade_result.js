/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Fade_ResultInputs */

const en_landing_walk_fade_result = /** @type {(inputs: Landing_Walk_Fade_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unvisited stars grow dim, and their sentences start losing words. Nothing disappears, though.`)
};

const ko_landing_walk_fade_result = /** @type {(inputs: Landing_Walk_Fade_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`찾지 않은 별은 어두워지고, 문장은 단어를 잃기 시작해요. 그래도 사라지지는 않아요.`)
};

/**
* | output |
* | --- |
* | "Unvisited stars grow dim, and their sentences start losing words. Nothing disappears, though." |
*
* @param {Landing_Walk_Fade_ResultInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_fade_result = /** @type {((inputs?: Landing_Walk_Fade_ResultInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Fade_ResultInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_fade_result(inputs)
	return ko_landing_walk_fade_result(inputs)
});