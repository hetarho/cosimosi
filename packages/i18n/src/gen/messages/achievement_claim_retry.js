/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Claim_RetryInputs */

const en_achievement_claim_retry = /** @type {(inputs: Achievement_Claim_RetryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Try receiving again`)
};

const ko_achievement_claim_retry = /** @type {(inputs: Achievement_Claim_RetryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`받기 다시 시도`)
};

/**
* | output |
* | --- |
* | "Try receiving again" |
*
* @param {Achievement_Claim_RetryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_claim_retry = /** @type {((inputs?: Achievement_Claim_RetryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Claim_RetryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_claim_retry(inputs)
	return ko_achievement_claim_retry(inputs)
});