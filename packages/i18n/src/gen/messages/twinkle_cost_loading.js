/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_LoadingInputs */

const en_twinkle_cost_loading = /** @type {(inputs: Twinkle_Cost_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Counting the cost…`)
};

const ko_twinkle_cost_loading = /** @type {(inputs: Twinkle_Cost_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`값을 헤아리는 중…`)
};

/**
* | output |
* | --- |
* | "Counting the cost…" |
*
* @param {Twinkle_Cost_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_loading = /** @type {((inputs?: Twinkle_Cost_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_loading(inputs)
	return ko_twinkle_cost_loading(inputs)
});