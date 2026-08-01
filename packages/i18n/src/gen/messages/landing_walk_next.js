/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_NextInputs */

const en_landing_walk_next = /** @type {(inputs: Landing_Walk_NextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Next`)
};

const ko_landing_walk_next = /** @type {(inputs: Landing_Walk_NextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다음`)
};

/**
* | output |
* | --- |
* | "Next" |
*
* @param {Landing_Walk_NextInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_next = /** @type {((inputs?: Landing_Walk_NextInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_NextInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_next(inputs)
	return ko_landing_walk_next(inputs)
});