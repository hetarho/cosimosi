/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_Result_ReinforcedInputs */

const en_recall_result_reinforced = /** @type {(inputs: Recall_Result_ReinforcedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Clearer again — unchanged.`)
};

const ko_recall_result_reinforced = /** @type {(inputs: Recall_Result_ReinforcedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다시 또렷해졌어요. 그대로 남아 있어요.`)
};

/**
* | output |
* | --- |
* | "Clearer again — unchanged." |
*
* @param {Recall_Result_ReinforcedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_result_reinforced = /** @type {((inputs?: Recall_Result_ReinforcedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_Result_ReinforcedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_result_reinforced(inputs)
	return ko_recall_result_reinforced(inputs)
});