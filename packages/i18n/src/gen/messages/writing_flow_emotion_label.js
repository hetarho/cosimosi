/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Emotion_LabelInputs */

const en_writing_flow_emotion_label = /** @type {(inputs: Writing_Flow_Emotion_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Feeling`)
};

const ko_writing_flow_emotion_label = /** @type {(inputs: Writing_Flow_Emotion_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정`)
};

/**
* | output |
* | --- |
* | "Feeling" |
*
* @param {Writing_Flow_Emotion_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_emotion_label = /** @type {((inputs?: Writing_Flow_Emotion_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Emotion_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_emotion_label(inputs)
	return ko_writing_flow_emotion_label(inputs)
});