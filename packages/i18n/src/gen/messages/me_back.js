/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_BackInputs */

const en_me_back = /** @type {(inputs: Me_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to the universe`)
};

const ko_me_back = /** @type {(inputs: Me_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주로 돌아가기`)
};

/**
* | output |
* | --- |
* | "Back to the universe" |
*
* @param {Me_BackInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_back = /** @type {((inputs?: Me_BackInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_BackInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_back(inputs)
	return ko_me_back(inputs)
});