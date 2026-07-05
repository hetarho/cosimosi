/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Review_HintInputs */

const en_writing_flow_review_hint = /** @type {(inputs: Writing_Flow_Review_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Adjust the names and feelings, or say how to change them. These edits live only in this session — a star you've already sent up changes only on its own.`)
};

const ko_writing_flow_review_hint = /** @type {(inputs: Writing_Flow_Review_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이름과 감정을 다듬거나, 말로 바꿔 달라고 해요. 이 손질은 이번 쓰기에서만 남고, 이미 띄운 별은 스스로만 변해요.`)
};

/**
* | output |
* | --- |
* | "Adjust the names and feelings, or say how to change them. These edits live only in this session — a star you've already sent up changes only on its own." |
*
* @param {Writing_Flow_Review_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_review_hint = /** @type {((inputs?: Writing_Flow_Review_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Review_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_review_hint(inputs)
	return ko_writing_flow_review_hint(inputs)
});