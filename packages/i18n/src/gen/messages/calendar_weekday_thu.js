/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Weekday_ThuInputs */

const en_calendar_weekday_thu = /** @type {(inputs: Calendar_Weekday_ThuInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Thu`)
};

const ko_calendar_weekday_thu = /** @type {(inputs: Calendar_Weekday_ThuInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`목`)
};

/**
* | output |
* | --- |
* | "Thu" |
*
* @param {Calendar_Weekday_ThuInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_weekday_thu = /** @type {((inputs?: Calendar_Weekday_ThuInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Weekday_ThuInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_weekday_thu(inputs)
	return ko_calendar_weekday_thu(inputs)
});