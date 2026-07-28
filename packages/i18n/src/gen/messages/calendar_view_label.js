/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_View_LabelInputs */

const en_calendar_view_label = /** @type {(inputs: Calendar_View_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Archive view`)
};

const ko_calendar_view_label = /** @type {(inputs: Calendar_View_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`보기 방식`)
};

/**
* | output |
* | --- |
* | "Archive view" |
*
* @param {Calendar_View_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_view_label = /** @type {((inputs?: Calendar_View_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_View_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_view_label(inputs)
	return ko_calendar_view_label(inputs)
});