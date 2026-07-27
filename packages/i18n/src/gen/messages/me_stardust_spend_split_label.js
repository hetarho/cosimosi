/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Spend_Split_LabelInputs */

const en_me_stardust_spend_split_label = /** @type {(inputs: Me_Stardust_Spend_Split_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Drawn from`)
};

const ko_me_stardust_spend_split_label = /** @type {(inputs: Me_Stardust_Spend_Split_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`쓴 몫`)
};

/**
* | output |
* | --- |
* | "Drawn from" |
*
* @param {Me_Stardust_Spend_Split_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_spend_split_label = /** @type {((inputs?: Me_Stardust_Spend_Split_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Spend_Split_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_spend_split_label(inputs)
	return ko_me_stardust_spend_split_label(inputs)
});