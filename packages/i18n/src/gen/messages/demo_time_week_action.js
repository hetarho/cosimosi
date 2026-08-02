/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Time_Week_ActionInputs */

const en_demo_time_week_action = /** @type {(inputs: Demo_Time_Week_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`+1 week`)
};

const ko_demo_time_week_action = /** @type {(inputs: Demo_Time_Week_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`+1주`)
};

/**
* | output |
* | --- |
* | "+1 week" |
*
* @param {Demo_Time_Week_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_time_week_action = /** @type {((inputs?: Demo_Time_Week_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Time_Week_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_time_week_action(inputs)
	return ko_demo_time_week_action(inputs)
});