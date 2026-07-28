/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Next_Month_ActionInputs */

const en_calendar_next_month_action = /** @type {(inputs: Calendar_Next_Month_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Next month`)
};

const ko_calendar_next_month_action = /** @type {(inputs: Calendar_Next_Month_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다음달`)
};

/**
* | output |
* | --- |
* | "Next month" |
*
* @param {Calendar_Next_Month_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_next_month_action = /** @type {((inputs?: Calendar_Next_Month_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Next_Month_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_next_month_action(inputs)
	return ko_calendar_next_month_action(inputs)
});