/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Weekday_SunInputs */

const en_calendar_weekday_sun = /** @type {(inputs: Calendar_Weekday_SunInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sun`)
};

const ko_calendar_weekday_sun = /** @type {(inputs: Calendar_Weekday_SunInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일`)
};

/**
* | output |
* | --- |
* | "Sun" |
*
* @param {Calendar_Weekday_SunInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_weekday_sun = /** @type {((inputs?: Calendar_Weekday_SunInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Weekday_SunInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_weekday_sun(inputs)
	return ko_calendar_weekday_sun(inputs)
});