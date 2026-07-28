/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Weekday_WedInputs */

const en_calendar_weekday_wed = /** @type {(inputs: Calendar_Weekday_WedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Wed`)
};

const ko_calendar_weekday_wed = /** @type {(inputs: Calendar_Weekday_WedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`수`)
};

/**
* | output |
* | --- |
* | "Wed" |
*
* @param {Calendar_Weekday_WedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_weekday_wed = /** @type {((inputs?: Calendar_Weekday_WedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Weekday_WedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_weekday_wed(inputs)
	return ko_calendar_weekday_wed(inputs)
});