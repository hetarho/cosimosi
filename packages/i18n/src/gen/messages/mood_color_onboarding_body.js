/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_Color_Onboarding_BodyInputs */

const en_mood_color_onboarding_body = /** @type {(inputs: Mood_Color_Onboarding_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Thirteen feelings wait in the same sky. Touch a star and let its color answer to you.`)
};

const ko_mood_color_onboarding_body = /** @type {(inputs: Mood_Color_Onboarding_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`열세 감정이 한 하늘에서 기다려요. 별을 눌러 마음이 알아보는 색을 건네 주세요.`)
};

/**
* | output |
* | --- |
* | "Thirteen feelings wait in the same sky. Touch a star and let its color answer to you." |
*
* @param {Mood_Color_Onboarding_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_color_onboarding_body = /** @type {((inputs?: Mood_Color_Onboarding_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_Color_Onboarding_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_color_onboarding_body(inputs)
	return ko_mood_color_onboarding_body(inputs)
});