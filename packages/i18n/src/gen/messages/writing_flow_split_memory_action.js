/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Split_Memory_ActionInputs */

const en_writing_flow_split_memory_action = /** @type {(inputs: Writing_Flow_Split_Memory_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Split in two`)
};

const ko_writing_flow_split_memory_action = /** @type {(inputs: Writing_Flow_Split_Memory_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`둘로 나누기`)
};

/**
* | output |
* | --- |
* | "Split in two" |
*
* @param {Writing_Flow_Split_Memory_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_split_memory_action = /** @type {((inputs?: Writing_Flow_Split_Memory_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Split_Memory_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_split_memory_action(inputs)
	return ko_writing_flow_split_memory_action(inputs)
});