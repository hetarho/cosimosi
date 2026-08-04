/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_IntroInputs */

const en_landing_theory_intro = /** @type {(inputs: Landing_Theory_IntroInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`cosimosi is inspired by memory research — five ideas, in plain words. It is a diary, not a model of anyone's brain, and you never need to know any of this to use it.`)
};

const ko_landing_theory_intro = /** @type {(inputs: Landing_Theory_IntroInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`cosimosi는 기억 연구에서 영감을 받았어요. 다섯 가지 생각을 쉬운 말로 적어 뒀어요. 이것은 일기이지 누군가의 뇌를 재현한 모형이 아니에요. 여기 있는 이야기를 하나도 몰라도 일기를 쓰는 데는 아무 문제 없어요.`)
};

/**
* | output |
* | --- |
* | "cosimosi is inspired by memory research — five ideas, in plain words. It is a diary, not a model of anyone's brain, and you never need to know any of this to..." |
*
* @param {Landing_Theory_IntroInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_intro = /** @type {((inputs?: Landing_Theory_IntroInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_IntroInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_intro(inputs)
	return ko_landing_theory_intro(inputs)
});