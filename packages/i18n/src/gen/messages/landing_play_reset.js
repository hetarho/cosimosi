/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_ResetInputs */

const en_landing_play_reset = /** @type {(inputs: Landing_Play_ResetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write another`)
};

const ko_landing_play_reset = /** @type {(inputs: Landing_Play_ResetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다른 문장 쓰기`)
};

/**
* | output |
* | --- |
* | "Write another" |
*
* @param {Landing_Play_ResetInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_reset = /** @type {((inputs?: Landing_Play_ResetInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_ResetInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_reset(inputs)
	return ko_landing_play_reset(inputs)
});