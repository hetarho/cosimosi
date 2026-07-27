/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_Ornament_PurchaseInputs */

const en_me_stardust_reason_ornament_purchase = /** @type {(inputs: Me_Stardust_Reason_Ornament_PurchaseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`While decorating your universe`)
};

const ko_me_stardust_reason_ornament_purchase = /** @type {(inputs: Me_Stardust_Reason_Ornament_PurchaseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주를 꾸미며`)
};

/**
* | output |
* | --- |
* | "While decorating your universe" |
*
* @param {Me_Stardust_Reason_Ornament_PurchaseInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_ornament_purchase = /** @type {((inputs?: Me_Stardust_Reason_Ornament_PurchaseInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_Ornament_PurchaseInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_ornament_purchase(inputs)
	return ko_me_stardust_reason_ornament_purchase(inputs)
});