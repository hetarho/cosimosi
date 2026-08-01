/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Engram_BodyInputs */

const en_landing_theory_engram_body = /** @type {(inputs: Landing_Theory_Engram_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Research describes a memory as leaving a trace in a particular set of cells. That is where the idea of one memory as one small, findable thing comes from.`)
};

const ko_landing_theory_engram_body = /** @type {(inputs: Landing_Theory_Engram_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하나의 기억이 특정한 세포들에 흔적을 남긴다는 연구가 있어요. 기억 하나하나를 찾아낼 수 있는 작은 존재로 다루는 발상이 여기서 왔어요.`)
};

/**
* | output |
* | --- |
* | "Research describes a memory as leaving a trace in a particular set of cells. That is where the idea of one memory as one small, findable thing comes from." |
*
* @param {Landing_Theory_Engram_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_engram_body = /** @type {((inputs?: Landing_Theory_Engram_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Engram_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_engram_body(inputs)
	return ko_landing_theory_engram_body(inputs)
});