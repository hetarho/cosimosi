/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Time_Travel_ActionInputs */

const en_demo_time_travel_action = /** @type {(inputs: Demo_Time_Travel_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Push time forward`)
};

const ko_demo_time_travel_action = /** @type {(inputs: Demo_Time_Travel_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`시간 밀기`)
};

/**
* | output |
* | --- |
* | "Push time forward" |
*
* @param {Demo_Time_Travel_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_time_travel_action = /** @type {((inputs?: Demo_Time_Travel_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Time_Travel_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_time_travel_action(inputs)
	return ko_demo_time_travel_action(inputs)
});