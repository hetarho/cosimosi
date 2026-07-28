/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_List_View_ActionInputs */

const en_calendar_list_view_action = /** @type {(inputs: Calendar_List_View_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`List`)
};

const ko_calendar_list_view_action = /** @type {(inputs: Calendar_List_View_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`목록`)
};

/**
* | output |
* | --- |
* | "List" |
*
* @param {Calendar_List_View_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_list_view_action = /** @type {((inputs?: Calendar_List_View_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_List_View_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_list_view_action(inputs)
	return ko_calendar_list_view_action(inputs)
});