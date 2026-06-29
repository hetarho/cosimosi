/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_Transport_PingInputs */

const en_mobile_diagnostics_transport_ping = /** @type {(inputs: Mobile_Diagnostics_Transport_PingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Transport ping`)
};

const ko_mobile_diagnostics_transport_ping = /** @type {(inputs: Mobile_Diagnostics_Transport_PingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Transport ping`)
};

/**
* | output |
* | --- |
* | "Transport ping" |
*
* @param {Mobile_Diagnostics_Transport_PingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_transport_ping = /** @type {((inputs?: Mobile_Diagnostics_Transport_PingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_Transport_PingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_transport_ping(inputs)
	return ko_mobile_diagnostics_transport_ping(inputs)
});