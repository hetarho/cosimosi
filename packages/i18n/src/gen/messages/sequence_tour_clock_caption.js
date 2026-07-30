/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Clock_CaptionInputs */

const en_sequence_tour_clock_caption = /** @type {(inputs: Sequence_Tour_Clock_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That date is your universe's time. Looking at it does not move it.`)
};

const ko_sequence_tour_clock_caption = /** @type {(inputs: Sequence_Tour_Clock_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`저 날짜가 당신 우주의 시간이에요. 바라보는 것만으로는 움직이지 않습니다.`)
};

/**
* | output |
* | --- |
* | "That date is your universe's time. Looking at it does not move it." |
*
* @param {Sequence_Tour_Clock_CaptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_clock_caption = /** @type {((inputs?: Sequence_Tour_Clock_CaptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Clock_CaptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_clock_caption(inputs)
	return ko_sequence_tour_clock_caption(inputs)
});