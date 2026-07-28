/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calendar_ErrorInputs */

const en_calendar_error = /** @type {(inputs: Calendar_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That month wouldn't open.`)
};

const ko_calendar_error = /** @type {(inputs: Calendar_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 달을 펼치지 못했어요.`)
};

/**
* | output |
* | --- |
* | "That month wouldn't open." |
*
* @param {Calendar_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_error = /** @type {((inputs?: Calendar_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_error(inputs)
	return ko_calendar_error(inputs)
});