/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_View_ActionInputs */

const en_calendar_view_action = /** @type {(inputs: Calendar_View_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Calendar`)
};

const ko_calendar_view_action = /** @type {(inputs: Calendar_View_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`달력`)
};

/**
* | output |
* | --- |
* | "Calendar" |
*
* @param {Calendar_View_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_view_action = /** @type {((inputs?: Calendar_View_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_View_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_view_action(inputs)
	return ko_calendar_view_action(inputs)
});