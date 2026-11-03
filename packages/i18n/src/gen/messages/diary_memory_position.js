/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ current: NonNullable<unknown>, total: NonNullable<unknown> }} Diary_Memory_PositionInputs */

const en_diary_memory_position = /** @type {(inputs: Diary_Memory_PositionInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.current} / ${i?.total}`)
};

const ko_diary_memory_position = /** @type {(inputs: Diary_Memory_PositionInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.current} / ${i?.total}`)
};

/**
* | output |
* | --- |
* | "{current} / {total}" |
*
* @param {Diary_Memory_PositionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_memory_position = /** @type {((inputs: Diary_Memory_PositionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Memory_PositionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_memory_position(inputs)
	return ko_diary_memory_position(inputs)
});