/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ date: NonNullable<unknown>, mood: NonNullable<unknown> }} Calendar_Day_Mood_HintInputs */

const en_calendar_day_mood_hint = /** @type {(inputs: Calendar_Day_Mood_HintInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.date} — ${i?.mood}`)
};

const ko_calendar_day_mood_hint = /** @type {(inputs: Calendar_Day_Mood_HintInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.date} — ${i?.mood}`)
};

/**
* | output |
* | --- |
* | "{date} — {mood}" |
*
* @param {Calendar_Day_Mood_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const calendar_day_mood_hint = /** @type {((inputs: Calendar_Day_Mood_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calendar_Day_Mood_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_calendar_day_mood_hint(inputs)
	return ko_calendar_day_mood_hint(inputs)
});