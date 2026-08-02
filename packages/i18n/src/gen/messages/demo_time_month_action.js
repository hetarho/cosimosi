/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Time_Month_ActionInputs */

const en_demo_time_month_action = /** @type {(inputs: Demo_Time_Month_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`+1 month`)
};

const ko_demo_time_month_action = /** @type {(inputs: Demo_Time_Month_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`+1달`)
};

/**
* | output |
* | --- |
* | "+1 month" |
*
* @param {Demo_Time_Month_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_time_month_action = /** @type {((inputs?: Demo_Time_Month_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Time_Month_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_time_month_action(inputs)
	return ko_demo_time_month_action(inputs)
});