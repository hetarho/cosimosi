/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Memory_Restore_Cost_LabelInputs */

const en_memory_restore_cost_label = /** @type {(inputs: Memory_Restore_Cost_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust to restore stored words`)
};

const ko_memory_restore_cost_label = /** @type {(inputs: Memory_Restore_Cost_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`원문 되살리기에 필요한 별가루`)
};

/**
* | output |
* | --- |
* | "Stardust to restore stored words" |
*
* @param {Memory_Restore_Cost_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const memory_restore_cost_label = /** @type {((inputs?: Memory_Restore_Cost_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Memory_Restore_Cost_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_memory_restore_cost_label(inputs)
	return ko_memory_restore_cost_label(inputs)
});