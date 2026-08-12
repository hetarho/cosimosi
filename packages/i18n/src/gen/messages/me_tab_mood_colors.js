/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Tab_Mood_ColorsInputs */

const en_me_tab_mood_colors = /** @type {(inputs: Me_Tab_Mood_ColorsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Feeling colors`)
};

const ko_me_tab_mood_colors = /** @type {(inputs: Me_Tab_Mood_ColorsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정색`)
};

/**
* | output |
* | --- |
* | "Feeling colors" |
*
* @param {Me_Tab_Mood_ColorsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_tab_mood_colors = /** @type {((inputs?: Me_Tab_Mood_ColorsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Tab_Mood_ColorsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_tab_mood_colors(inputs)
	return ko_me_tab_mood_colors(inputs)
});