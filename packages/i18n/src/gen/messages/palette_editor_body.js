/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Editor_BodyInputs */

const en_palette_editor_body = /** @type {(inputs: Palette_Editor_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Each feeling can keep its own color. Untouched feelings stay with the authored sky.`)
};

const ko_palette_editor_body = /** @type {(inputs: Palette_Editor_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`각 감정은 저마다의 색을 가질 수 있어요. 건드리지 않은 감정은 처음의 하늘빛으로 남아요.`)
};

/**
* | output |
* | --- |
* | "Each feeling can keep its own color. Untouched feelings stay with the authored sky." |
*
* @param {Palette_Editor_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_editor_body = /** @type {((inputs?: Palette_Editor_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Editor_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_editor_body(inputs)
	return ko_palette_editor_body(inputs)
});