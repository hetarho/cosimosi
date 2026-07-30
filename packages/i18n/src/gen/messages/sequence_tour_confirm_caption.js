/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Confirm_CaptionInputs */

const en_sequence_tour_confirm_caption = /** @type {(inputs: Sequence_Tour_Confirm_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Send them up.`)
};

const ko_sequence_tour_confirm_caption = /** @type {(inputs: Sequence_Tour_Confirm_CaptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`위로 띄워 보세요.`)
};

/**
* | output |
* | --- |
* | "Send them up." |
*
* @param {Sequence_Tour_Confirm_CaptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_confirm_caption = /** @type {((inputs?: Sequence_Tour_Confirm_CaptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Confirm_CaptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_confirm_caption(inputs)
	return ko_sequence_tour_confirm_caption(inputs)
});