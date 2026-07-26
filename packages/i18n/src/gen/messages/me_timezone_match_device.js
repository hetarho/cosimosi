/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Timezone_Match_DeviceInputs */

const en_me_timezone_match_device = /** @type {(inputs: Me_Timezone_Match_DeviceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Match this device`)
};

const ko_me_timezone_match_device = /** @type {(inputs: Me_Timezone_Match_DeviceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 기기에 맞추기`)
};

/**
* | output |
* | --- |
* | "Match this device" |
*
* @param {Me_Timezone_Match_DeviceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_timezone_match_device = /** @type {((inputs?: Me_Timezone_Match_DeviceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Timezone_Match_DeviceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_timezone_match_device(inputs)
	return ko_me_timezone_match_device(inputs)
});