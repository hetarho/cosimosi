/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Revisit_CaptionInputs */

const en_sequence_tour_revisit_caption = /** @type {(inputs: Sequence_Tour_Revisit_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A star keeps what you wrote. Remembering it again is its own act.`)
};

const ko_sequence_tour_revisit_caption = /** @type {(inputs: Sequence_Tour_Revisit_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별은 내가 쓴 것을 간직해요. 다시 떠올리는 건 또 다른 일이에요.`)
};

/**
* | output |
* | --- |
* | "A star keeps what you wrote. Remembering it again is its own act." |
*
* @param {Sequence_Tour_Revisit_CaptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_revisit_caption = /** @type {((inputs?: Sequence_Tour_Revisit_CaptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Revisit_CaptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_revisit_caption(inputs)
	return ko_sequence_tour_revisit_caption(inputs)
});