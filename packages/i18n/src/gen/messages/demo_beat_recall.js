/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_RecallInputs */

const en_demo_beat_recall = /** @type {(inputs: Demo_Beat_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remember one. It brightens, and comes back a little changed.`)
};

const ko_demo_beat_recall = /** @type {(inputs: Demo_Beat_RecallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하나를 회고해 보세요. 다시 밝아지고, 조금 달라진 채로 돌아옵니다.`)
};

/**
* | output |
* | --- |
* | "Remember one. It brightens, and comes back a little changed." |
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