/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ progress: NonNullable<unknown>, target: NonNullable<unknown> }} Achievement_Progress_LabelInputs */

const en_achievement_progress_label = /** @type {(inputs: Achievement_Progress_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.progress} of ${i?.target}`)
};

const ko_achievement_progress_label = /** @type {(inputs: Achievement_Progress_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.target} 중 ${i?.progress}`)
};

/**
* | output |
* | --- |
* | "{progress} of {target}" |
*
* @param {Achievement_Progress_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_progress_label = /** @type {((inputs: Achievement_Progress_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Progress_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_progress_label(inputs)
	return ko_achievement_progress_label(inputs)
});