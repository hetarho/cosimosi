/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Cta_DemoInputs */

const en_landing_cta_demo = /** @type {(inputs: Landing_Cta_DemoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Preview the universe`)
};

const ko_landing_cta_demo = /** @type {(inputs: Landing_Cta_DemoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주 미리보기`)
};

/**
* | output |
* | --- |
* | "Preview the universe" |
*
* @param {Landing_Cta_DemoInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_cta_demo = /** @type {((inputs?: Landing_Cta_DemoInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Cta_DemoInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_cta_demo(inputs)
	return ko_landing_cta_demo(inputs)
});