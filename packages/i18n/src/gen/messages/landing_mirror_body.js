/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Mirror_BodyInputs */

const en_landing_mirror_body = /** @type {(inputs: Landing_Mirror_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It is easy to assume the colour is the average of everything you felt. It is not. The sky leans towards the feelings you return to and re-read — so a single hard week does not repaint a year, and a quiet thing you keep going back to shows up.`)
};

const ko_landing_mirror_body = /** @type {(inputs: Landing_Mirror_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하늘색이 그동안 느낀 감정의 평균이라고 생각하기 쉽지만, 그렇지 않아요. 하늘은 다시 찾아 읽는 감정 쪽으로 기울어요. 그래서 힘들었던 한 주가 한 해 전체를 다시 칠하지 않고, 조용히 자주 돌아보는 마음이 드러나요.`)
};

/**
* | output |
* | --- |
* | "It is easy to assume the colour is the average of everything you felt. It is not. The sky leans towards the feelings you return to and re-read — so a single ..." |
*
* @param {Landing_Mirror_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_mirror_body = /** @type {((inputs?: Landing_Mirror_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Mirror_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_mirror_body(inputs)
	return ko_landing_mirror_body(inputs)
});