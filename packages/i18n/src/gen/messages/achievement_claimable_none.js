/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Claimable_NoneInputs */

const en_achievement_claimable_none = /** @type {(inputs: Achievement_Claimable_NoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Nothing waiting to be received.`)
};

const ko_achievement_claimable_none = /** @type {(inputs: Achievement_Claimable_NoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 받을 보상은 없어요.`)
};

/**
* | output |
* | --- |
* | "Nothing waiting to be received." |
*
* @param {Achievement_Claimable_NoneInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_claimable_none = /** @type {((inputs?: Achievement_Claimable_NoneInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Claimable_NoneInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_claimable_none(inputs)
	return ko_achievement_claimable_none(inputs)
});