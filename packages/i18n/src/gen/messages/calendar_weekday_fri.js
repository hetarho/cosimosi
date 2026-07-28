/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Weekday_FriInputs */

const en_calendar_weekday_fri = /** @type {(inputs: Calendar_Weekday_FriInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fri`)
};

const ko_calendar_weekday_fri = /** @type {(inputs: Calendar_Weekday_FriInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`금`)
};

/**
* | output |
* | --- |
* | "Fri" |
*
* @param {Calendar_Weekday_FriInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_weekday_fri = /** @type {((inputs?: Calendar_Weekday_FriInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Weekday_FriInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_weekday_fri(inputs)
	return ko_calendar_weekday_fri(inputs)
});