/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Fade_BodyInputs */

const en_landing_tour_fade_body = /** @type {(inputs: Landing_Tour_Fade_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Time passes in your universe when you write. What has not been revisited grows faint, and begins to lose its words.`)
};

const ko_landing_tour_fade_body = /** @type {(inputs: Landing_Tour_Fade_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기를 쓸 때마다 우주의 시간이 흘러요. 오래 들여다보지 않은 기억은 희미해지고, 단어를 잃기 시작해요.`)
};

/**
* | output |
* | --- |
* | "Time passes in your universe when you write. What has not been revisited grows faint, and begins to lose its words." |
*
* @param {Landing_Tour_Fade_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_fade_body = /** @type {((inputs?: Landing_Tour_Fade_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Fade_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_fade_body(inputs)
	return ko_landing_tour_fade_body(inputs)
});