/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Cta_Demo_NowInputs */

const en_landing_cta_demo_now = /** @type {(inputs: Landing_Cta_Demo_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Try the universe right now`)
};

const ko_landing_cta_demo_now = /** @type {(inputs: Landing_Cta_Demo_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 바로 우주 체험해보기`)
};

/**
* | output |
* | --- |
* | "Try the universe right now" |
*
* @param {Landing_Cta_Demo_NowInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_cta_demo_now = /** @type {((inputs?: Landing_Cta_Demo_NowInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Cta_Demo_NowInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_cta_demo_now(inputs)
	return ko_landing_cta_demo_now(inputs)
});