/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Weekday_SatInputs */

const en_calendar_weekday_sat = /** @type {(inputs: Calendar_Weekday_SatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sat`)
};

const ko_calendar_weekday_sat = /** @type {(inputs: Calendar_Weekday_SatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`토`)
};

/**
* | output |
* | --- |
* | "Sat" |
*
* @param {Calendar_Weekday_SatInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_weekday_sat = /** @type {((inputs?: Calendar_Weekday_SatInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Weekday_SatInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_weekday_sat(inputs)
	return ko_calendar_weekday_sat(inputs)
});