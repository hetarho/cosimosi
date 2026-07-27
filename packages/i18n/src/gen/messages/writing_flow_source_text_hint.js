/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Source_Text_HintInputs */

const en_writing_flow_source_text_hint = /** @type {(inputs: Writing_Flow_Source_Text_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The part of the diary this star came from, in your own words — edit it if you like.`)
};

const ko_writing_flow_source_text_hint = /** @type {(inputs: Writing_Flow_Source_Text_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기에서 이 별이 가져온 부분이에요. 당신이 쓴 말 그대로 담았어요 — 고치고 싶으면 고쳐요.`)
};

/**
* | output |
* | --- |
* | "The part of the diary this star came from, in your own words — edit it if you like." |
*
* @param {Writing_Flow_Source_Text_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_source_text_hint = /** @type {((inputs?: Writing_Flow_Source_Text_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Source_Text_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_source_text_hint(inputs)
	return ko_writing_flow_source_text_hint(inputs)
});