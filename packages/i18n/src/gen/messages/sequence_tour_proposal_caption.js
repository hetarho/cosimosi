/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Proposal_CaptionInputs */

const en_sequence_tour_proposal_caption = /** @type {(inputs: Sequence_Tour_Proposal_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The names and the feelings are guesses. Correct whatever is not yours.`)
};

const ko_sequence_tour_proposal_caption = /** @type {(inputs: Sequence_Tour_Proposal_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이름과 감정은 짐작이에요. 당신의 것이 아니면 고쳐주세요.`)
};

/**
* | output |
* | --- |
* | "The names and the feelings are guesses. Correct whatever is not yours." |
*
* @param {Sequence_Tour_Proposal_CaptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_proposal_caption = /** @type {((inputs?: Sequence_Tour_Proposal_CaptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Proposal_CaptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_proposal_caption(inputs)
	return ko_sequence_tour_proposal_caption(inputs)
});