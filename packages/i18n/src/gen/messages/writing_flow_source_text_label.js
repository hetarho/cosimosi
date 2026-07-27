/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Source_Text_LabelInputs */

const en_writing_flow_source_text_label = /** @type {(inputs: Writing_Flow_Source_Text_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Memory text`)
};

const ko_writing_flow_source_text_label = /** @type {(inputs: Writing_Flow_Source_Text_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억의 내용`)
};

/**
* | output |
* | --- |
* | "Memory text" |
*
* @param {Writing_Flow_Source_Text_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_source_text_label = /** @type {((inputs?: Writing_Flow_Source_Text_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Source_Text_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_source_text_label(inputs)
	return ko_writing_flow_source_text_label(inputs)
});