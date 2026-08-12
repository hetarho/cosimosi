/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ small: NonNullable<unknown>, general: NonNullable<unknown> }} Me_Stardust_Spend_SplitInputs */

const en_me_stardust_spend_split = /** @type {(inputs: Me_Stardust_Spend_SplitInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Small stardust ${i?.small} · Stardust ${i?.general}`)
};

const ko_me_stardust_spend_split = /** @type {(inputs: Me_Stardust_Spend_SplitInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`작은 별가루 ${i?.small} · 별가루 ${i?.general}`)
};

/**
* | output |
* | --- |
* | "Small stardust {small} · Stardust {general}" |
*
* @param {Me_Stardust_Spend_SplitInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_spend_split = /** @type {((inputs: Me_Stardust_Spend_SplitInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Spend_SplitInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_spend_split(inputs)
	return ko_me_stardust_spend_split(inputs)
});