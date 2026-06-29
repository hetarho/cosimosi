/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Shell_Open_DiagnosticsInputs */

const en_mobile_shell_open_diagnostics = /** @type {(inputs: Mobile_Shell_Open_DiagnosticsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Open diagnostics`)
};

const ko_mobile_shell_open_diagnostics = /** @type {(inputs: Mobile_Shell_Open_DiagnosticsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`진단 열기`)
};

/**
* | output |
* | --- |
* | "Open diagnostics" |
*
* @param {Mobile_Shell_Open_DiagnosticsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_shell_open_diagnostics = /** @type {((inputs?: Mobile_Shell_Open_DiagnosticsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Shell_Open_DiagnosticsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_shell_open_diagnostics(inputs)
	return ko_mobile_shell_open_diagnostics(inputs)
});