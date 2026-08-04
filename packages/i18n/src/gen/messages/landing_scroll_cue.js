/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Scroll_CueInputs */

const en_landing_scroll_cue = /** @type {(inputs: Landing_Scroll_CueInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Go to the next screen`)
};

const ko_landing_scroll_cue = /** @type {(inputs: Landing_Scroll_CueInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다음으로 내려가기`)
};

/**
* | output |
* | --- |
* | "Go to the next screen" |
*
* @param {Landing_Scroll_CueInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_scroll_cue = /** @type {((inputs?: Landing_Scroll_CueInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Scroll_CueInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_scroll_cue(inputs)
	return ko_landing_scroll_cue(inputs)
});