/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_Day_LoadingInputs */

const en_calendar_day_loading = /** @type {(inputs: Calendar_Day_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Turning to that day…`)
};

const ko_calendar_day_loading = /** @type {(inputs: Calendar_Day_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 날을 펼치는 중…`)
};

/**
* | output |
* | --- |
* | "Turning to that day…" |
*
* @param {Calendar_Day_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_day_loading = /** @type {((inputs?: Calendar_Day_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Day_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_day_loading(inputs)
	return ko_calendar_day_loading(inputs)
});