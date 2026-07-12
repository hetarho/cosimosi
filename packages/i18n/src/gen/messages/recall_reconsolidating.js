/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_ReconsolidatingInputs */

const en_recall_reconsolidating = /** @type {(inputs: Recall_ReconsolidatingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recalling…`)
};

const ko_recall_reconsolidating = /** @type {(inputs: Recall_ReconsolidatingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`떠올리는 중…`)
};

/**
* | output |
* | --- |
* | "Recalling…" |
*
* @param {Recall_ReconsolidatingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_reconsolidating = /** @type {((inputs?: Recall_ReconsolidatingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_ReconsolidatingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_reconsolidating(inputs)
	return ko_recall_reconsolidating(inputs)
});