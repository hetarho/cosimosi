/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_Recall_LabelInputs */

const en_twinkle_cost_recall_label = /** @type {(inputs: Twinkle_Cost_Recall_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust to restore stored words`)
};

const ko_twinkle_cost_recall_label = /** @type {(inputs: Twinkle_Cost_Recall_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`원문 되살리기에 드는 별가루`)
};

/**
* | output |
* | --- |
* | "Stardust to restore stored words" |
*
* @param {Twinkle_Cost_Recall_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_recall_label = /** @type {((inputs?: Twinkle_Cost_Recall_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_Recall_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_recall_label(inputs)
	return ko_twinkle_cost_recall_label(inputs)
});