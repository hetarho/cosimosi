/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Time_AcceleratesInputs */

const en_demo_beat_time_accelerates = /** @type {(inputs: Demo_Beat_Time_AcceleratesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Now let a month pass. What isn't returned to dims, and starts losing words.`)
};

const ko_demo_beat_time_accelerates = /** @type {(inputs: Demo_Beat_Time_AcceleratesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이제 한 달을 흘려보내 보세요. 다시 찾지 않은 별은 어두워지고, 단어를 잃기 시작해요.`)
};

/**
* | output |
* | --- |
* | "Now let a month pass. What isn't returned to dims, and starts losing words." |
*
* @param {Demo_Beat_Time_AcceleratesInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_time_accelerates = /** @type {((inputs?: Demo_Beat_Time_AcceleratesInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Time_AcceleratesInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_time_accelerates(inputs)
	return ko_demo_beat_time_accelerates(inputs)
});