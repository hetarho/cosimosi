/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Error_ReviseInputs */

const en_writing_flow_error_revise = /** @type {(inputs: Writing_Flow_Error_ReviseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The rework didn't come through. Try again.`)
};

const ko_writing_flow_error_revise = /** @type {(inputs: Writing_Flow_Error_ReviseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`고쳐 쪼개지 못했어요. 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "The rework didn't come through. Try again." |
*
* @param {Writing_Flow_Error_ReviseInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_error_revise = /** @type {((inputs?: Writing_Flow_Error_ReviseInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Error_ReviseInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_error_revise(inputs)
	return ko_writing_flow_error_revise(inputs)
});