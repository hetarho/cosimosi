/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_LoadingInputs */

const en_calendar_loading = /** @type {(inputs: Calendar_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Turning to that month…`)
};

const ko_calendar_loading = /** @type {(inputs: Calendar_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 달을 펼치는 중…`)
};

/**
* | output |
* | --- |
* | "Turning to that month…" |
*
* @param {Calendar_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_loading = /** @type {((inputs?: Calendar_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_loading(inputs)
	return ko_calendar_loading(inputs)
});