/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Reset_ActionInputs */

const en_demo_reset_action = /** @type {(inputs: Demo_Reset_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Start over`)
};

const ko_demo_reset_action = /** @type {(inputs: Demo_Reset_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`처음부터 다시`)
};

/**
* | output |
* | --- |
* | "Start over" |
*
* @param {Demo_Reset_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_reset_action = /** @type {((inputs?: Demo_Reset_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Reset_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_reset_action(inputs)
	return ko_demo_reset_action(inputs)
});