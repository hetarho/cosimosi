/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Body_PlaceholderInputs */

const en_writing_flow_body_placeholder = /** @type {(inputs: Writing_Flow_Body_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write down what stayed with you today.`)
};

const ko_writing_flow_body_placeholder = /** @type {(inputs: Writing_Flow_Body_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오늘 마음에 남은 것을 적어요.`)
};

/**
* | output |
* | --- |
* | "Write down what stayed with you today." |
*
* @param {Writing_Flow_Body_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_body_placeholder = /** @type {((inputs?: Writing_Flow_Body_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Body_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_body_placeholder(inputs)
	return ko_writing_flow_body_placeholder(inputs)
});