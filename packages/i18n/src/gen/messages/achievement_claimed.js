/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_ClaimedInputs */

const en_achievement_claimed = /** @type {(inputs: Achievement_ClaimedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Received`)
};

const ko_achievement_claimed = /** @type {(inputs: Achievement_ClaimedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`받았어요`)
};

/**
* | output |
* | --- |
* | "Received" |
*
* @param {Achievement_ClaimedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_claimed = /** @type {((inputs?: Achievement_ClaimedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_ClaimedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_claimed(inputs)
	return ko_achievement_claimed(inputs)
});