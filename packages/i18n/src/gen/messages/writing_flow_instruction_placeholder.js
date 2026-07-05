/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Instruction_PlaceholderInputs */

const en_writing_flow_instruction_placeholder = /** @type {(inputs: Writing_Flow_Instruction_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Say how to change it — e.g. merge the meeting and lunch into one star.`)
};

const ko_writing_flow_instruction_placeholder = /** @type {(inputs: Writing_Flow_Instruction_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`말로 고쳐요 — 예: 회의랑 점심을 한 별로 합쳐줘.`)
};

/**
* | output |
* | --- |
* | "Say how to change it — e.g. merge the meeting and lunch into one star." |
*
* @param {Writing_Flow_Instruction_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_instruction_placeholder = /** @type {((inputs?: Writing_Flow_Instruction_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Instruction_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_instruction_placeholder(inputs)
	return ko_writing_flow_instruction_placeholder(inputs)
});