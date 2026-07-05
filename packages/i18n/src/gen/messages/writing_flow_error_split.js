/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Error_SplitInputs */

const en_writing_flow_error_split = /** @type {(inputs: Writing_Flow_Error_SplitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It couldn't be split. Try again.`)
};

const ko_writing_flow_error_split = /** @type {(inputs: Writing_Flow_Error_SplitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`쪼개지 못했어요. 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "It couldn't be split. Try again." |
*
* @param {Writing_Flow_Error_SplitInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_error_split = /** @type {((inputs?: Writing_Flow_Error_SplitInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Error_SplitInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_error_split(inputs)
	return ko_writing_flow_error_split(inputs)
});