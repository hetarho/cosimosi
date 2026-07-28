/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Empty_MonthInputs */

const en_calendar_empty_month = /** @type {(inputs: Calendar_Empty_MonthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Nothing was written this month.`)
};

const ko_calendar_empty_month = /** @type {(inputs: Calendar_Empty_MonthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 달엔 아무것도 적지 않았어요.`)
};

/**
* | output |
* | --- |
* | "Nothing was written this month." |
*
* @param {Calendar_Empty_MonthInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_empty_month = /** @type {((inputs?: Calendar_Empty_MonthInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Empty_MonthInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_empty_month(inputs)
	return ko_calendar_empty_month(inputs)
});