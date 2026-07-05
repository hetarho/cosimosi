/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Error_LaunchInputs */

const en_writing_flow_error_launch = /** @type {(inputs: Writing_Flow_Error_LaunchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The stars didn't rise. Nothing was saved — try again.`)
};

const ko_writing_flow_error_launch = /** @type {(inputs: Writing_Flow_Error_LaunchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별이 떠오르지 못했어요. 아무것도 저장되지 않았어요 — 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "The stars didn't rise. Nothing was saved — try again." |
*
* @param {Writing_Flow_Error_LaunchInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_error_launch = /** @type {((inputs?: Writing_Flow_Error_LaunchInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Error_LaunchInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_error_launch(inputs)
	return ko_writing_flow_error_launch(inputs)
});