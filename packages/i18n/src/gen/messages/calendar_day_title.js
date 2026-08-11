/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ date: NonNullable<unknown> }} Calendar_Day_TitleInputs */

const en_calendar_day_title = /** @type {(inputs: Calendar_Day_TitleInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Written on ${i?.date}`)
};

const ko_calendar_day_title = /** @type {(inputs: Calendar_Day_TitleInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.date}에 쓴 일기`)
};

/**
* | output |
* | --- |
* | "Written on {date}" |
*
* @param {Calendar_Day_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_day_title = /** @type {((inputs: Calendar_Day_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Day_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_day_title(inputs)
	return ko_calendar_day_title(inputs)
});