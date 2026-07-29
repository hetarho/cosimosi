/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown>, amount: NonNullable<unknown> }} Store_Shortfall_NoticeInputs */

const en_store_shortfall_notice = /** @type {(inputs: Store_Shortfall_NoticeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.name} needs ${i?.amount} more stardust.`)
};

const ko_store_shortfall_notice = /** @type {(inputs: Store_Shortfall_NoticeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.name}에 별가루가 ${i?.amount} 모자라요.`)
};

/**
* | output |
* | --- |
* | "{name} needs {amount} more stardust." |
*
* @param {Store_Shortfall_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_shortfall_notice = /** @type {((inputs: Store_Shortfall_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Shortfall_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_shortfall_notice(inputs)
	return ko_store_shortfall_notice(inputs)
});