/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Timezone_UnavailableInputs */

const en_me_timezone_unavailable = /** @type {(inputs: Me_Timezone_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This device did not report a timezone.`)
};

const ko_me_timezone_unavailable = /** @type {(inputs: Me_Timezone_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 기기에서 시간대를 읽지 못했어요.`)
};

/**
* | output |
* | --- |
* | "This device did not report a timezone." |
*
* @param {Me_Timezone_UnavailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_timezone_unavailable = /** @type {((inputs?: Me_Timezone_UnavailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Timezone_UnavailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_timezone_unavailable(inputs)
	return ko_me_timezone_unavailable(inputs)
});