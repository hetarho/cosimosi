/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_Result_ReconsolidatedInputs */

const en_recall_result_reconsolidated = /** @type {(inputs: Recall_Result_ReconsolidatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It is kept this way now.`)
};

const ko_recall_result_reconsolidated = /** @type {(inputs: Recall_Result_ReconsolidatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이렇게 다시 기억으로 남았어요.`)
};

/**
* | output |
* | --- |
* | "It is kept this way now." |
*
* @param {Recall_Result_ReconsolidatedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_result_reconsolidated = /** @type {((inputs?: Recall_Result_ReconsolidatedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_Result_ReconsolidatedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_result_reconsolidated(inputs)
	return ko_recall_result_reconsolidated(inputs)
});