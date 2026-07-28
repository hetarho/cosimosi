/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ date: NonNullable<unknown> }} Calendar_Day_Unmarked_HintInputs */

const en_calendar_day_unmarked_hint = /** @type {(inputs: Calendar_Day_Unmarked_HintInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.date} — a day whose colour did not remain`)
};

const ko_calendar_day_unmarked_hint = /** @type {(inputs: Calendar_Day_Unmarked_HintInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.date} — 색이 남지 않은 날`)
};

/**
* | output |
* | --- |
* | "{date} — a day whose colour did not remain" |
*
* @param {Calendar_Day_Unmarked_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_day_unmarked_hint = /** @type {((inputs: Calendar_Day_Unmarked_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Day_Unmarked_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_day_unmarked_hint(inputs)
	return ko_calendar_day_unmarked_hint(inputs)
});