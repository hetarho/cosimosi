/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_Rewrite_PlaceholderInputs */

const en_recall_rewrite_placeholder = /** @type {(inputs: Recall_Rewrite_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`As you remember it…`)
};

const ko_recall_rewrite_placeholder = /** @type {(inputs: Recall_Rewrite_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억나는 대로…`)
};

/**
* | output |
* | --- |
* | "As you remember it…" |
*
* @param {Recall_Rewrite_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_rewrite_placeholder = /** @type {((inputs?: Recall_Rewrite_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_Rewrite_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_rewrite_placeholder(inputs)
	return ko_recall_rewrite_placeholder(inputs)
});