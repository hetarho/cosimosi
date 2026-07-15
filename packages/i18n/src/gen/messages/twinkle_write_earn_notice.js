/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Write_Earn_NoticeInputs */

const en_twinkle_write_earn_notice = /** @type {(inputs: Twinkle_Write_Earn_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Writing your diary earned you stardust.`)
};

const ko_twinkle_write_earn_notice = /** @type {(inputs: Twinkle_Write_Earn_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기를 써서 별가루가 쌓였어요.`)
};

/**
* | output |
* | --- |
* | "Writing your diary earned you stardust." |
*
* @param {Twinkle_Write_Earn_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_write_earn_notice = /** @type {((inputs?: Twinkle_Write_Earn_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Write_Earn_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_write_earn_notice(inputs)
	return ko_twinkle_write_earn_notice(inputs)
});