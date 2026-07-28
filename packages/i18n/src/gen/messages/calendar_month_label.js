/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ year: NonNullable<unknown>, month: NonNullable<unknown> }} Calendar_Month_LabelInputs */

const en_calendar_month_label = /** @type {(inputs: Calendar_Month_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.year} · ${i?.month}`)
};

const ko_calendar_month_label = /** @type {(inputs: Calendar_Month_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.year}년 ${i?.month}월`)
};

/**
* | output |
* | --- |
* | "{year} · {month}" |
*
* @param {Calendar_Month_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_month_label = /** @type {((inputs: Calendar_Month_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Month_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_month_label(inputs)
	return ko_calendar_month_label(inputs)
});