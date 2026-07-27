/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_UnknownInputs */

const en_me_stardust_reason_unknown = /** @type {(inputs: Me_Stardust_Reason_UnknownInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A record`)
};

const ko_me_stardust_reason_unknown = /** @type {(inputs: Me_Stardust_Reason_UnknownInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기록`)
};

/**
* | output |
* | --- |
* | "A record" |
*
* @param {Me_Stardust_Reason_UnknownInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_unknown = /** @type {((inputs?: Me_Stardust_Reason_UnknownInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_UnknownInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_unknown(inputs)
	return ko_me_stardust_reason_unknown(inputs)
});