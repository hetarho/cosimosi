/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Recall_ResultInputs */

const en_landing_walk_recall_result = /** @type {(inputs: Landing_Walk_Recall_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Its light is back — and the words and the shape both returned a little changed, the way remembering actually works.`)
};

const ko_landing_walk_recall_result = /** @type {(inputs: Landing_Walk_Recall_ResultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`밝기를 되찾았어요. 문장도 모양도 조금 달라진 채로요. 기억이 원래 그렇게 돌아오니까요.`)
};

/**
* | output |
* | --- |
* | "Its light is back — and the words and the shape both returned a little changed, the way remembering actually works." |
*
* @param {Landing_Walk_Recall_ResultInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_recall_result = /** @type {((inputs?: Landing_Walk_Recall_ResultInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Recall_ResultInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_recall_result(inputs)
	return ko_landing_walk_recall_result(inputs)
});