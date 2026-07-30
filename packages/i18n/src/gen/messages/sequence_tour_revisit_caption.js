/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Revisit_CaptionInputs */

const en_sequence_tour_revisit_caption = /** @type {(inputs: Sequence_Tour_Revisit_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A star keeps what you wrote. Remembering it again is its own act, and it costs stardust.`)
};

const ko_sequence_tour_revisit_caption = /** @type {(inputs: Sequence_Tour_Revisit_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별은 당신이 쓴 것을 간직해요. 다시 떠올리는 일은 그 자체로 하나의 행위이고, 별가루가 듭니다.`)
};

/**
* | output |
* | --- |
* | "A star keeps what you wrote. Remembering it again is its own act, and it costs stardust." |
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