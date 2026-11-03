/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Ornament_FinishInputs */

const en_demo_beat_ornament_finish = /** @type {(inputs: Demo_Beat_Ornament_FinishInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The new sky and star shape are applied. Return to the universe to continue.`)
};

const ko_demo_beat_ornament_finish = /** @type {(inputs: Demo_Beat_Ornament_FinishInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하늘과 별 모양이 바뀌었어요. 우주로 돌아가 다음 안내를 만나보세요.`)
};

/**
* | output |
* | --- |
* | "The new sky and star shape are applied. Return to the universe to continue." |
*
* @param {Demo_Beat_Ornament_FinishInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_ornament_finish = /** @type {((inputs?: Demo_Beat_Ornament_FinishInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Ornament_FinishInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_ornament_finish(inputs)
	return ko_demo_beat_ornament_finish(inputs)
});