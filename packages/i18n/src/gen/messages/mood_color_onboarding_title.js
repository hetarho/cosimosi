/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_Color_Onboarding_TitleInputs */

const en_mood_color_onboarding_title = /** @type {(inputs: Mood_Color_Onboarding_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A color for every feeling`)
};

const ko_mood_color_onboarding_title = /** @type {(inputs: Mood_Color_Onboarding_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정마다 하나의 색`)
};

/**
* | output |
* | --- |
* | "A color for every feeling" |
*
* @param {Mood_Color_Onboarding_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_color_onboarding_title = /** @type {((inputs?: Mood_Color_Onboarding_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_Color_Onboarding_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_color_onboarding_title(inputs)
	return ko_mood_color_onboarding_title(inputs)
});