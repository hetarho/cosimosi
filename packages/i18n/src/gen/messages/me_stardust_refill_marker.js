/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Refill_MarkerInputs */

const en_me_stardust_refill_marker = /** @type {(inputs: Me_Stardust_Refill_MarkerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Today's small stardust filled up`)
};

const ko_me_stardust_refill_marker = /** @type {(inputs: Me_Stardust_Refill_MarkerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오늘의 작은 별가루가 채워졌어요`)
};

/**
* | output |
* | --- |
* | "Today's small stardust filled up" |
*
* @param {Me_Stardust_Refill_MarkerInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_refill_marker = /** @type {((inputs?: Me_Stardust_Refill_MarkerInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Refill_MarkerInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_refill_marker(inputs)
	return ko_me_stardust_refill_marker(inputs)
});