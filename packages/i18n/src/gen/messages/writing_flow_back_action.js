/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Back_ActionInputs */

const en_writing_flow_back_action = /** @type {(inputs: Writing_Flow_Back_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to writing`)
};

const ko_writing_flow_back_action = /** @type {(inputs: Writing_Flow_Back_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다시 쓰기`)
};

/**
* | output |
* | --- |
* | "Back to writing" |
*
* @param {Writing_Flow_Back_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_back_action = /** @type {((inputs?: Writing_Flow_Back_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Back_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_back_action(inputs)
	return ko_writing_flow_back_action(inputs)
});