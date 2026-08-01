/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Recall_BodyInputs */

const en_landing_theory_recall_body = /** @type {(inputs: Landing_Theory_Recall_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remembering is closer to reconstruction than to playback, and the memory can be altered by the act. That is why a revisited entry comes back slightly different.`)
};

const ko_landing_theory_recall_body = /** @type {(inputs: Landing_Theory_Recall_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`떠올리는 일은 재생보다 재구성에 가까워요. 그래서 떠올리는 것만으로도 기억이 조금 달라질 수 있어요. 다시 찾은 기록이 조금 달라져 돌아오는 이유예요.`)
};

/**
* | output |
* | --- |
* | "Remembering is closer to reconstruction than to playback, and the memory can be altered by the act. That is why a revisited entry comes back slightly different." |
*
* @param {Landing_Theory_Recall_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_recall_body = /** @type {((inputs?: Landing_Theory_Recall_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Recall_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_recall_body(inputs)
	return ko_landing_theory_recall_body(inputs)
});