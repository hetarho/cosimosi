/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_LaunchingInputs */

const en_writing_flow_launching = /** @type {(inputs: Writing_Flow_LaunchingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sending…`)
};

const ko_writing_flow_launching = /** @type {(inputs: Writing_Flow_LaunchingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 띄우는 중`)
};

/**
* | output |
* | --- |
* | "Sending…" |
*
* @param {Writing_Flow_LaunchingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_launching = /** @type {((inputs?: Writing_Flow_LaunchingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_LaunchingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_launching(inputs)
	return ko_writing_flow_launching(inputs)
});