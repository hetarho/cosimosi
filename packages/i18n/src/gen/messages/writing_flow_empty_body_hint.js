/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Empty_Body_HintInputs */

const en_writing_flow_empty_body_hint = /** @type {(inputs: Writing_Flow_Empty_Body_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write a little first.`)
};

const ko_writing_flow_empty_body_hint = /** @type {(inputs: Writing_Flow_Empty_Body_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`먼저 조금 적어 주세요.`)
};

/**
* | output |
* | --- |
* | "Write a little first." |
*
* @param {Writing_Flow_Empty_Body_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_empty_body_hint = /** @type {((inputs?: Writing_Flow_Empty_Body_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Empty_Body_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_empty_body_hint(inputs)
	return ko_writing_flow_empty_body_hint(inputs)
});