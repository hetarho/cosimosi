/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_RecallInputs */

const en_me_stardust_reason_recall = /** @type {(inputs: Me_Stardust_Reason_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`While recalling`)
};

const ko_me_stardust_reason_recall = /** @type {(inputs: Me_Stardust_Reason_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회상하며`)
};

/**
* | output |
* | --- |
* | "While recalling" |
*
* @param {Me_Stardust_Reason_RecallInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_recall = /** @type {((inputs?: Me_Stardust_Reason_RecallInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_RecallInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_recall(inputs)
	return ko_me_stardust_reason_recall(inputs)
});