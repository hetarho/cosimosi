/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_History_MoreInputs */

const en_me_stardust_history_more = /** @type {(inputs: Me_Stardust_History_MoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Show more`)
};

const ko_me_stardust_history_more = /** @type {(inputs: Me_Stardust_History_MoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`더 보기`)
};

/**
* | output |
* | --- |
* | "Show more" |
*
* @param {Me_Stardust_History_MoreInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_history_more = /** @type {((inputs?: Me_Stardust_History_MoreInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_History_MoreInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_history_more(inputs)
	return ko_me_stardust_history_more(inputs)
});