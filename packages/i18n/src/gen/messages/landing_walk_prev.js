/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_PrevInputs */

const en_landing_walk_prev = /** @type {(inputs: Landing_Walk_PrevInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back`)
};

const ko_landing_walk_prev = /** @type {(inputs: Landing_Walk_PrevInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이전`)
};

/**
* | output |
* | --- |
* | "Back" |
*
* @param {Landing_Walk_PrevInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_prev = /** @type {((inputs?: Landing_Walk_PrevInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_PrevInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_prev(inputs)
	return ko_landing_walk_prev(inputs)
});