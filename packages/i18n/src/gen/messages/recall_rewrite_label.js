/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_Rewrite_LabelInputs */

const en_recall_rewrite_label = /** @type {(inputs: Recall_Rewrite_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Rewrite`)
};

const ko_recall_rewrite_label = /** @type {(inputs: Recall_Rewrite_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다시 적기`)
};

/**
* | output |
* | --- |
* | "Rewrite" |
*
* @param {Recall_Rewrite_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_rewrite_label = /** @type {((inputs?: Recall_Rewrite_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_Rewrite_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_rewrite_label(inputs)
	return ko_recall_rewrite_label(inputs)
});