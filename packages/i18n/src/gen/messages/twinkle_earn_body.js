/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Earn_BodyInputs */

const en_twinkle_earn_body = /** @type {(inputs: Twinkle_Earn_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This is how stardust gathers.`)
};

const ko_twinkle_earn_body = /** @type {(inputs: Twinkle_Earn_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루는 이렇게 모여요.`)
};

/**
* | output |
* | --- |
* | "This is how stardust gathers." |
*
* @param {Twinkle_Earn_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_earn_body = /** @type {((inputs?: Twinkle_Earn_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Earn_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_earn_body(inputs)
	return ko_twinkle_earn_body(inputs)
});