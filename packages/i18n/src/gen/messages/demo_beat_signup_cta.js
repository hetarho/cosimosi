/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Signup_CtaInputs */

const en_demo_beat_signup_cta = /** @type {(inputs: Demo_Beat_Signup_CtaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This universe was made up. Yours would start empty, and be written a day at a time.`)
};

const ko_demo_beat_signup_cta = /** @type {(inputs: Demo_Beat_Signup_CtaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 우주는 지어낸 것이에요. 당신의 우주는 비어 있는 채로 시작해서, 하루씩 쓰여갑니다.`)
};

/**
* | output |
* | --- |
* | "This universe was made up. Yours would start empty, and be written a day at a time." |
*
* @param {Demo_Beat_Signup_CtaInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_signup_cta = /** @type {((inputs?: Demo_Beat_Signup_CtaInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Signup_CtaInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_signup_cta(inputs)
	return ko_demo_beat_signup_cta(inputs)
});