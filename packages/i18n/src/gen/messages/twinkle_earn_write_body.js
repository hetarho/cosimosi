/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Earn_Write_BodyInputs */

const en_twinkle_earn_write_body = /** @type {(inputs: Twinkle_Earn_Write_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`When a diary becomes a star, stardust gathers.`)
};

const ko_twinkle_earn_write_body = /** @type {(inputs: Twinkle_Earn_Write_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 하나가 별이 되면 별가루가 쌓여요.`)
};

/**
* | output |
* | --- |
* | "When a diary becomes a star, stardust gathers." |
*
* @param {Twinkle_Earn_Write_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_earn_write_body = /** @type {((inputs?: Twinkle_Earn_Write_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Earn_Write_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_earn_write_body(inputs)
	return ko_twinkle_earn_write_body(inputs)
});