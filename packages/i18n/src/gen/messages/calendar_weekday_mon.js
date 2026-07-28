/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Weekday_MonInputs */

const en_calendar_weekday_mon = /** @type {(inputs: Calendar_Weekday_MonInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Mon`)
};

const ko_calendar_weekday_mon = /** @type {(inputs: Calendar_Weekday_MonInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`월`)
};

/**
* | output |
* | --- |
* | "Mon" |
*
* @param {Calendar_Weekday_MonInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_weekday_mon = /** @type {((inputs?: Calendar_Weekday_MonInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Weekday_MonInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_weekday_mon(inputs)
	return ko_calendar_weekday_mon(inputs)
});