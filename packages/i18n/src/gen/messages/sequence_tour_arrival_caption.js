/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Arrival_CaptionInputs */

const en_sequence_tour_arrival_caption = /** @type {(inputs: Sequence_Tour_Arrival_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What you wrote now lives in your universe.`)
};

const ko_sequence_tour_arrival_caption = /** @type {(inputs: Sequence_Tour_Arrival_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`쓴 기록이 이제 이 우주에 있어요.`)
};

/**
* | output |
* | --- |
* | "What you wrote now lives in your universe." |
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