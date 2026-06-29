/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_Ping_ActionInputs */

const en_mobile_diagnostics_ping_action = /** @type {(inputs: Mobile_Diagnostics_Ping_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ping`)
};

const ko_mobile_diagnostics_ping_action = /** @type {(inputs: Mobile_Diagnostics_Ping_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ping`)
};

/**
* | output |
* | --- |
* | "Ping" |
*
* @param {Mobile_Diagnostics_Ping_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_ping_action = /** @type {((inputs?: Mobile_Diagnostics_Ping_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_Ping_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_ping_action(inputs)
	return ko_mobile_diagnostics_ping_action(inputs)
});