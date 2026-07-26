/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ timezone: NonNullable<unknown> }} Me_Timezone_CurrentInputs */

const en_me_timezone_current = /** @type {(inputs: Me_Timezone_CurrentInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Current: ${i?.timezone}`)
};

const ko_me_timezone_current = /** @type {(inputs: Me_Timezone_CurrentInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`지금: ${i?.timezone}`)
};

/**
* | output |
* | --- |
* | "Current: {timezone}" |
*
* @param {Me_Timezone_CurrentInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_timezone_current = /** @type {((inputs: Me_Timezone_CurrentInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Timezone_CurrentInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_timezone_current(inputs)
	return ko_me_timezone_current(inputs)
});