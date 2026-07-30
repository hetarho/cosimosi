/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Closing_CaptionInputs */

const en_sequence_tour_closing_caption = /** @type {(inputs: Sequence_Tour_Closing_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That is all of it. You can walk through it again whenever you like.`)
};

const ko_sequence_tour_closing_caption = /** @type {(inputs: Sequence_Tour_Closing_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여기까지예요. 언제든 다시 처음부터 볼 수 있어요.`)
};

/**
* | output |
* | --- |
* | "That is all of it. You can walk through it again whenever you like." |
*
* @param {Sequence_Tour_Closing_CaptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_closing_caption = /** @type {((inputs?: Sequence_Tour_Closing_CaptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Closing_CaptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_closing_caption(inputs)
	return ko_sequence_tour_closing_caption(inputs)
});