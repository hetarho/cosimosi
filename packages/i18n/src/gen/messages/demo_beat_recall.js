/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_RecallInputs */

const en_demo_beat_recall = /** @type {(inputs: Demo_Beat_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Look at the words that have faded with time. Recall this star to bring it back brighter, and a little changed.`)
};

const ko_demo_beat_recall = /** @type {(inputs: Demo_Beat_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`시간이 지나며 흐려진 단어를 살펴보세요. 이 별을 회고하면 다시 밝아지고, 조금 달라진 채로 돌아와요.`)
};

/**
* | output |
* | --- |
* | "Look at the words that have faded with time. Recall this star to bring it back brighter, and a little changed." |
*
* @param {Demo_Beat_RecallInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_recall = /** @type {((inputs?: Demo_Beat_RecallInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_RecallInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_recall(inputs)
	return ko_demo_beat_recall(inputs)
});