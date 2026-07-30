/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Taster_Background_ActionInputs */

const en_demo_taster_background_action = /** @type {(inputs: Demo_Taster_Background_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The sky behind`)
};

const ko_demo_taster_background_action = /** @type {(inputs: Demo_Taster_Background_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`뒤의 하늘`)
};

/**
* | output |
* | --- |
* | "The sky behind" |
*
* @param {Demo_Taster_Background_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_taster_background_action = /** @type {((inputs?: Demo_Taster_Background_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Taster_Background_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_taster_background_action(inputs)
	return ko_demo_taster_background_action(inputs)
});