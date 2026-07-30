/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Arrival_CaptionInputs */

const en_sequence_tour_arrival_caption = /** @type {(inputs: Sequence_Tour_Arrival_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your first record lives here now.`)
};

const ko_sequence_tour_arrival_caption = /** @type {(inputs: Sequence_Tour_Arrival_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`첫 기록이 이제 여기에 있어요.`)
};

/**
* | output |
* | --- |
* | "Your first record lives here now." |
*
* @param {Sequence_Tour_Arrival_CaptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_arrival_caption = /** @type {((inputs?: Sequence_Tour_Arrival_CaptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Arrival_CaptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_arrival_caption(inputs)
	return ko_sequence_tour_arrival_caption(inputs)
});