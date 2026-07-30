/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Welcome_CaptionInputs */

const en_sequence_tour_welcome_caption = /** @type {(inputs: Sequence_Tour_Welcome_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This is your universe. Nothing is in it yet — stars come only from what you write.`)
};

const ko_sequence_tour_welcome_caption = /** @type {(inputs: Sequence_Tour_Welcome_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여기가 당신의 우주예요. 아직 비어 있고, 별은 쓴 것에서만 태어납니다.`)
};

/**
* | output |
* | --- |
* | "This is your universe. Nothing is in it yet — stars come only from what you write." |
*
* @param {Sequence_Tour_Welcome_CaptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_welcome_caption = /** @type {((inputs?: Sequence_Tour_Welcome_CaptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Welcome_CaptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_welcome_caption(inputs)
	return ko_sequence_tour_welcome_caption(inputs)
});