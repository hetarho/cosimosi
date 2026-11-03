/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Recall_FinishInputs */

const en_demo_beat_recall_finish = /** @type {(inputs: Demo_Beat_Recall_FinishInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Brighter, clearer, and changed. Compare the two, then return to the universe.`)
};

const ko_demo_beat_recall_finish = /** @type {(inputs: Demo_Beat_Recall_FinishInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억이 다시 밝아지고 또렷해졌어요. 회상 전후를 비교하고 우주로 돌아오세요.`)
};

/**
* | output |
* | --- |
* | "Brighter, clearer, and changed. Compare the two, then return to the universe." |
*
* @param {Demo_Beat_Recall_FinishInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_recall_finish = /** @type {((inputs?: Demo_Beat_Recall_FinishInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Recall_FinishInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_recall_finish(inputs)
	return ko_demo_beat_recall_finish(inputs)
});