/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_ClaimInputs */

const en_achievement_claim = /** @type {(inputs: Achievement_ClaimInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Receive`)
};

const ko_achievement_claim = /** @type {(inputs: Achievement_ClaimInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`받기`)
};

/**
* | output |
* | --- |
* | "Receive" |
*
* @param {Achievement_ClaimInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_claim = /** @type {((inputs?: Achievement_ClaimInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_ClaimInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_claim(inputs)
	return ko_achievement_claim(inputs)
});