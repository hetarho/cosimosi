/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Body_LabelInputs */

const en_writing_flow_body_label = /** @type {(inputs: Writing_Flow_Body_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Today`)
};

const ko_writing_flow_body_label = /** @type {(inputs: Writing_Flow_Body_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오늘`)
};

/**
* | output |
* | --- |
* | "Today" |
*
* @param {Writing_Flow_Body_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_body_label = /** @type {((inputs?: Writing_Flow_Body_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Body_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_body_label(inputs)
	return ko_writing_flow_body_label(inputs)
});