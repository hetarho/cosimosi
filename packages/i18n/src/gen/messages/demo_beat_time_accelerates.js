/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Time_AcceleratesInputs */

const en_demo_beat_time_accelerates = /** @type {(inputs: Demo_Beat_Time_AcceleratesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Now push time forward. What isn't returned to dims, and starts losing words.`)
};

const ko_demo_beat_time_accelerates = /** @type {(inputs: Demo_Beat_Time_AcceleratesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이제 시간을 밀어보세요. 다시 찾지 않은 것은 어두워지고, 단어를 잃기 시작합니다.`)
};

/**
* | output |
* | --- |
* | "Now push time forward. What isn't returned to dims, and starts losing words." |
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