/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_View_Pin_HintInputs */

const en_universe_view_pin_hint = /** @type {(inputs: Universe_View_Pin_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Holds the horizon still, with the stars in the middle of the frame.`)
};

const ko_universe_view_pin_hint = /** @type {(inputs: Universe_View_Pin_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지평선을 고정하고, 별들을 가운데 두고 봐요.`)
};

/**
* | output |
* | --- |
* | "Holds the horizon still, with the stars in the middle of the frame." |
*
* @param {Universe_View_Pin_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_view_pin_hint = /** @type {((inputs?: Universe_View_Pin_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_View_Pin_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_view_pin_hint(inputs)
	return ko_universe_view_pin_hint(inputs)
});