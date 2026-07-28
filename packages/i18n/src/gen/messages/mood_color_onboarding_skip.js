/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_Color_Onboarding_SkipInputs */

const en_mood_color_onboarding_skip = /** @type {(inputs: Mood_Color_Onboarding_SkipInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Continue with recommendations for the rest`)
};

const ko_mood_color_onboarding_skip = /** @type {(inputs: Mood_Color_Onboarding_SkipInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`나머지는 추천값으로 진행`)
};

/**
* | output |
* | --- |
* | "Continue with recommendations for the rest" |
*
* @param {Mood_Color_Onboarding_SkipInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_color_onboarding_skip = /** @type {((inputs?: Mood_Color_Onboarding_SkipInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_Color_Onboarding_SkipInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_color_onboarding_skip(inputs)
	return ko_mood_color_onboarding_skip(inputs)
});