/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_Shortfall_NoticeInputs */

const en_twinkle_cost_shortfall_notice = /** @type {(inputs: Twinkle_Cost_Shortfall_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You are a little short.`)
};

const ko_twinkle_cost_shortfall_notice = /** @type {(inputs: Twinkle_Cost_Shortfall_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루가 조금 모자라요.`)
};

/**
* | output |
* | --- |
* | "You are a little short." |
*
* @param {Twinkle_Cost_Shortfall_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_shortfall_notice = /** @type {((inputs?: Twinkle_Cost_Shortfall_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_Shortfall_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_shortfall_notice(inputs)
	return ko_twinkle_cost_shortfall_notice(inputs)
});