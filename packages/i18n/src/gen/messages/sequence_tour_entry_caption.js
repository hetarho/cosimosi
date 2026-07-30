/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Entry_CaptionInputs */

const en_sequence_tour_entry_caption = /** @type {(inputs: Sequence_Tour_Entry_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Start here.`)
};

const ko_sequence_tour_entry_caption = /** @type {(inputs: Sequence_Tour_Entry_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여기서 시작해요.`)
};

/**
* | output |
* | --- |
* | "Start here." |
*
* @param {Sequence_Tour_Entry_CaptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_entry_caption = /** @type {((inputs?: Sequence_Tour_Entry_CaptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Entry_CaptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_entry_caption(inputs)
	return ko_sequence_tour_entry_caption(inputs)
});