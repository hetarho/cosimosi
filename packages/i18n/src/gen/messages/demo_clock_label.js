/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ date: NonNullable<unknown> }} Demo_Clock_LabelInputs */

const en_demo_clock_label = /** @type {(inputs: Demo_Clock_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Universe time ${i?.date}`)
};

const ko_demo_clock_label = /** @type {(inputs: Demo_Clock_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`우주 시간 ${i?.date}`)
};

/**
* | output |
* | --- |
* | "Universe time {date}" |
*
* @param {Demo_Clock_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_clock_label = /** @type {((inputs: Demo_Clock_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Clock_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_clock_label(inputs)
	return ko_demo_clock_label(inputs)
});