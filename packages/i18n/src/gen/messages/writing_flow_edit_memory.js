/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Edit_MemoryInputs */

const en_writing_flow_edit_memory = /** @type {(inputs: Writing_Flow_Edit_MemoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Refine this memory`)
};

const ko_writing_flow_edit_memory = /** @type {(inputs: Writing_Flow_Edit_MemoryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 기억 다듬기`)
};

/**
* | output |
* | --- |
* | "Refine this memory" |
*
* @param {Writing_Flow_Edit_MemoryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_edit_memory = /** @type {((inputs?: Writing_Flow_Edit_MemoryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Edit_MemoryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_edit_memory(inputs)
	return ko_writing_flow_edit_memory(inputs)
});