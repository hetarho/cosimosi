/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_Session_StatusInputs */

const en_mobile_diagnostics_session_status = /** @type {(inputs: Mobile_Diagnostics_Session_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Session status`)
};

const ko_mobile_diagnostics_session_status = /** @type {(inputs: Mobile_Diagnostics_Session_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`세션 상태`)
};

/**
* | output |
* | --- |
* | "Session status" |
*
* @param {Mobile_Diagnostics_Session_StatusInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_session_status = /** @type {((inputs?: Mobile_Diagnostics_Session_StatusInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_Session_StatusInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_session_status(inputs)
	return ko_mobile_diagnostics_session_status(inputs)
});