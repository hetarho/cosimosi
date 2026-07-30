/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Draft_CaptionInputs */

const en_sequence_tour_draft_caption = /** @type {(inputs: Sequence_Tour_Draft_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write the day as it was, then split it into stars.`)
};

const ko_sequence_tour_draft_caption = /** @type {(inputs: Sequence_Tour_Draft_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하루를 있던 대로 쓰고, 별로 쪼개보세요.`)
};

/**
* | output |
* | --- |
* | "Write the day as it was, then split it into stars." |
*
* @param {Sequence_Tour_Draft_CaptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_draft_caption = /** @type {((inputs?: Sequence_Tour_Draft_CaptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Draft_CaptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_draft_caption(inputs)
	return ko_sequence_tour_draft_caption(inputs)
});