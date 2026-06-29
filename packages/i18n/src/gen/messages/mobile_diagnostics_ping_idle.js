/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_Ping_IdleInputs */

const en_mobile_diagnostics_ping_idle = /** @type {(inputs: Mobile_Diagnostics_Ping_IdleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not run`)
};

const ko_mobile_diagnostics_ping_idle = /** @type {(inputs: Mobile_Diagnostics_Ping_IdleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`실행 안 함`)
};

/**
* | output |
* | --- |
* | "Not run" |
*
* @param {Mobile_Diagnostics_Ping_IdleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_ping_idle = /** @type {((inputs?: Mobile_Diagnostics_Ping_IdleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_Ping_IdleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_ping_idle(inputs)
	return ko_mobile_diagnostics_ping_idle(inputs)
});