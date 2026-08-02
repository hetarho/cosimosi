/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Diary_AppearsInputs */

const en_demo_beat_diary_appears = /** @type {(inputs: Demo_Beat_Diary_AppearsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A diary from someone's ordinary week. Take your time with it.`)
};

const ko_demo_beat_diary_appears = /** @type {(inputs: Demo_Beat_Diary_AppearsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`누군가의 평범한 한 주에서 온 일기예요. 천천히 읽어보세요.`)
};

/**
* | output |
* | --- |
* | "A diary from someone's ordinary week. Take your time with it." |
*
* @param {Demo_Beat_Diary_AppearsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_diary_appears = /** @type {((inputs?: Demo_Beat_Diary_AppearsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Diary_AppearsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_diary_appears(inputs)
	return ko_demo_beat_diary_appears(inputs)
});