/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Time_Day_ActionInputs */

const en_demo_time_day_action = /** @type {(inputs: Demo_Time_Day_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`+1 day`)
};

const ko_demo_time_day_action = /** @type {(inputs: Demo_Time_Day_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`+1일`)
};

/**
* | output |
* | --- |
* | "+1 day" |
*
* @param {Demo_Time_Day_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_time_day_action = /** @type {((inputs?: Demo_Time_Day_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Time_Day_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_time_day_action(inputs)
	return ko_demo_time_day_action(inputs)
});