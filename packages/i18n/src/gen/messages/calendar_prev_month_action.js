/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Prev_Month_ActionInputs */

const en_calendar_prev_month_action = /** @type {(inputs: Calendar_Prev_Month_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Previous month`)
};

const ko_calendar_prev_month_action = /** @type {(inputs: Calendar_Prev_Month_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지난달`)
};

/**
* | output |
* | --- |
* | "Previous month" |
*
* @param {Calendar_Prev_Month_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_prev_month_action = /** @type {((inputs?: Calendar_Prev_Month_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Prev_Month_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_prev_month_action(inputs)
	return ko_calendar_prev_month_action(inputs)
});