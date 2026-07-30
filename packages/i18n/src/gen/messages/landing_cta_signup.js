/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Cta_SignupInputs */

const en_landing_cta_signup = /** @type {(inputs: Landing_Cta_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Start my own`)
};

const ko_landing_cta_signup = /** @type {(inputs: Landing_Cta_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`내 우주 시작하기`)
};

/**
* | output |
* | --- |
* | "Start my own" |
*
* @param {Landing_Cta_SignupInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_cta_signup = /** @type {((inputs?: Landing_Cta_SignupInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Cta_SignupInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_cta_signup(inputs)
	return ko_landing_cta_signup(inputs)
});