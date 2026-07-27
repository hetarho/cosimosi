/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_Achievement_ClaimInputs */

const en_me_stardust_reason_achievement_claim = /** @type {(inputs: Me_Stardust_Reason_Achievement_ClaimInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`For an achievement`)
};

const ko_me_stardust_reason_achievement_claim = /** @type {(inputs: Me_Stardust_Reason_Achievement_ClaimInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`업적을 받아서`)
};

/**
* | output |
* | --- |
* | "For an achievement" |
*
* @param {Me_Stardust_Reason_Achievement_ClaimInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_achievement_claim = /** @type {((inputs?: Me_Stardust_Reason_Achievement_ClaimInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_Achievement_ClaimInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_achievement_claim(inputs)
	return ko_me_stardust_reason_achievement_claim(inputs)
});