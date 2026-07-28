/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Weekday_TueInputs */

const en_calendar_weekday_tue = /** @type {(inputs: Calendar_Weekday_TueInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Tue`)
};

const ko_calendar_weekday_tue = /** @type {(inputs: Calendar_Weekday_TueInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`화`)
};

/**
* | output |
* | --- |
* | "Tue" |
*
* @param {Calendar_Weekday_TueInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_weekday_tue = /** @type {((inputs?: Calendar_Weekday_TueInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Weekday_TueInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_weekday_tue(inputs)
	return ko_calendar_weekday_tue(inputs)
});